-- B3.9.9: audited, opt-in manual retry. Apply after B3.9 migration.
create table if not exists public.notification_recovery_audit (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notification_outbox(id),
  actor_email text not null,
  action text not null check (action in ('retry_requested')),
  previous_status text not null,
  previous_attempts integer not null,
  created_at timestamptz not null default now()
);
create index if not exists notification_recovery_audit_notification_idx on public.notification_recovery_audit(notification_id, created_at desc);
alter table public.notification_recovery_audit enable row level security;
revoke all on public.notification_recovery_audit from public, anon, authenticated;
grant select,insert on public.notification_recovery_audit to service_role;

-- Atomically requeue a failed record only; no automatic retries and no attempt reset.
-- This function must only be invoked server-side after validating an allowed owner.
create or replace function public.b399_request_notification_retry(p_id uuid, p_actor_email text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_row public.notification_outbox%rowtype;
begin
  if nullif(trim(p_actor_email),'') is null then raise exception 'Actor required'; end if;
  select * into v_row from public.notification_outbox where id=p_id for update;
  if not found then return false; end if;
  if v_row.status <> 'failed' or v_row.attempts >= 3 or v_row.provider_message_id is not null or v_row.sent_at is not null then return false; end if;
  insert into public.notification_recovery_audit(notification_id,actor_email,action,previous_status,previous_attempts)
  values (p_id, lower(trim(p_actor_email)), 'retry_requested',v_row.status,v_row.attempts);
  update public.notification_outbox set status='pending',last_error=null where id=p_id;
  return true;
end $$;
revoke all on function public.b399_request_notification_retry(uuid,text) from public,anon,authenticated;
grant execute on function public.b399_request_notification_retry(uuid,text) to service_role;
