-- Build 3.5: server-controlled holds, expiration and payment event tracking.
-- Apply after B3.3. Keep online bookings OFF until Stripe webhook tests pass.
alter table public.appointments add column if not exists hold_expires_at timestamptz;
alter table public.appointments add column if not exists stripe_checkout_session_id text unique;
create table if not exists public.payment_webhook_events (
 stripe_event_id text primary key, event_type text not null, processed_at timestamptz not null default now()
);
alter table public.payment_webhook_events enable row level security;
revoke all on public.payment_webhook_events from anon, authenticated;
-- Never expose these functions to public API roles.
create or replace function public.create_checkout_hold(
 p_barber_id uuid,p_service_id uuid,p_start timestamptz,p_end timestamptz,
 p_name text,p_email text,p_phone text,p_total integer
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if p_start < now()+interval '60 minutes' or p_end <= p_start or p_end > p_start+interval '10 hours'
    or length(trim(p_name)) not between 1 and 150 or length(p_email) not between 3 and 254
    or length(p_phone) not between 5 and 40 or p_total < 1000 then
   raise exception 'Invalid reservation';
 end if;
 update public.appointments set status='expired'
 where status='pending_payment' and hold_expires_at < now();
 insert into public.appointments(barber_id,service_id,starts_at,ends_at,status,customer_name,customer_email,customer_phone,deposit_cents,total_cents,hold_expires_at)
 values(p_barber_id,p_service_id,p_start,p_end,'pending_payment',trim(p_name),lower(trim(p_email)),trim(p_phone),1000,p_total,now()+interval '15 minutes')
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_checkout_hold(uuid,uuid,timestamptz,timestamptz,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.create_checkout_hold(uuid,uuid,timestamptz,timestamptz,text,text,text,integer) to service_role;
-- Idempotent event receipt + appointment update in one transaction.
create or replace function public.apply_checkout_event(p_event_id text,p_type text,p_session text,p_payment_status text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_appointment public.appointments%rowtype;
begin
 if p_type not in ('checkout.session.completed','checkout.session.expired','checkout.session.async_payment_succeeded') then return false; end if;
 insert into public.payment_webhook_events(stripe_event_id,event_type) values(p_event_id,p_type) on conflict do nothing;
 if not found then return false; end if;
 select * into v_appointment from public.appointments where stripe_checkout_session_id=p_session for update;
 if not found then raise exception 'Unknown checkout session'; end if;
 if p_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and p_payment_status='paid' then
   if v_appointment.status='pending_payment' then
     update public.appointments set status='confirmed',payment_reference=p_session where id=v_appointment.id;
   end if;
 elsif p_type='checkout.session.expired' and v_appointment.status='pending_payment' then
   update public.appointments set status='expired' where id=v_appointment.id;
 end if;
 return true;
end $$;
revoke all on function public.apply_checkout_event(text,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_checkout_event(text,text,text,text) to service_role;
