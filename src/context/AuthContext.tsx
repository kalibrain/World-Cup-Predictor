/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isGlobalAdmin: boolean;
  isAdminCheckPending: boolean;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [adminCheckedForUserId, setAdminCheckedForUserId] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;
  const isAdminCheckPending = Boolean(userId) && adminCheckedForUserId !== userId;

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        console.error('Unable to restore auth session.', error);
        setSession(null);
      } else {
        setSession(data.session);
      }

      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsGlobalAdmin(false);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdminCheckedForUserId(null);
      return;
    }

    let cancelled = false;
    supabase.rpc('current_user_is_global_admin').then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error('Unable to check admin status.', error);
        setIsGlobalAdmin(false);
      } else {
        setIsGlobalAdmin(Boolean(data));
      }
      setAdminCheckedForUserId(userId);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return error?.message ?? null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      isGlobalAdmin,
      isAdminCheckPending,
      signInWithGoogle,
      signOut,
    }),
    [isLoading, session, isGlobalAdmin, isAdminCheckPending, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
