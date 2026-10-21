import { createClient, type SupabaseClient } from "@supabase/supabase-js";
/** B1 uses this only for explicitly public, RLS-protected data. No service-role key in browser code. */
export function createPublicSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
