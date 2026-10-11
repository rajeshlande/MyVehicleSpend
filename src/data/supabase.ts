import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Single Supabase client for the app. Only the public anon key is used here (NFR-SEC-02).
 * Sessions persist in localStorage via supabase-js defaults (SDD §9).
 */
let client: SupabaseClient | null = null;

export class MissingConfigError extends Error {
  constructor() {
    super('App is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.');
    this.name = 'MissingConfigError';
  }
}

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new MissingConfigError();
  client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

/** True when the Supabase URL and anon key are present in the build. */
export function isConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}
