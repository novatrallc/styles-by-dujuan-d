-- B1: Safe, repeatable single-barber schema. No public writes and no booking until later builds.
create extension if not exists pgcrypto;
create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price_cents integer check (price_cents is null or price_cents >= 1000),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.business_settings (
  id integer primary key default 1 check (id = 1),
  timezone text not null default 'America/New_York',
  deposit_cents integer not null default 1000 check (deposit_cents = 1000),
  reschedule_notice_hours integer not null default 24 check (reschedule_notice_hours >= 0),
  bookings_enabled boolean not null default false
);
create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time),
  unique (barber_id, weekday, start_time, end_time)
);
create table if not exists public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (starts_at < ends_at)
);
create index if not exists schedule_exceptions_barber_starts_idx on public.schedule_exceptions(barber_id, starts_at);
insert into public.business_settings (id) values (1) on conflict (id) do nothing;
insert into public.barbers (id, display_name) values ('00000000-0000-4000-8000-000000000001', 'Jemal Burton') on conflict (id) do nothing;
insert into public.services (slug, name, description) values
('beard-trim','Beard Trim Only','Clean lines and refined detail.'),
('haircut','Signature Haircut','A precise cut tailored to your style.'),
('haircut-beard','Haircut & Beard Trim','The complete grooming refresh.'),
('haircut-shave','Haircut & Shave','A sharp cut and smooth finish.'),
('shave','Shave Only','A clean, polished finish.'),
('color','Color Only','Color customized to your look.'),
('cut-color','Cut & Color','A fresh cut with a color transformation.'),
('styling','Hair Styling','A finished look for any occasion.')
on conflict (slug) do nothing;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.business_settings enable row level security;
alter table public.working_hours enable row level security;
alter table public.schedule_exceptions enable row level security;
-- No anon/authenticated policies: owner operations are implemented with authorization in B5.
revoke all on public.barbers, public.services, public.business_settings, public.working_hours, public.schedule_exceptions from anon, authenticated;
