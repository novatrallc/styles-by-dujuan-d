import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Test the REAL TypeScript payment module. No mock copy of accounting logic.
const projectRoot = process.cwd();
const requireFromProject = createRequire(path.join(projectRoot, 'package.json'));
const ts = requireFromProject('typescript');
const source = readFileSync(path.join(projectRoot, 'lib/payments/settlement-policy.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  reportDiagnostics: true,
});
const diagnostics = (compiled.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error);
assert.equal(diagnostics.length, 0, 'Payment policy TS must transpile cleanly');
const { previewBalance, isTimelyDepositConfirmation } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64'));
const tx = (id, amountCents, other = {}) => ({
  id, amountCents, kind: 'capture', provider: 'stripe', purpose: 'deposit', method: 'card',
  environment: 'sandbox', accountId: 'acct_test', currency: 'USD', status: 'completed', verified: true,
  ...other,
});

test('a verified $10 Stripe deposit on $40 service leaves $30 due', () => {
  const out = previewBalance(4000, [tx('dep01', 1000)], 'sandbox');
  assert.equal(out.dueCents, 3000);
  assert.equal(out.appliedCents, 1000);
  assert.equal(out.needsReview, false);
});
test('verified Square POS balance can settle the remainder', () => {
  const out = previewBalance(4000, [tx('dep01', 1000), tx('square01', 3000, {
    provider: 'square', purpose: 'balance', accountId: 'seller_test', method: 'card',
  })], 'sandbox');
  assert.equal(out.dueCents, 0);
});
test('Apple Pay is a Stripe method and does not create a third provider', () => {
  assert.equal(previewBalance(4000, [tx('wallet', 1000, { method: 'apple_pay' })]).dueCents, 3000);
});
test('an unverified or pending external declaration never reduces balance', () => {
  const inputs = [tx('sq1', 3000, { provider: 'square', accountId: 'seller', verified: false, purpose: 'balance' }), tx('sq2', 1000, { status: 'pending' })];
  assert.equal(previewBalance(4000, inputs).dueCents, 4000);
});
test('partial verified balance payment leaves exact remaining cents', () => {
  assert.equal(previewBalance(4000, [tx('dep', 1000), tx('part', 2000, { provider: 'square', accountId: 'seller', purpose: 'balance' })]).dueCents, 1000);
});
test('verified refund adjusts net paid, not total service amount', () => {
  const out = previewBalance(4000, [tx('dep', 1000), tx('refund1', 1000, { kind: 'refund' })]);
  assert.equal(out.dueCents, 4000);
  assert.equal(out.appliedCents, 0);
});
test('refund beyond captured balance is flagged instead of silently erased', () => {
  const out = previewBalance(4000, [tx('dep', 1000), tx('refund', 1500, { kind: 'refund' })]);
  assert.equal(out.excessRefundCents, 500);
  assert.equal(out.needsReview, true);
});
test('duplicate provider identity fails closed', () => {
  assert.throws(() => previewBalance(4000, [tx('same', 1000), tx('same', 1000)]), /Duplicate/);
});
test('a different provider merchant has a different identity', () => {
  assert.equal(previewBalance(4000, [tx('same', 1000), tx('same', 1000, { provider: 'square', accountId: 'seller', purpose: 'balance' })]).dueCents, 2000);
});
test('cross-environment, foreign currency, missing verified merchant are rejected', () => {
  assert.throws(() => previewBalance(4000, [tx('a', 1000, { environment: 'live' })], 'sandbox'), /environment/);
  assert.throws(() => previewBalance(4000, [tx('a', 1000, { currency: 'CAD' })]), /currency/);
  assert.throws(() => previewBalance(4000, [tx('a', 1000, { accountId: '' })]), /merchant/);
});
test('overpayment is flagged', () => {
  const out = previewBalance(4000, [tx('a', 5000)]);
  assert.equal(out.overpaymentCents, 1000);
  assert.equal(out.dueCents, 0);
  assert.equal(out.needsReview, true);
});
test('expired hold cannot be confirmed even with paid signed event', () => {
  const yes = { holdExpiresAt: '2026-10-16T12:00:00Z', observedAtMs: Date.parse('2026-10-16T12:00:01Z'), signedWebhook: true, paid: true, exactDepositMatch: true, currencyMatch: true, merchantMatch: true, linkedAppointmentMatch: true };
  assert.equal(isTimelyDepositConfirmation(yes), false);
});
test('timely matching signed event passes policy; signature/account mismatch fails', () => {
  const candidate = { holdExpiresAt: '2026-10-16T12:00:00Z', observedAtMs: Date.parse('2026-10-16T11:59:59Z'), signedWebhook: true, paid: true, exactDepositMatch: true, currencyMatch: true, merchantMatch: true, linkedAppointmentMatch: true };
  assert.equal(isTimelyDepositConfirmation(candidate), true);
  assert.equal(isTimelyDepositConfirmation({ ...candidate, signedWebhook: false }), false);
  assert.equal(isTimelyDepositConfirmation({ ...candidate, merchantMatch: false }), false);
});
test('readiness API is owner/local-only and cannot call payment processors or mutate rows', () => {
  const api = readFileSync(path.join(projectRoot, 'app/api/owner/payment-readiness/route.ts'), 'utf8');
  assert.match(api, /authorizeOwner\(request\)/);
  assert.match(api, /if \(!owner\)/);
  assert.match(api, /if \(!localOnly\(\)\)/);
  assert.match(api, /payment_reconciliation/);
  assert.match(api, /stripeCliAutomaticForwarding: 'not_verified'/);
  assert.doesNotMatch(api, /\b(fetch|\.insert|\.upsert|\.update|\.delete|\.rpc)\s*\(/);
});
test('owner readiness frontend contains no payment collection or public launch action', () => {
  const page = readFileSync(path.join(projectRoot, 'app/owner/payment-readiness/page.tsx'), 'utf8');
  assert.match(page, /payment-readiness/);
  assert.match(page, /Example only/);
  assert.doesNotMatch(page, /\/api\/checkout|createPayment|processPayment|\.rpc\(/i);
});
