import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageSquare, Users, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { createSupabaseLog } from '@/lib/supabaseDebug';

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  approval_status?: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  message: string;
  is_broadcast: boolean;
  created_at: string;
  read_at: string | null;
  sender?: Profile;
}

const Chat: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    fetchMessages();

    // Subscribe to new broadcast messages (group chat)
    const channel = supabase
      .channel('group-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          // Show all broadcast messages
          if (newMsg.is_broadcast || newMsg.receiver_id === null) {
            setMessages((prev) => [...prev, newMsg]);
            scrollToBottom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(
          `
          *,
          sender:profiles!inner(id, full_name, email, role)
        `
        )
        .eq('is_broadcast', true)
        .order('created_at', { ascending: true })
        .limit(500);

      if (error) throw error;
      setMessages((data as Message[]) || []);
      scrollToBottom();

      // Mark messages as read
      await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('is_broadcast', true)
        .is('read_at', null);
    } catch (error) {
      console.error('Error fetching messages:', error);
      createSupabaseLog('select', 'chat_messages', { is_broadcast: true }, null, error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as mensagens.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim() || profile?.approval_status !== 'approved') return;

    setSending(true);
    try {
      const payload = {
        sender_id: user.id,
        receiver_id: null,
        message: newMessage.trim(),
        is_broadcast: true,
      };

      const { error, data } = await supabase.from('chat_messages').insert([payload]);

      createSupabaseLog('insert', 'chat_messages', payload, data, error);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro',
        description: (error as any)?.message || 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-500',
      supervisor: 'bg-purple-500',
      operador: 'bg-blue-500',
      operador_12_36_diurno: 'bg-yellow-500',
      operador_12_36_noturno: 'bg-indigo-500',
    };
    return colors[role] || 'bg-gray-500';
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Chat do Grupo
          </h1>
          <p className="text-muted-foreground text-sm">
            Comunicação em tempo real com toda equipe
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Total de mensagens: {messages.length}</p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-2 border-b flex-shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Chat Geral
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 p-4 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">Nenhuma mensagem ainda</p>
              <p className="text-xs">Comece a conversa!</p>
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex gap-3', msg.sender_id === user?.id ? 'justify-end' : 'justify-start')}
                  >
                    {msg.sender_id !== user?.id && (
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(msg.sender?.full_name, msg.sender?.email || '')}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={cn(
                            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background',
                            getRoleColor(msg.sender?.role || '')
                          )}
                        />
                      </div>
                    )}

                    <div className={cn('flex flex-col gap-1 max-w-xs', msg.sender_id === user?.id && 'items-end')}>
                      {msg.sender_id !== user?.id && (
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-medium">{msg.sender?.full_name || 'Usuário'}</p>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {msg.sender?.role.replace(/_/g, ' ')}
                          </span>
                        </div>
                      )}
                      <div
                        className={cn(
                          'rounded-2xl px-4 py-2 text-sm break-words',
                          msg.sender_id === user?.id
                            ? 'bg-primary text-primary-foreground rounded-br-none'
                            : 'bg-muted rounded-bl-none'
                        )}
                      >
                        {msg.message}
                      </div>
                      <p
                        className={cn(
                          'text-[10px] px-1',
                          msg.sender_id === user?.id ? 'text-muted-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          )}
        </CardContent>

        <div className="p-4 border-t flex-shrink-0">
          {profile?.approval_status !== 'approved' ? (
            <div className="text-xs text-muted-foreground bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-center">
              Sua conta está aguardando aprovação para enviar mensagens.
            </div>
          ) : (
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" disabled={sending || !newMessage.trim()} className="flex-shrink-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Chat;
