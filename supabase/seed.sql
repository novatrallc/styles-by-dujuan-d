-- B4.1.3: LOCAL development seed. Never run against hosted production.
-- PostgreSQL EXTRACT(DOW): Sunday=0, Monday=1, ..., Saturday=6.
-- Idempotent: inserts only missing weekly windows; preserves owner-edited hours.
DO $$
DECLARE v_barber uuid; v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.barbers WHERE is_active = true;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one active barber, found %. Seed aborted.', v_count;
  END IF;
  SELECT id INTO v_barber FROM public.barbers WHERE is_active = true;
  INSERT INTO public.working_hours (barber_id, weekday, start_time, end_time)
  SELECT v_barber, h.weekday, h.start_time::time, h.end_time::time
  FROM (VALUES
    (0, '11:00', '18:00'),
    (1, '10:00', '19:00'),
    (2, '10:00', '19:00'),
    (3, '10:00', '19:00'),
    (4, '10:00', '19:00'),
    (5, '10:00', '19:00'),
    (6, '08:00', '18:00')
  ) AS h(weekday, start_time, end_time)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.working_hours w
    WHERE w.barber_id = v_barber AND w.weekday = h.weekday
  );
END $$;
-- This intentionally does NOT enable bookings, change prices, or create appointments.
