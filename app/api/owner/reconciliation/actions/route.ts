import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const localOnly = () => /^http:\/\/(?:localhost|127\.0\.0\.1):54421\/?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const outcomes = new Set(['refund_documented', 'credit_documented', 'manual_resolved']);
function fail(error: string, status: number) { return NextResponse.json({ error }, { status, headers }); }

/** Owner-authenticated, LOCAL-only audit action. No Stripe calls, refunds or appointment updates. */
export async function POST(request: NextRequest) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) return fail('Owner authentication required.', 401);
  if (!localOnly() || process.env.ENABLE_STRIPE_CHECKOUT === 'true' ||
      process.env.ENABLE_OWNER_STRIPE_TEST_CHECKOUT === 'true') {
    return fail('Disable both public and owner test checkout and use local Supabase for review actions.', 503);
  }
  if (Number(request.headers.get('content-length') ?? '0') > 10_000) return fail('Request too large.', 413);
  let input: unknown;
  try { input = await request.json(); } catch { return fail('Invalid JSON.', 400); }
  if (!input || typeof input !== 'object') return fail('Invalid payload.', 400);
  const v = input as Record<string, unknown>;
  const action = v.action;
  const note = v.note;
  const kind = v.resolutionKind;
  const ref = v.externalReference;
  if (typeof v.actionKey !== 'string' || !uuid.test(v.actionKey) ||
      typeof v.reconciliationId !== 'string' || !uuid.test(v.reconciliationId) ||
      (action !== 'add_note' && action !== 'resolve') ||
      typeof note !== 'string' || note.trim().length < 20 || note.trim().length > 1200 ||
      (action === 'resolve' && (typeof kind !== 'string' || !outcomes.has(kind))) ||
      (ref !== undefined && (typeof ref !== 'string' || ref.length > 120)) ||
      (action === 'resolve' && v.acknowledged !== true) ||
      (action === 'add_note' && (kind !== undefined || ref !== undefined))) {
    return fail('Review the action, note (20–1200 characters), and required confirmation.', 400);
  }
  try {
    const { data, error } = await owner.db.rpc('record_owner_reconciliation_action', {
      p_action_key: v.actionKey,
      p_reconciliation_id: v.reconciliationId,
      p_actor_user_id: owner.user.id,
      p_actor_email: owner.user.email ?? '',
      p_action: action === 'add_note' ? 'note_added' : 'resolved',
      p_note: note.trim(),
      p_resolution_kind: action === 'resolve' ? kind : null,
      p_external_reference: action === 'resolve' && typeof ref === 'string' ? ref.trim() : null,
      p_acknowledged: action === 'resolve',
    });
    if (error) {
      console.error('[B425_OWNER_ACTION_FAILED]', error.code);
      return fail('Action rejected. The item may already be resolved, or documentary information may be incomplete.', 409);
    }
    return NextResponse.json({ ok: true, recorded: data === true, duplicate: data === false }, { headers });
  } catch { return fail('Unable to record action.', 500); }
}
