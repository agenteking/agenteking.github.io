-- Supabase: la Data API (PostgREST, claves anon/authenticated) no debe ver nada de este schema.
-- RLS activo SIN políticas = nadie lee ni escribe por la Data API; la Edge Function y Prisma conectan
-- directo a Postgres como el dueño de las tablas (postgres), al que RLS no le aplica.
-- Corre sobre el schema de la migración (?schema=… / search_path), así sirve igual para selkis y selkis_test.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Service', 'Professional', 'BusinessHour', 'Booking', 'BookingEvent', '_ProfessionalToService', '_prisma_migrations']
  LOOP
    IF to_regclass(format('%I.%I', current_schema(), t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', current_schema(), t);
    END IF;
  END LOOP;
  -- Por si alguien expone el schema en la Data API: anon/authenticated ni siquiera lo pueden usar.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE format('REVOKE ALL ON SCHEMA %I FROM anon, authenticated', current_schema());
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM anon, authenticated', current_schema());
  END IF;
END $$;
