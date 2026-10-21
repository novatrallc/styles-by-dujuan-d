import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCheckoutEvent, verifyStripeSignature } from '../lib/stripe-webhook-security';
import { createHmac } from 'node:crypto';

const migration = readFileSync('supabase/migrations/202610130005_b36_checkout_hardening.sql', 'utf8');
const checkout = readFileSync('app/api/checkout/route.ts', 'utf8');
const webhook = readFileSync('app/api/stripe/webhook/route.ts', 'utf8');
const secret = 'whsec_local_contract_only';
const now = 1_800_000_000;
const event = (type: string, overrides: Record<string, unknown> = {}) => JSON.stringify({
  id: 'evt_contract_1', type, data: { object: {
    object: 'checkout.session', id: 'cs_test_contract_1', payment_status: 'paid', amount_total: 1000, currency: 'usd', ...overrides,
  } },
});
const sign = (body: string) => `t=${now},v1=${createHmac('sha256', secret).update(`${now}.${body}`).digest('hex')}`;

describe('B4.1.1 payment settlement contract (static + signed fixtures; not live E2E)', () => {
  it.each(['checkout.session.completed', 'checkout.session.expired', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed'])(
    'recognizes signed %s fixtures', (type) => {
      const body = event(type);
      expect(verifyStripeSignature(body, sign(body), secret, now)).toBe(true);
      expect(parseCheckoutEvent(body)?.type).toBe(type);
    },
  );
  it('rejects tampered paid amount', () => {
    const original = event('checkout.session.completed');
    expect(verifyStripeSignature(event('checkout.session.completed', { amount_total: 2000 }), sign(original), secret, now)).toBe(false);
  });
  it('requires atomic duplicate event recording in settlement RPC', () => {
    expect(migration).toMatch(/insert into public\.payment_webhook_events[\s\S]*?on conflict do nothing/i);
    expect(migration).toMatch(/if not found then return false/i);
    expect(migration).toMatch(/for update/i);
  });
  it('confirms only unexpired pending holds', () => {
    expect(migration).toMatch(/status='pending_payment' and v_appointment\.hold_expires_at>=now\(\)/i);
    expect(migration).toMatch(/status='confirmed'/i);
  });
  it('checks deposit amount and currency before confirming', () => {
    expect(migration).toMatch(/p_amount_total<>v_appointment\.deposit_cents/i);
    expect(migration).toMatch(/lower\(p_currency\)<>'usd'/i);
  });
  it('expires unpaid reservations and does not silently confirm late payments', () => {
    expect(migration).toMatch(/status='expired'/i);
    expect(migration).toMatch(/Paid after hold expiry or reservation no longer pending/i);
  });
  it('creates $10 testable Checkout sessions with a short hold and Stripe idempotency key', () => {
    expect(checkout).toContain("'line_items[0][price_data][unit_amount]':'1000'");
    expect(checkout).toContain("'Idempotency-Key':`dujuan-${hold}`");
    expect(checkout).toContain('expires_at:');
  });
  it('returns 5xx for settlement failures so Stripe can retry', () => {
    expect(webhook).toContain("status: 500");
    expect(webhook).toContain("rpc('apply_checkout_event'");
  });
});
