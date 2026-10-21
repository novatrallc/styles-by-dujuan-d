-- Build 3.6: hardened payment settlement and checkout hold lifecycle.
-- Run AFTER B3.5. Keep ENABLE_STRIPE_CHECKOUT=false until controlled test passes.
-- IMPORTANT: An expired hold is NOT a confirmed booking even if payment arrives late.
create or replace function public.create_checkout_hold(
 p_barber_id uuid,p_service_id uuid,p_start timestamptz,p_end timestamptz,
 p_name text,p_email text,p_phone text,p_total integer
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_price integer; v_duration integer; v_enabled boolean;
begin
 select bookings_enabled into v_enabled from public.business_settings where id=1;
 select price_cents,duration_minutes into v_price,v_duration from public.services where id=p_service_id and is_active=true;
 if coalesce(v_enabled,false)=false or v_price is null or v_duration is null or p_total<>v_price
 or p_start < now()+interval '60 minutes' or p_end-p_start<>v_duration*interval '1 minute'
 or length(trim(p_name)) not between 1 and 150 or length(p_email) not between 3 and 254
 or length(p_phone) not between 5 and 40 or p_total<1000 then raise exception 'Invalid reservation'; end if;
 update public.appointments set status='expired' where status='pending_payment' and hold_expires_at < now();
 insert into public.appointments(barber_id,service_id,starts_at,ends_at,status,customer_name,customer_email,customer_phone,deposit_cents,total_cents,hold_expires_at)
 values(p_barber_id,p_service_id,p_start,p_end,'pending_payment',trim(p_name),lower(trim(p_email)),trim(p_phone),1000,p_total,now()+interval '31 minutes') returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_checkout_hold(uuid,uuid,timestamptz,timestamptz,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.create_checkout_hold(uuid,uuid,timestamptz,timestamptz,text,text,text,integer) to service_role;

-- The caller supplies verified Stripe event fields; do not call this RPC from a browser.
create or replace function public.apply_checkout_event(
 p_event_id text,p_type text,p_session text,p_payment_status text,
 p_amount_total integer,p_currency text
) returns boolean language plpgsql security definer set search_path=public as $$
declare v_appointment public.appointments%rowtype;
begin
 if p_type not in ('checkout.session.completed','checkout.session.expired','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed') then return false; end if;
 insert into public.payment_webhook_events(stripe_event_id,event_type) values(p_event_id,p_type) on conflict do nothing;
 if not found then return false; end if;
 select * into v_appointment from public.appointments where stripe_checkout_session_id=p_session for update;
 if not found then raise exception 'Unknown checkout session'; end if;
 if p_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and p_payment_status='paid' then
  if p_amount_total<>v_appointment.deposit_cents or lower(p_currency)<>'usd' then raise exception 'Payment amount or currency mismatch'; end if;
  if v_appointment.status='pending_payment' and v_appointment.hold_expires_at>=now() then
   update public.appointments set status='confirmed',payment_reference=p_session where id=v_appointment.id;
  elsif v_appointment.status<>'confirmed' then
   -- Late payments require manual review/refund. Never silently claim a booking.
   raise exception 'Paid after hold expiry or reservation no longer pending';
  end if;
 elsif p_type in ('checkout.session.expired','checkout.session.async_payment_failed') and v_appointment.status='pending_payment' then
  update public.appointments set status='expired' where id=v_appointment.id;
 end if;
 return true;
end $$;
revoke all on function public.apply_checkout_event(text,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.apply_checkout_event(text,text,text,text,integer,text) to service_role;
