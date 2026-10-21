-- B2: Update seeded barber identity only; do not modify booking configuration.
-- This assumes the seed UUID is still the original B1 barber record.
update public.barbers set display_name = 'Dujuan Dublin'
where id = '00000000-0000-4000-8000-000000000001' and display_name = 'Jemal Burton';
