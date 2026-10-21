import { describe,it,expect } from 'vitest';
import { generateSlots,overlaps } from '../lib/scheduling';
describe('booking schedule',()=>{
 it('does not overlap adjacent bookings',()=>{expect(overlaps({start:60,end:90},{start:90,end:120})).toBe(false)});
 it('filters blocked intervals',()=>{const slots=generateSlots({day:'2026-11-02',startTime:'09:00',endTime:'10:00',durationMinutes:30,stepMinutes:15,busy:[{start:570,end:600}]});expect(slots.map(x=>x.start)).toEqual(['2026-11-02T09:00']);});
 it('rejects invalid durations',()=>{expect(generateSlots({day:'2026-11-02',startTime:'09:00',endTime:'10:00',durationMinutes:0})).toEqual([])});
 it('supports back-to-back slots',()=>{expect(generateSlots({day:'2026-11-02',startTime:'09:00',endTime:'10:00',durationMinutes:30,stepMinutes:30})).toHaveLength(2)});
});
