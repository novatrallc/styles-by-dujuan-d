export type Window = { start: number; end: number };
export type Slot = { start: string; end: string };
/** Half-open intervals: adjacent appointments do not overlap. */
export function overlaps(a: Window, b: Window): boolean { return a.start < b.end && b.start < a.end; }
export function generateSlots(args: { day: string; startTime: string; endTime: string; durationMinutes: number; busy?: Window[]; stepMinutes?: number; nowMs?: number; minLeadMinutes?: number }): Slot[] {
 const {day,startTime,endTime,durationMinutes,busy=[],stepMinutes=15,nowMs=Date.now(),minLeadMinutes=60}=args;
 if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return [];
 if (!Number.isInteger(durationMinutes) || durationMinutes<=0 || durationMinutes>600 || !Number.isInteger(stepMinutes) || stepMinutes<5) return [];
 const parse=(v:string)=>{const [h,m]=v.split(':').map(Number);return h>=0&&h<24&&m>=0&&m<60?h*60+m:NaN};
 const start=parse(startTime),end=parse(endTime); if (!Number.isFinite(start)||!Number.isFinite(end)||end<=start) return [];
 const result: Slot[]=[];
 for(let m=start;m+durationMinutes<=end;m+=stepMinutes){
  const toClock=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  // These are local business-clock slots; convert to UTC only on the server with timezone awareness.
  const from=`${day}T${toClock(m)}`,to=`${day}T${toClock(m+durationMinutes)}`;
  const candidate={start:m,end:m+durationMinutes};
  if(busy.some(b=>overlaps(candidate,b)))continue;
  // nowMs and minLeadMinutes are intentionally enforced by the server after timezone conversion.
  void nowMs;void minLeadMinutes;
  result.push({start:from,end:to});
 }
 return result;
}
export function minutesFromClock(clock:string):number {const [h,m]=clock.slice(0,5).split(':').map(Number);return h*60+m;}
