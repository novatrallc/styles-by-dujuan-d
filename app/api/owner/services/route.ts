import { NextRequest, NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers });

function slugFromName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Creates a DRAFT (inactive) service. Existing owner API still edits services. */
export async function POST(request: NextRequest) {
  const owner = await authorizeOwner(request).catch(() => null);
  if (!owner) return fail('Unauthorized', 401);

  let input: unknown;
  try { input = await request.json(); }
  catch { return fail('Invalid JSON.', 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('Invalid service details.', 400);
  }

  const body = input as Record<string, unknown>;
  if (
    typeof body.name !== 'string' ||
    typeof body.description !== 'string' ||
    !Number.isInteger(body.price_cents) ||
    !Number.isInteger(body.duration_minutes)
  ) return fail('Enter a valid name, description, price and duration.', 400);

  const name = body.name.trim();
  const description = body.description.trim();
  const priceCents = Number(body.price_cents);
  const durationMinutes = Number(body.duration_minutes);
  const slug = slugFromName(name);

  if (
    !name || name.length > 120 || !slug ||
    description.length > 1000 ||
    priceCents < 1000 || priceCents > 1_000_000 ||
    durationMinutes < 5 || durationMinutes > 480
  ) return fail('Name, price ($10-$10,000), or duration (5-480 minutes) is invalid.', 400);

  const { data, error } = await owner.db
    .from('services')
    .insert({
      slug,
      name,
      description,
      price_cents: priceCents,
      duration_minutes: durationMinutes,
      is_active: false, // Explicitly inactive until the owner reviews and enables it.
    })
    .select('id,slug,name,is_active')
    .single();

  if (error) {
    if (error.code === '23505') {
      return fail('A service with this name already exists. Choose a different name.', 409);
    }
    console.error('[OWNER_CREATE_SERVICE_FAILED]', { code: error.code, message: error.message });
    return fail('Could not add service. Please try again.', 500);
  }

  return NextResponse.json({ ok: true, service: data }, { status: 201, headers });
}
