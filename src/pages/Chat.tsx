import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  MessageSquare,
  Users,
  Search,
  Loader2,
  Circle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
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
  const { user, profile, isAdminOrSupervisor } = useAuth();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUsers();
    
    // Subscribe to new messages
    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.sender_id === user?.id || newMsg.receiver_id === user?.id) ||
            newMsg.is_broadcast
          ) {
            setMessages(prev => [...prev, newMsg]);
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
    if (selectedUser) {
      fetchMessages(selectedUser.id);
    }
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('approval_status', 'approved')
        .neq('id', user?.id)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (otherUserId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark messages as read
      await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', otherUserId)
        .eq('receiver_id', user.id)
        .is('read_at', null);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedUser || !newMessage.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert([{
          sender_id: user.id,
          receiver_id: selectedUser.id,
          message: newMessage.trim(),
          is_broadcast: false,
        }]);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const sendBroadcast = async () => {
    if (!user || !newMessage.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert([{
          sender_id: user.id,
          message: newMessage.trim(),
          is_broadcast: true,
        }]);

      if (error) throw error;
      setNewMessage('');
      toast({
        title: 'Mensagem enviada',
        description: 'Mensagem enviada para todos os usuários.',
      });
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
    <div className="h-[calc(100vh-120px)] animate-fade-in">
      <div className="flex flex-col h-full gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chat</h1>
            <p className="text-muted-foreground">Comunicação interna</p>
          </div>
        </div>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Users List */}
          <Card className="w-80 flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">Usuários</CardTitle>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-2 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-1">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Nenhum usuário encontrado
                    </p>
                  ) : (
                    filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        className={cn(
                          'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                          selectedUser?.id === u.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs">
                              {getInitials(u.full_name, u.email)}
                            </AvatarFallback>
                          </Avatar>
                          <Circle
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current',
                              getRoleColor(u.role)
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {u.full_name || u.email}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {u.role.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="flex-1 flex flex-col">
            {selectedUser ? (
              <>
                <CardHeader className="pb-2 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {getInitials(selectedUser.full_name, selectedUser.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">
                        {selectedUser.full_name || selectedUser.email}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground capitalize">
                        {selectedUser.role.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-4 overflow-hidden">
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex',
                            msg.sender_id === user?.id ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[70%] rounded-2xl px-4 py-2',
                              msg.sender_id === user?.id
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md'
                            )}
                          >
                            <p className="text-sm">{msg.message}</p>
                            <p className={cn(
                              'text-[10px] mt-1',
                              msg.sender_id === user?.id
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            )}>
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
                <div className="p-4 border-t">
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sending}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={sending || !newMessage.trim()}>
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione um usuário</p>
                <p className="text-sm">Escolha alguém para iniciar uma conversa</p>
                {isAdminOrSupervisor && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm mb-2">Enviar mensagem para todos:</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Mensagem broadcast..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="w-64"
                      />
                      <Button onClick={sendBroadcast} disabled={sending || !newMessage.trim()}>
                        Enviar a Todos
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Chat;
