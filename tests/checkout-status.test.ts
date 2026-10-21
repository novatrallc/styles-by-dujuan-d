import { describe,it,expect } from 'vitest';
// Checkout status route intentionally discloses no customer identity, amounts, or appointment details.
describe('checkout status privacy contract',()=>{
 it('uses a private non-indexable confirmation page',async()=>{
  const fs=await import('node:fs');const text=fs.readFileSync('app/book/confirmation/page.tsx','utf8');
  expect(text).toContain('index:false');
 });
 it('does not display success until server reports confirmed',async()=>{
  const fs=await import('node:fs');const text=fs.readFileSync('app/book/confirmation/status.tsx','utf8');
  expect(text).toContain("status==='confirmed'");
  expect(text).toContain('do not submit another payment');
 });
});
