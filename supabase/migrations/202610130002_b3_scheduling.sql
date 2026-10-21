-- B3: safe booking groundwork. Execute in Supabase SQL Editor after B1/B2.
-- No anonymous INSERT/UPDATE privileges. Stripe confirmation will be server-controlled in a later build.
create extension if not exists btree_gist;
create table if not exists public.appointments (
 id uuid primary key default gen_random_uuid(),
 barber_id uuid not null references public.barbers(id),
 service_id uuid not null references public.services(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'pending_payment' check (status in ('pending_payment','confirmed','cancelled','expired','completed','no_show')),
 customer_name text not null check (length(trim(customer_name)) between 1 and 150),
 customer_email text not null,
 customer_phone text not null,
 deposit_cents integer not null default 1000 check (deposit_cents = 1000),
 total_cents integer not null check (total_cents >= deposit_cents),
 payment_reference text unique,
 created_at timestamptz not null default now(),
 check (starts_at < ends_at)
);
create index if not exists appointments_barber_start_idx on public.appointments(barber_id,starts_at);
-- Database-level overlap prevention, including concurrent requests.
do $$ begin
 if not exists(select 1 from pg_constraint where conname='appointments_no_overlapping_active_slots') then
  alter table public.appointments add constraint appointments_no_overlapping_active_slots exclude using gist (barber_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where (status in ('pending_payment','confirmed'));
 end if;
end $$;
alter table public.appointments enable row level security;
revoke all on public.appointments from anon,authenticated;
-- Do not turn bookings_enabled on until service prices, hours, and Stripe are ready.
