import {describe,it,expect} from 'vitest';
import {validCustomer,validSlot,checkoutEnabled} from '../lib/checkout-foundation';
describe('checkout validation',()=>{
 it('rejects malformed customer',()=>expect(validCustomer({name:'',email:'no',phone:'123'})).toBe(false));
 it('accepts reasonable customer',()=>expect(validCustomer({name:'Test',email:'test@example.com',phone:'555-0100'})).toBe(true));
 it('rejects expired slots',()=>expect(validSlot('2020-01-01T10:00:00Z','2020-01-01T10:30:00Z',30)).toBe(false));
 it('is disabled without explicit opt-in',()=>expect(checkoutEnabled()).toBe(false));
});
