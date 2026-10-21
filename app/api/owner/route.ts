import { NextResponse } from 'next/server';
import { authorizeOwner } from '@/lib/owner-auth';
import { localToUtc } from '@/lib/booking-server';
import { canChangeAppointment, targetStatus, type OwnerAction, type AppointmentStatus } from '@/lib/appointment-operations';
export const dynamic = 'force-dynamic';

function fail(message: string, status: number) { return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } }); }
async function owner(request: Request) { try { return await authorizeOwner(request); } catch { return null; } }

export async function GET(request: Request) {
  const auth = await owner(request); if (!auth) return fail('Unauthorized', 401);
  const db = auth.db;
  const [services, hours, exceptions, appointments, barbers, settings] = await Promise.all([
    db.from('services').select('id,slug,name,description,price_cents,duration_minutes,is_active').order('name'),
    db.from('working_hours').select('id,barber_id,weekday,start_time,end_time').order('weekday'),
    db.from('schedule_exceptions').select('id,barber_id,starts_at,ends_at,reason').gte('ends_at', new Date().toISOString()).order('starts_at').limit(100),
    db.from('appointments').select('id,starts_at,ends_at,status,customer_name,customer_email,customer_phone,total_cents,deposit_cents,service_id').gte('starts_at', new Date(Date.now()-86400000).toISOString()).order('starts_at').limit(100),
    db.from('barbers').select('id,display_name,is_active').eq('is_active',true).limit(1),
    db.from('business_settings').select('timezone,bookings_enabled,deposit_cents,reschedule_notice_hours').eq('id',1).maybeSingle()
  ]);

  const results = { services, hours, exceptions, appointments, barbers, settings };
  const failures = Object.entries(results)
    .filter(([, result]) => result.error)
    .map(([query, result]) => ({
      query,
      code: result.error?.code,
      message: result.error?.message,
      hint: result.error?.hint,
    }));

  if (failures.length > 0) {
    console.error('[OWNER_DASHBOARD_QUERY_FAILED]', failures);
    return fail('Could not load owner data', 500);
  }

  return NextResponse.json({services:services.data,hours:hours.data,exceptions:exceptions.data,appointments:appointments.data,barber:barbers.data?.[0] ?? null,settings:settings.data}, {headers:{'Cache-Control':'no-store'}});
}

const validTime = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export async function POST(request: Request) {
  const auth = await owner(request); if (!auth) return fail('Unauthorized', 401);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return fail('Invalid JSON',400); }
  const db = auth.db;
  const { data: barber } = await db.from('barbers').select('id').eq('is_active',true).limit(1).maybeSingle();
  if (!barber) return fail('Active barber is not configured',400);
  const action = body.action;
  if (action === 'appointment_status') {
    const id = body.id, operation = body.operation;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || (operation !== 'cancel' && operation !== 'complete' && operation !== 'no_show')) return fail('Invalid appointment operation',400);
    const { data: existing, error: lookupError } = await db.from('appointments').select('id,status,starts_at,barber_id').eq('id',id).eq('barber_id',barber.id).maybeSingle();
    if (lookupError) return fail('Could not read appointment',500);
    if (!existing) return fail('Appointment not found',404);
    if (!canChangeAppointment(existing.status as AppointmentStatus, operation as OwnerAction, Date.parse(existing.starts_at))) return fail('This appointment cannot transition to the requested status',409);
    // Optimistic status predicate prevents a stale dashboard from overwriting a changed booking.
    const nextStatus = targetStatus[operation as OwnerAction];
    const changed = await db.from('appointments').update({status:nextStatus}).eq('id',id).eq('barber_id',barber.id).eq('status',existing.status).select('id').maybeSingle();
    if (changed.error) return fail('Appointment update failed',500);
    if (!changed.data) return fail('Appointment changed since you loaded the dashboard. Refresh and try again.',409);
    // Audit is server-side; failure must be surfaced, not silently ignored.
    const audit = await db.from('appointment_owner_events').insert({appointment_id:id,owner_user_id:auth.user.id,previous_status:existing.status,new_status:nextStatus,action:operation});
    if (audit.error) return fail('Status updated, but the audit log failed. Contact support before retrying.',500);
  } else if (action === 'service') {
    if (typeof body.id !== 'string' || typeof body.name !== 'string' || !body.name.trim() || body.name.length>120 || typeof body.description !== 'string' || body.description.length>1000 || !Number.isInteger(body.price_cents) || Number(body.price_cents)<1000 || Number(body.price_cents)>1000000 || !Number.isInteger(body.duration_minutes) || Number(body.duration_minutes)<5 || Number(body.duration_minutes)>480 || typeof body.is_active !== 'boolean') return fail('Enter a valid service name, price (at least $10), and duration',400);
    const result=await db.from('services').update({name:body.name.trim(),description:body.description,price_cents:body.price_cents,duration_minutes:body.duration_minutes,is_active:body.is_active}).eq('id',body.id).select('id').maybeSingle();
    if(result.error || !result.data) return fail('Service update failed',400);
  } else if (action === 'hours') {
    if (!Number.isInteger(body.weekday) || Number(body.weekday)<0 || Number(body.weekday)>6 || !validTime(body.start_time) || !validTime(body.end_time) || String(body.start_time)>=String(body.end_time)) return fail('Invalid working hours',400);
    const result=await db.from('working_hours').insert({barber_id:barber.id,weekday:body.weekday,start_time:body.start_time,end_time:body.end_time});
    if(result.error) return fail('Could not add hours (check for duplicates)',400);
  } else if (action === 'delete_hours') {
    if(typeof body.id!=='string') return fail('Invalid hours ID',400);
    const result=await db.from('working_hours').delete().eq('id',body.id).eq('barber_id',barber.id);
    if(result.error) return fail('Could not remove hours',400);
  } else if (action === 'time_off_local') {
    if(typeof body.start_local!=='string'||typeof body.end_local!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.start_local)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.end_local)||typeof body.reason!=='string'||body.reason.length>200)return fail('Invalid time-off details',400);
    const {data:settings,error:settingsError}=await db.from('business_settings').select('timezone').eq('id',1).maybeSingle();
    if(settingsError||!settings?.timezone)return fail('Business timezone is not configured',400);
    const start=localToUtc(body.start_local.slice(0,10),body.start_local.slice(11),settings.timezone);
    const end=localToUtc(body.end_local.slice(0,10),body.end_local.slice(11),settings.timezone);
    if(!start||!end||end.getTime()<=start.getTime()||end.getTime()-start.getTime()>31*86400000)return fail('Invalid time range or daylight-saving transition',400);
    const result=await db.from('schedule_exceptions').insert({barber_id:barber.id,starts_at:start.toISOString(),ends_at:end.toISOString(),reason:body.reason});
    if(result.error)return fail('Could not add time off',400);
  } else if (action === 'time_off') {
    if(typeof body.starts_at!=='string'||typeof body.ends_at!=='string'||!Number.isFinite(Date.parse(body.starts_at))||!Number.isFinite(Date.parse(body.ends_at))||Date.parse(body.ends_at)<=Date.parse(body.starts_at)||Date.parse(body.ends_at)-Date.parse(body.starts_at)>31*86400000||typeof body.reason!=='string'||body.reason.length>200) return fail('Invalid time-off period',400);
    const result=await db.from('schedule_exceptions').insert({barber_id:barber.id,starts_at:body.starts_at,ends_at:body.ends_at,reason:body.reason});
    if(result.error) return fail('Could not add time off',400);
  } else if (action === 'delete_time_off') {
    if(typeof body.id!=='string') return fail('Invalid time-off ID',400);
    const result=await db.from('schedule_exceptions').delete().eq('id',body.id).eq('barber_id',barber.id);
    if(result.error) return fail('Could not remove time off',400);
  } else return fail('Unsupported action. Public booking activation is disabled until verified payment integration.',400);
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
