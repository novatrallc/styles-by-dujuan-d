/** B4.2.7 — provider-neutral, read-only payment domain. No payment API access. */
export type PaymentProvider = 'stripe' | 'square';
export type PaymentPurpose = 'deposit' | 'balance';
/** Apple Pay is a payment METHOD, not a third processing PROVIDER. */
export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay' | 'cash' | 'other' | 'unknown';
export type PaymentEnvironment = 'sandbox' | 'live';
export type PaymentMovementKind = 'capture' | 'refund';

export type VerifiedPaymentMovement = Readonly<{
  id: string;
  provider: PaymentProvider;
  purpose: PaymentPurpose;
  method: PaymentMethod;
  environment: PaymentEnvironment;
  accountId: string;
  currency: 'USD';
  amountCents: number;
  kind: PaymentMovementKind;
  /** A local declaration is NEVER authoritative evidence that money moved. */
  verified: boolean;
  /** Completed movements are applied; other states are not cash collected. */
  status: 'completed' | 'initiated' | 'failed' | 'pending' | 'disputed';
}>;

export type SettlementPreview = Readonly<{
  serviceTotalCents: number;
  appliedCents: number;
  dueCents: number;
  overpaymentCents: number;
  excessRefundCents: number;
  appliedMovementCount: number;
  needsReview: boolean;
}>;
