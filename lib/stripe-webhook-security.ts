import { createHmac, timingSafeEqual } from 'node:crypto';

/** Verify Stripe's signed raw payload. Never verify a parsed/re-serialized JSON body. */
export function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !header || !Number.isFinite(nowSeconds)) return false;
  const parts = header.split(',').map((part) => part.trim());
  const timestamps = parts.filter((part) => part.startsWith('t=')).map((part) => part.slice(2));
  if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0])) return false;
  const timestamp = Number(timestamps[0]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest();
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  return signatures.some((signature) => {
    if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
    const candidate = Buffer.from(signature, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

export type StripeCheckoutEvent = {
  id: string;
  type: string;
  data: { object: { id: string; object: 'checkout.session'; payment_status?: string; amount_total?: number; currency?: string } };
};

export function parseCheckoutEvent(payload: string): StripeCheckoutEvent | null {
  let parsed: unknown;
  try { parsed = JSON.parse(payload); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const event = parsed as Record<string, unknown>;
  if (typeof event.id !== 'string' || !/^evt_[\w-]+$/.test(event.id) || typeof event.type !== 'string') return null;
  const data = event.data;
  if (!data || typeof data !== 'object') return null;
  const obj = (data as Record<string, unknown>).object;
  if (!obj || typeof obj !== 'object') return null;
  const session = obj as Record<string, unknown>;
  if (session.object !== 'checkout.session' || typeof session.id !== 'string' || !/^cs_[\w-]+$/.test(session.id)) return null;
  if (session.payment_status !== undefined && typeof session.payment_status !== 'string') return null;
  if (session.amount_total !== undefined && (!Number.isSafeInteger(session.amount_total) || (session.amount_total as number) < 0)) return null;
  if (session.currency !== undefined && typeof session.currency !== 'string') return null;
  return parsed as StripeCheckoutEvent;
}
