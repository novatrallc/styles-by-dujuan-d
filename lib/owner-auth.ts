import { createClient } from '@supabase/supabase-js';

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authorizeOwner(request: Request) {
  const bearer = request.headers.get('authorization') ?? '';
  if (!bearer.startsWith('Bearer ')) return null;
  const allowed = (process.env.OWNER_EMAILS ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return null;
  const db = adminClient();
  const { data, error } = await db.auth.getUser(bearer.slice(7));
  if (error || !data.user?.email || !allowed.includes(data.user.email.toLowerCase())) return null;
  return { db, user: data.user };
}
