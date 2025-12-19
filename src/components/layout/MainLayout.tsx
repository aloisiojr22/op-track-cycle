import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && profile && profile.approval_status === 'pending') {
      toast({
        title: 'Aguardando aprovação',
        description: 'Sua conta está pendente de aprovação pelo administrador.',
        variant: 'default',
      });
    }
  }, [profile, loading, toast]);

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

  // Show notification for pending items on mount
  useEffect(() => {
    if (pendingCount > 0) {
      toast({
        title: `${pendingCount} Pendência(s)`,
        description: 'Você tem itens pendentes aguardando resolução.',
        variant: 'default',
      });
    }
  }, [pendingCount > 0]);

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
    </div>
  );
};

export default MainLayout;
