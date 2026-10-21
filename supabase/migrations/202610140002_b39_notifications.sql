-- B3.9 transactional outbox. Service role only. Run after B3.8.
create table if not exists public.notification_outbox (
 id uuid primary key default gen_random_uuid(),
 event_key text not null unique,
 kind text not null check(kind in ('booking_confirmed','booking_cancelled','booking_rescheduled','payment_review')),
 audience text not null check(audience in ('customer','owner')),
 recipient_email text not null,
 customer_name text,
 service_name text,
 appointment_start timestamptz,
 appointment_id uuid references public.appointments(id),
 status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0,
 last_error text,
 provider_message_id text,
 created_at timestamptz not null default now(),
 sent_at timestamptz
);
create index if not exists notification_outbox_status_idx on public.notification_outbox(status,created_at);
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon,authenticated;
grant select,insert,update on public.notification_outbox to service_role;

-- Queue customer confirmations/cancellations and owner new-booking alerts.
-- Do not send mail from a database trigger. A separately gated dispatcher sends it.
create or replace function public.b39_queue_appointment_notification() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_service text; v_owner text;
begin
 if new.status is not distinct from old.status then return new; end if;
 if new.status not in ('confirmed','cancelled') then return new; end if;
 select name into v_service from public.services where id=new.service_id;
 if new.customer_email is not null and new.customer_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
  insert into public.notification_outbox(event_key,kind,audience,recipient_email,customer_name,service_name,appointment_start,appointment_id)
  values('appointment:'||new.id||':'||new.status,case when new.status='confirmed' then 'booking_confirmed' else 'booking_cancelled' end,'customer',new.customer_email,new.customer_name,v_service,new.starts_at,new.id)
  on conflict(event_key) do nothing;
 end if;
 -- Owner recipient is configured explicitly in DB, not inferred from auth allow-list.
 select nullif(value,'') into v_owner from public.notification_settings where key='owner_alert_email';
 if v_owner is not null and new.status='confirmed' then
  insert into public.notification_outbox(event_key,kind,audience,recipient_email,customer_name,service_name,appointment_start,appointment_id)
  values('owner:appointment:'||new.id||':confirmed','booking_confirmed','owner',v_owner,new.customer_name,v_service,new.starts_at,new.id)
  on conflict(event_key) do nothing;
 end if;
 return new;
end $$;

create table if not exists public.notification_settings (
 key text primary key, value text not null default ''
);
alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon,authenticated;
grant select,insert,update on public.notification_settings to service_role;

create or replace function public.b39_queue_payment_review() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_owner text; v_name text; v_start timestamptz; v_service text;
begin
 select nullif(value,'') into v_owner from public.notification_settings where key='owner_alert_email';
 if v_owner is null then return new; end if;
 select a.customer_name,a.starts_at,s.name into v_name,v_start,v_service from public.appointments a join public.services s on s.id=a.service_id where a.id=new.appointment_id;
 insert into public.notification_outbox(event_key,kind,audience,recipient_email,customer_name,service_name,appointment_start,appointment_id)
 values('payment-review:'||new.id,'payment_review','owner',v_owner,v_name,v_service,v_start,new.appointment_id)
 on conflict(event_key) do nothing;
 return new;
end $$;

drop trigger if exists b39_appointment_notifications on public.appointments;
create trigger b39_appointment_notifications after update of status on public.appointments
for each row execute function public.b39_queue_appointment_notification();
drop trigger if exists b39_payment_review_notifications on public.payment_reconciliation;
create trigger b39_payment_review_notifications after insert on public.payment_reconciliation
for each row execute function public.b39_queue_payment_review();

-- Atomically claim work; concurrent dispatchers cannot claim the same row.
create or replace function public.b39_claim_notifications(p_limit integer default 10)
returns setof public.notification_outbox language plpgsql security definer set search_path=public as $$
begin
 return query
 with claimed as (
  select id from public.notification_outbox where status='pending' and attempts < 3
  order by created_at for update skip locked limit least(greatest(p_limit,1),25)
 )
 update public.notification_outbox n set status='sending', attempts=n.attempts+1
 from claimed where n.id=claimed.id returning n.*;
end $$;
revoke all on function public.b39_claim_notifications(integer) from public,anon,authenticated;
grant execute on function public.b39_claim_notifications(integer) to service_role;
