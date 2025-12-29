import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'supervisor' | 'operador' | 'operador_12_36_diurno' | 'operador_12_36_noturno';
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSupervisor: boolean;
  isAdminOrSupervisor: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      if (!userId) {
        console.warn('fetchProfile called without userId');
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      // Read admin/supervisor email from environment with a sensible fallback.
      // Set `VITE_ADMIN_EMAIL` in your local environment or CI to change this.
      const supervisorEmail = (import.meta.env.VITE_ADMIN_EMAIL as string) || 'aloisio.junior@rotatransportes.com.br';
      if (data && data.email === supervisorEmail) {
        try {
          const updates: Partial<Profile> = {};
          if ((data as Profile).role !== 'supervisor') updates.role = 'supervisor';
          if ((data as Profile).approval_status !== 'approved') updates.approval_status = 'approved';

          if (Object.keys(updates).length > 0) {
            await supabase.from('profiles').update(updates).eq('id', (data as Profile).id);
          }
        } catch (e) {
          console.error('Could not persist supervisor/approval changes:', e);
        }
        setProfile({ ...(data as Profile), role: 'supervisor', approval_status: 'approved' });
      } else {
        setProfile(data as Profile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error) {
      // After successful sign in, ensure the special admin email is approved and role set
      try {
        const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL as string) || 'aloisio.junior@rotatransportes.com.br';
        // fetch session user
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (userId) {
          const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
          if (profileData && profileData.email === adminEmail && profileData.approval_status === 'pending') {
            await supabase.from('profiles').update({ approval_status: 'approved', role: 'supervisor' }).eq('id', userId);
            // refresh local profile state
            await fetchProfile(userId);
          }
        }
      } catch (e) {
        console.error('post-signin auto-approve failed:', e);
      }
    }

    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error && data?.user?.id) {
      // Check if this is the first user (no other profiles exist)
      try {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const isFirstUser = count === 0;
        
        // Create profile with supervisor role if first user, otherwise pending
        const { error: profileError } = await supabase.from('profiles').insert([{
          id: data.user.id,
          email,
          full_name: fullName,
          role: isFirstUser ? 'supervisor' : 'operador',
          approval_status: isFirstUser ? 'approved' : 'pending',
        }]);
        
        if (profileError) {
          console.error('Error creating profile:', profileError);
        }
      } catch (e) {
        console.error('Error during signup profile creation:', e);
      }
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const isAdmin = profile?.role === 'admin';
  const isSupervisor = profile?.role === 'supervisor';
  const isAdminOrSupervisor = isAdmin || isSupervisor;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin,
        isSupervisor,
        isAdminOrSupervisor,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
