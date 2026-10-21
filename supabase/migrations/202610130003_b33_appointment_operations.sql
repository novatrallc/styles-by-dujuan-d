-- Build 3.3: owner appointment action audit. Run once after B3 migration.
create table if not exists public.appointment_owner_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id),
  owner_user_id uuid not null,
  previous_status text not null,
  new_status text not null,
  action text not null check (action in ('cancel','complete','no_show')),
  created_at timestamptz not null default now()
);
create index if not exists appointment_owner_events_appointment_idx on public.appointment_owner_events(appointment_id,created_at desc);
alter table public.appointment_owner_events enable row level security;
revoke all on public.appointment_owner_events from anon, authenticated;
