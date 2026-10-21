import {describe,it,expect} from 'vitest';
import {renderNotification} from '../lib/notification-templates';
describe('premium notification templates',()=>{
 it('renders branded confirmation and policy',()=>{const x=renderNotification({kind:'booking_confirmed',audience:'customer',customerName:'Alex',serviceName:'Haircut',appointmentStart:'2026-11-10T19:00:00Z'});expect(x.subject).toContain('confirmed');expect(x.html).toContain('DUJUAN D');expect(x.html).toContain('$10 reservation fee');});
 it('escapes untrusted content',()=>{const x=renderNotification({kind:'payment_review',audience:'owner',customerName:'<script>alert(1)</script>'});expect(x.html).not.toContain('<script>');expect(x.html).toContain('&lt;script&gt;');});
});
