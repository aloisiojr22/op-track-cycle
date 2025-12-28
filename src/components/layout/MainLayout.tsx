import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import { PendingAlert } from './PendingAlert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [showPendingAlert, setShowPendingAlert] = useState(false);
  const [userJustLogged, setUserJustLogged] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // If this is the special admin email and still pending, auto-approve locally
    const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL as string) || 'aloisio.junior@rotatransportes.com.br';
    if (!loading && profile && profile.approval_status === 'pending') {
      if (profile.email === adminEmail) {
        (async () => {
          try {
            await supabase.from('profiles').update({ approval_status: 'approved', role: 'supervisor' }).eq('id', profile.id);
            // refresh profile from AuthContext
            await refreshProfile();
            toast({ title: 'Conta aprovada', description: 'Seu usuário foi aprovado automaticamente.', variant: 'default' });
          } catch (e) {
            console.error('Auto-approve failed:', e);
            toast({ title: 'Aguardando aprovação', description: 'Sua conta está pendente de aprovação pelo administrador.', variant: 'default' });
          }
        })();
      } else {
        toast({
          title: 'Aguardando aprovação',
          description: 'Sua conta está pendente de aprovação pelo administrador.',
          variant: 'default',
        });
      }
    }
  }, [profile, loading, toast, refreshProfile]);

  useEffect(() => {
    if (!user) return;

    const fetchCounts = async () => {
      // Fetch pending items count
      const { count: pendingItemsCount } = await supabase
        .from('pending_items')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false);

      setPendingCount(pendingItemsCount || 0);

      // Fetch pending users count (admin only)
      if (profile?.role === 'admin' || profile?.role === 'supervisor') {
        const { count: pendingUsersCountResult } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('approval_status', 'pending');

        setPendingUsersCount(pendingUsersCountResult || 0);
      }
    };

    fetchCounts();

    // Subscribe to pending items changes
    const pendingChannel = supabase
      .channel('pending-items-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_items' },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pendingChannel);
    };
  }, [user, profile]);

  // Show pending alert modal on login (first time only)
  useEffect(() => {
    if (!user || loading) return;
    
    if (!userJustLogged) {
      setUserJustLogged(true);
      // Show alert after a short delay to ensure everything is loaded
      const timeout = setTimeout(() => {
        if (pendingCount > 0) {
          setShowPendingAlert(true);
        }
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [user, loading, pendingCount, userJustLogged]);

  // Subscribe to chat messages for notifications
  useEffect(() => {
    if (!user) return;

    const chatChannel = supabase
      .channel('chat-notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `receiver_id=eq.${user.id}`
        },
        (payload) => {
          const newMessage = payload.new as any;
          if (newMessage.sender_id !== user.id) {
            toast({
              title: 'Nova mensagem',
              description: 'Você recebeu uma nova mensagem no chat.',
              variant: 'default',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `is_broadcast=eq.true`
        },
        (payload) => {
          const newMessage = payload.new as any;
          if (newMessage.sender_id !== user.id) {
            toast({
              title: 'Mensagem de broadcast',
              description: 'Uma nova mensagem foi enviada para todos.',
              variant: 'default',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [user, toast]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar pendingCount={pendingCount} pendingUsersCount={pendingUsersCount} />
      <main className="flex-1 ml-16 overflow-x-hidden">
        <div className="container mx-auto p-6 max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Pending Alert Modal */}
      <PendingAlert
        pendingCount={pendingCount}
        open={showPendingAlert}
        onOpenChange={setShowPendingAlert}
        onGotoPending={() => navigate('/pending')}
      />
    </div>
  );
};

export default MainLayout;
