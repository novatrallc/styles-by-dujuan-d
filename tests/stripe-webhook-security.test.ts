import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseCheckoutEvent, verifyStripeSignature } from '../lib/stripe-webhook-security';

const secret = 'whsec_test_only';
const now = 1_800_000_000;
const payload = JSON.stringify({ id: 'evt_test1', type: 'checkout.session.completed', data: { object: { object: 'checkout.session', id: 'cs_test_123', payment_status: 'paid', amount_total: 1000, currency: 'usd' } } });
function header(body = payload, time = now) {
  return `t=${time},v1=${createHmac('sha256', secret).update(`${time}.${body}`).digest('hex')}`;
}
describe('Stripe webhook security', () => {
  it('accepts a valid signature and payload', () => expect(verifyStripeSignature(payload, header(), secret, now)).toBe(true));
  it('accepts one valid v1 among rotated signatures', () => expect(verifyStripeSignature(payload, `t=${now},v1=${'0'.repeat(64)},${header().split(',')[1]}`, secret, now)).toBe(true));
  it('rejects changed payload', () => expect(verifyStripeSignature(`${payload} `, header(), secret, now)).toBe(false));
  it('rejects stale and future timestamps', () => { expect(verifyStripeSignature(payload, header(payload, now - 301), secret, now)).toBe(false); expect(verifyStripeSignature(payload, header(payload, now + 301), secret, now)).toBe(false); });
  it('rejects missing, duplicate, malformed timestamps', () => { expect(verifyStripeSignature(payload, 'v1=abcd', secret, now)).toBe(false); expect(verifyStripeSignature(payload, `${header()},t=${now}`, secret, now)).toBe(false); expect(verifyStripeSignature(payload, `t=nope,${header().split(',')[1]}`, secret, now)).toBe(false); });
  it('rejects invalid and missing secrets', () => { expect(verifyStripeSignature(payload, header(), '', now)).toBe(false); expect(verifyStripeSignature(payload, header(), 'wrong', now)).toBe(false); });
  it('accepts a structurally valid checkout event', () => expect(parseCheckoutEvent(payload)?.data.object.id).toBe('cs_test_123'));
  it('rejects malformed or non-session events', () => { expect(parseCheckoutEvent('{')).toBeNull(); expect(parseCheckoutEvent(JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'pi_1', object: 'payment_intent' } } }))).toBeNull(); });
  it('rejects malformed amount values', () => expect(parseCheckoutEvent(JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', object: 'checkout.session', amount_total: -1 } } }))).toBeNull());
});
