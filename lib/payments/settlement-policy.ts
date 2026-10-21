import type { PaymentEnvironment, SettlementPreview, VerifiedPaymentMovement } from './domain';

/**
 * Pure accounting projection, NOT an instruction to settle or confirm an appointment.
 * Unverified seller declarations / unknown payment outcomes never reduce the balance.
 * Reversals are independent verified movements with distinct provider references.
 */
export function previewBalance(
  serviceTotalCents: number,
  movements: readonly VerifiedPaymentMovement[],
  expectedEnvironment?: PaymentEnvironment,
): SettlementPreview {
  if (!Number.isSafeInteger(serviceTotalCents) || serviceTotalCents < 0) {
    throw new Error('Invalid service total in cents');
  }
  const identities = new Set<string>();
  let captured = 0;
  let refunded = 0;
  let count = 0;
  for (const movement of movements) {
    if (!['stripe', 'square'].includes(movement.provider)) throw new Error('Unsupported payment provider');
    if (!['deposit', 'balance'].includes(movement.purpose)) throw new Error('Unsupported payment purpose');
    if (!['card','apple_pay','google_pay','cash','other','unknown'].includes(movement.method)) throw new Error('Unsupported payment method');
    if (!['sandbox', 'live'].includes(movement.environment)) throw new Error('Invalid payment environment');
    if (expectedEnvironment && movement.environment !== expectedEnvironment) throw new Error('Payment environment mismatch');
    if (movement.currency !== 'USD') throw new Error('Unsupported currency');
    if (!Number.isSafeInteger(movement.amountCents) || movement.amountCents <= 0) throw new Error('Invalid payment amount');
    if (!movement.id || !movement.id.trim()) throw new Error('Payment identifier required');
    if (!['capture', 'refund'].includes(movement.kind)) throw new Error('Invalid movement kind');
    if (movement.provider === 'stripe' && movement.method === 'cash') throw new Error('Stripe cannot be recorded as cash');
    // Cross-provider duplicate IDs can be legitimate; the complete identity is the key.
    const identity = [movement.provider,movement.environment,movement.accountId,movement.id].join(':');
    if (identities.has(identity)) throw new Error('Duplicate provider payment movement');
    identities.add(identity);
    if (!movement.verified || movement.status !== 'completed') continue;
    if (!movement.accountId || !movement.accountId.trim()) throw new Error('Verified payment missing merchant identity');
    count++;
    if (movement.kind === 'capture') captured += movement.amountCents;
    else refunded += movement.amountCents;
    if (!Number.isSafeInteger(captured) || !Number.isSafeInteger(refunded)) throw new Error('Unsafe payment total');
  }
  const net = captured - refunded;
  const overpaymentCents = Math.max(0, net - serviceTotalCents);
  const excessRefundCents = Math.max(0, -net);
  return {
    serviceTotalCents,
    appliedCents: net,
    dueCents: Math.max(0, serviceTotalCents - net),
    overpaymentCents,
    excessRefundCents,
    appliedMovementCount: count,
    needsReview: overpaymentCents > 0 || excessRefundCents > 0,
  };
}

/** Independent gate: a stripe/square success screen alone must never confirm a booking. */
export function isTimelyDepositConfirmation(input: Readonly<{
  holdExpiresAt: string;
  observedAtMs: number;
  signedWebhook: boolean;
  paid: boolean;
  exactDepositMatch: boolean;
  currencyMatch: boolean;
  merchantMatch: boolean;
  linkedAppointmentMatch: boolean;
}>): boolean {
  const deadline = Date.parse(input.holdExpiresAt);
  return Number.isFinite(deadline) && Number.isFinite(input.observedAtMs) &&
    input.observedAtMs <= deadline && Boolean(input.signedWebhook && input.paid &&
    input.exactDepositMatch && input.currencyMatch && input.merchantMatch && input.linkedAppointmentMatch);
}
