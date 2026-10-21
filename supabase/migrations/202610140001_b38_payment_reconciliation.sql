-- Build 3.8: persist late/exceptional verified Stripe payments for owner review.
-- Run after 202610130005_b36_checkout_hardening.sql.
create table if not exists public.payment_reconciliation (
 id uuid primary key default gen_random_uuid(),
 appointment_id uuid not null references public.appointments(id),
 stripe_event_id text not null unique,
 stripe_checkout_session_id text not null,
 reason text not null check (reason in ('late_payment','unexpected_reservation_state')),
 amount_cents integer not null,
 currency text not null,
 status text not null default 'needs_review' check (status in ('needs_review','resolved')),
 resolution_note text,
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create index if not exists payment_reconciliation_review_idx on public.payment_reconciliation(status,created_at desc);
alter table public.payment_reconciliation enable row level security;
revoke all on public.payment_reconciliation from anon,authenticated;
grant select,insert,update on public.payment_reconciliation to service_role;

create or replace function public.apply_checkout_event(
 p_event_id text,p_type text,p_session text,p_payment_status text,
 p_amount_total integer,p_currency text
) returns boolean language plpgsql security definer set search_path=public as $$
declare v_appointment public.appointments%rowtype;
begin
 if p_type not in ('checkout.session.completed','checkout.session.expired','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed') then return false; end if;
 if p_event_id is null or length(p_event_id)<3 or p_session is null or length(p_session)<10 then raise exception 'Invalid Stripe identifiers'; end if;
 select * into v_appointment from public.appointments where stripe_checkout_session_id=p_session for update;
 if not found then raise exception 'Unknown checkout session'; end if;
 insert into public.payment_webhook_events(stripe_event_id,event_type) values(p_event_id,p_type) on conflict do nothing;
 if not found then return false; end if;
 if p_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') and p_payment_status='paid' then
  if p_amount_total<>v_appointment.deposit_cents or lower(p_currency)<>'usd' then raise exception 'Payment amount or currency mismatch'; end if;
  if v_appointment.status='pending_payment' and v_appointment.hold_expires_at>=now() then
   update public.appointments set status='confirmed',payment_reference=p_session where id=v_appointment.id;
  elsif v_appointment.status<>'confirmed' then
   insert into public.payment_reconciliation(appointment_id,stripe_event_id,stripe_checkout_session_id,reason,amount_cents,currency)
   values(v_appointment.id,p_event_id,p_session,
     case when v_appointment.status='pending_payment' or v_appointment.status='expired' then 'late_payment' else 'unexpected_reservation_state' end,
     p_amount_total,lower(p_currency)) on conflict(stripe_event_id) do nothing;
   -- A paid-but-expired hold is NOT confirmed. Acknowledge the webhook to prevent endless retries.
  end if;
 elsif p_type in ('checkout.session.expired','checkout.session.async_payment_failed') and v_appointment.status='pending_payment' then
  update public.appointments set status='expired' where id=v_appointment.id;
 end if;
 return true;
end $$;
revoke all on function public.apply_checkout_event(text,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.apply_checkout_event(text,text,text,text,integer,text) to service_role;
