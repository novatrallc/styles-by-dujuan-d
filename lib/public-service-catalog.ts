import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { services as curatedServices } from '@/lib/business';

/**
 * B4.2.2: Explicitly opt-in, read-only public projection of approved services.
 * This never toggles bookings_enabled, ENABLE_STRIPE_CHECKOUT, or email delivery.
 * Default is the curated non-priced marketing list, not sandbox test pricing.
 */
export type PublicService = {
  slug: string;
  name: string;
  description: string;
  priceCents: number | null;
  durationMinutes: number | null;
};

export type PublicCatalog = {
  services: PublicService[];
  catalogEnabled: boolean;
  pricesEnabled: boolean;
  source: 'curated' | 'approved';
};

const curated: PublicService[] = curatedServices.map((s) => ({
  slug: s.slug,
  name: s.name,
  description: s.description,
  priceCents: null,
  durationMinutes: null,
}));

export function formatServicePrice(priceCents: number | null): string {
  if (priceCents === null || !Number.isSafeInteger(priceCents) || priceCents < 0) {
    return 'Ask about pricing';
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(priceCents / 100);
}

export async function getPublicServices(): Promise<PublicCatalog> {
  const enabled = process.env.ENABLE_PUBLIC_SERVICE_CATALOG === 'true';
  const pricesEnabled = enabled && process.env.ENABLE_PUBLIC_SERVICE_PRICING === 'true';
  if (!enabled) {
    return { services: curated, catalogEnabled: false, pricesEnabled: false, source: 'curated' };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('[PUBLIC_CATALOG_NOT_CONFIGURED]');
    return { services: curated, catalogEnabled: false, pricesEnabled: false, source: 'curated' };
  }

  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
    const { data, error } = await db
      .from('services')
      .select('slug,name,description,price_cents,duration_minutes')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw new Error(error.code || 'catalog query failed');

    const approved = (data ?? [])
      .filter((item) => typeof item.slug === 'string' && typeof item.name === 'string')
      .map((item): PublicService => ({
        slug: item.slug,
        name: item.name,
        description: typeof item.description === 'string' ? item.description : '',
        priceCents: pricesEnabled && Number.isSafeInteger(item.price_cents) && item.price_cents >= 0
          ? item.price_cents
          : null,
        durationMinutes: Number.isSafeInteger(item.duration_minutes) && item.duration_minutes > 0
          ? item.duration_minutes
          : null,
      }));
    return { services: approved, catalogEnabled: true, pricesEnabled, source: 'approved' };
  } catch (error) {
    // Fail closed: never publish unverified prices or internal exception details.
    console.error('[PUBLIC_CATALOG_UNAVAILABLE]', error instanceof Error ? error.message : 'unknown');
    return { services: curated, catalogEnabled: false, pricesEnabled: false, source: 'curated' };
  }
}
