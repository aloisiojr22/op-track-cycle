import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ListTodo,
  AlertTriangle,
  MessageSquare,
  LogOut,
  Sun,
  Moon,
  History,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface SidebarProps {
  pendingCount?: number;
  pendingUsersCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ pendingCount = 0, pendingUsersCount = 0 }) => {
  const { signOut, isAdminOrSupervisor, profile, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUnreadMessages = async () => {
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .or(`receiver_id.eq.${user.id},is_broadcast.eq.true`)
        .neq('sender_id', user.id)
        .is('read_at', null);
      
      setUnreadMessages(count || 0);
    };

    fetchUnreadMessages();

    const channel = supabase
      .channel('chat-unread-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => fetchUnreadMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    {
      icon: ListTodo,
      label: 'Minhas Atividades',
      path: '/activities',
      show: true,
    },
    {
      icon: History,
      label: 'Histórico',
      path: '/history',
      show: true,
    },
    {
      icon: AlertTriangle,
      label: 'Pendências e Solicitações',
      path: '/pending',
      show: true,
      badge: pendingCount,
    },
    {
      icon: MessageSquare,
      label: 'Chat',
      path: '/chat',
      show: true,
      badge: unreadMessages,
    },
  ];

  const adminItems = [
    {
      icon: Shield,
      label: 'Painel Admin',
      path: '/admin',
      show: isAdminOrSupervisor,
      badge: pendingUsersCount,
    },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-16 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-lg">
          F
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-1 p-2 overflow-y-auto scrollbar-thin">
        {menuItems.filter(item => item.show).map((item) => (
          <Tooltip key={item.path} delayDuration={0}>
            <TooltipTrigger asChild>
              <NavLink
                to={item.path}
                className={cn(
                  'sidebar-item relative',
                  isActive(item.path) && 'sidebar-item-active'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.badge && item.badge > 0 && (
                  <span className="notification-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                )}
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-foreground text-background">
              {item.label}
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Admin Section Divider */}
        {isAdminOrSupervisor && (
          <>
            <div className="my-2 h-px w-8 bg-sidebar-border" />
            {adminItems.filter(item => item.show).map((item) => (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.path}
                    className={cn(
                      'sidebar-item relative',
                      isActive(item.path) && 'sidebar-item-active'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.badge && item.badge > 0 && (
                      <span className="notification-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                    )}
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-foreground text-background">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </>
        )}
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-1 p-2 border-t border-sidebar-border">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={toggleTheme}
              className="sidebar-item"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-foreground text-background">
            {theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className="sidebar-item text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-foreground text-background">
            Sair
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
};

export default Sidebar;
