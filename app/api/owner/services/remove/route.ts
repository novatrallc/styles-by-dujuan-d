import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers });

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Owner-only service lifecycle action.
 * Deactivation is reversible via the existing owner service editor.
 * Permanent deletion is intentionally restricted to the LOCAL Supabase sandbox,
 * and the database's appointment FK is a second line of protection.
 */
export async function POST(request: NextRequest) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) return fail('Unauthorized', 401);

  let input: unknown;
  try { input = await request.json(); }
  catch { return fail('Invalid JSON.', 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('Invalid service request.', 400);
  }

  const { id, operation } = input as Record<string, unknown>;
  if (typeof id !== 'string' || !uuid.test(id) ||
      (operation !== 'deactivate' && operation !== 'delete')) {
    return fail('Invalid service or action.', 400);
  }

  const db = owner.db;
  const { data: service, error: lookupError } = await db
    .from('services')
    .select('id,name,is_active')
    .eq('id', id)
    .maybeSingle();

  if (lookupError) return fail('Could not check the service.', 500);
  if (!service) return fail('Service not found. Refresh and try again.', 404);

  if (operation === 'deactivate') {
    const { data: changed, error: updateError } = await db
      .from('services')
      .update({ is_active: false })
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (updateError || !changed) return fail('Could not deactivate the service.', 500);
    return NextResponse.json({ ok: true, action: 'deactivated' }, { headers });
  }

  // Do not allow permanent removal to hit a hosted/staging database in this build.
  const localUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):54421\/?$/.test(localUrl)) {
    return fail('Permanent deletion is limited to local Supabase. Deactivate the service instead.', 403);
  }
  if (service.is_active) {
    return fail('Deactivate the service before permanently deleting it.', 409);
  }

  // Preserve past, current and future appointments in EVERY status.
  const { count, error: usageError } = await db
    .from('appointments')
    .select('id', { head: true, count: 'exact' })
    .eq('service_id', id);

  if (usageError) return fail('Could not verify appointment history. Nothing was deleted.', 500);
  if (count === null) return fail('Could not verify appointment history. Nothing was deleted.', 500);
  if (count > 0) {
    return fail('This service has appointment history and cannot be deleted. Keep it inactive instead.', 409);
  }

  const { data: deleted, error: deleteError } = await db
    .from('services')
    .delete()
    .eq('id', id)
    .eq('is_active', false)
    .select('id')
    .maybeSingle();

  // The appointments.service_id FK also rejects an appointment created
  // between the history check and DELETE, including concurrent requests.
  if (deleteError?.code === '23503') {
    return fail('This service is referenced by an appointment. Keep it inactive.', 409);
  }
  if (deleteError) return fail('Could not delete the service. Nothing else was changed.', 500);
  if (!deleted) return fail('Service changed while deleting. Refresh and try again.', 409);
  return NextResponse.json({ ok: true, action: 'deleted' }, { headers });
}
