import { describe, it, expect } from 'vitest';
import { canChangeAppointment, targetStatus } from '../lib/appointment-operations';
describe('owner appointment transitions', () => {
 const past=Date.now()-3600000, future=Date.now()+3600000;
 it('can cancel confirmed or unpaid reservations',()=>{expect(canChangeAppointment('confirmed','cancel',future)).toBe(true);expect(canChangeAppointment('pending_payment','cancel',future)).toBe(true)});
 it('cannot complete or no-show future appointments',()=>{expect(canChangeAppointment('confirmed','complete',future)).toBe(false);expect(canChangeAppointment('confirmed','no_show',future)).toBe(false)});
 it('can complete past confirmed appointments',()=>{expect(canChangeAppointment('confirmed','complete',past)).toBe(true);expect(canChangeAppointment('confirmed','no_show',past)).toBe(true)});
 it('cannot alter terminal statuses',()=>{for(const s of ['cancelled','expired','completed','no_show'] as const)expect(canChangeAppointment(s,'cancel',past)).toBe(false)});
 it('never marks unpaid appointments completed',()=>expect(canChangeAppointment('pending_payment','complete',past)).toBe(false));
 it('maps operations to statuses',()=>expect(targetStatus.no_show).toBe('no_show'));
});
