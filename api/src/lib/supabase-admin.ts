import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from './config';
import { Database } from './database.types';

let cached: SupabaseClient<Database> | null = null;

export type SupabaseAdmin = SupabaseClient<Database>;

/**
 * Cliente Supabase com service_role key. SOMENTE no backend.
 * Bypassa RLS. Usar com cautela.
 */
export function getSupabaseAdmin(): SupabaseAdmin {
  if (cached) return cached;
  const cfg = getConfig();
  cached = createClient<Database>(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { 'X-Client-Info': 'whatsapp4etc-api' },
    },
  });
  return cached;
}
