import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../../data/supabase';
import { clearOfflineCache } from '../../data/offlineCache';
import { signInSchema, signUpSchema, type SignInInput, type SignUpInput } from './schemas';

export interface AuthState {
  /** undefined while the stored session is being read */
  session: Session | null | undefined;
  signIn: (input: SignInInput) => Promise<{ error: string | null }>;
  signUp: (input: SignUpInput) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Maps auth errors to plain-language messages (SDD §8, API doc §6).
 * Matches on the Supabase error code first, then on the message text.
 * Unknown errors show the generic message and log the raw error, so they can be diagnosed.
 */
export function mapAuthError(message: string | undefined, code?: string): string {
  const m = (message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || m.includes('invalid login credentials'))
    return 'Email or password is incorrect.';
  if (code === 'email_not_confirmed' || m.includes('email not confirmed'))
    return 'Confirm your email first. Open the link we sent you, then sign in.';
  if (
    code === 'user_already_exists' ||
    m.includes('already registered') ||
    m.includes('already been registered')
  )
    return 'An account with this email already exists. Try signing in.';
  if (code === 'weak_password' || m.includes('password should be at least'))
    return 'Choose a stronger password.';
  if (code?.includes('rate_limit') || m.includes('rate limit'))
    return 'Too many attempts. Please wait a few minutes and try again.';
  if (m.includes('network') || m.includes('fetch'))
    return "Couldn't reach the server. Check your connection and try again.";
  console.error(`[auth] ${code ?? 'unknown'}: ${message ?? ''}`);
  return 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      signIn: async (input) => {
        const parsed = signInSchema.safeParse(input);
        if (!parsed.success)
          return { error: parsed.error.issues[0]?.message ?? 'Check your details.' };
        const { error } = await getSupabase().auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        return { error: error ? mapAuthError(error.message, error.code) : null };
      },
      signUp: async (input) => {
        const parsed = signUpSchema.safeParse(input);
        if (!parsed.success)
          return {
            error: parsed.error.issues[0]?.message ?? 'Check your details.',
            needsConfirmation: false,
          };
        const { data, error } = await getSupabase().auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { data: { display_name: parsed.data.displayName ?? '' } },
        });
        if (error)
          return { error: mapAuthError(error.message, error.code), needsConfirmation: false };
        // With email confirmation on, there is no session until the link is opened.
        return { error: null, needsConfirmation: data.session === null };
      },
      signOut: async () => {
        // Saved data belongs to this account only, so it goes when the account signs out (FR-PWA-03).
        await clearOfflineCache();
        await getSupabase().auth.signOut();
      },
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
