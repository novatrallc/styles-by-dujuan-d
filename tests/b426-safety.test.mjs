import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const base = resolve(import.meta.dirname, '..');
const read = relative => readFileSync(resolve(base, relative), 'utf8');
const activity = read('app/api/owner/payment-activity/route.ts');
const stripe = read('app/api/owner/payment-activity/stripe/route.ts');
const page = read('app/owner/payment-activity/page.tsx');
const installer = read('install-b426.ps1');

test('new owner timeline routes and page exist', () => {
  assert.ok(existsSync(resolve(base, 'app/api/owner/payment-activity/route.ts')));
  assert.ok(existsSync(resolve(base, 'app/api/owner/payment-activity/stripe/route.ts')));
  assert.ok(existsSync(resolve(base, 'app/owner/payment-activity/page.tsx')));
});
test('timeline enforces local Supabase and owner bearer authorization', () => {
  assert.match(activity, /authorizeOwner\(request\)/);
  assert.match(activity, /54421/);
  assert.match(activity, /private, no-store/);
});
test('read-only timeline cannot mutate rows or process checkout', () => {
  for (const forbidden of ['.insert(', '.update(', '.delete(', '.rpc(', 'checkout/sessions']) assert.ok(!activity.includes(forbidden), forbidden);
});
test('status check only obtains an existing locally linked TEST session', () => {
  assert.match(stripe, /authorizeOwner\(request\)/);
  assert.match(stripe, /sk_test_/);
  assert.match(stripe, /cs_test_/);
  assert.match(stripe, /stripe_checkout_session_id/);
  assert.match(stripe, /session\.livemode !== false/);
  assert.match(stripe, /metadata\?\.appointment_id === appointment.id/);
});
test('Stripe request is read-only, fixed-host and bounded', () => {
  assert.match(stripe, /https:\/\/api\.stripe\.com\/v1\/checkout\/sessions\//);
  assert.match(stripe, /AbortSignal\.timeout\(12000\)/);
  for (const forbidden of ['method: \'POST\'', '.insert(', '.update(', '.rpc(', '/expire']) assert.ok(!stripe.includes(forbidden), forbidden);
});
test('frontend requires owner session and does not make payments', () => {
  assert.match(page, /auth\.getSession\(\)/);
  assert.match(page, /Bearer/);
  assert.match(page, /Check Stripe status/);
  assert.doesNotMatch(page, /stripe-test-checkout/);
});
test('no evidence is fabricated for missing event timestamps or CLI forwarding', () => {
  assert.match(activity, /occurredAt: null/);
  assert.match(activity, /does NOT establish Stripe CLI forwarding/);
  assert.match(page, /not webhook delivery proof/);
});
test('installer uses preflight backup and rollback without db actions', () => {
  assert.ok(installer.includes("$backupFolder"));
  assert.match(installer, /Copy-Item/);
  assert.match(installer, /catch \{/);
  assert.doesNotMatch(installer, /supabase db (?:push|reset)|stripe trigger|psql -c/);
});
