-- ZainFleet PostgreSQL schema. Safe to run repeatedly.
BEGIN;
CREATE TABLE IF NOT EXISTS public.fleet_identity_state (
 id integer PRIMARY KEY CHECK (id=1),
 users jsonb NOT NULL DEFAULT '[]'::jsonb,
 companies jsonb NOT NULL DEFAULT '[]'::jsonb,
 assignments jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.fleet_system_admin (
 username text PRIMARY KEY,
 salt text NOT NULL,
 password_hash text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tracker_devices (
 imei varchar(15) PRIMARY KEY,
 first_seen timestamptz NOT NULL DEFAULT now(),
 last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tracker_telemetry (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 imei varchar(15) NOT NULL REFERENCES public.tracker_devices(imei),
 gps_time timestamptz NOT NULL,
 received_at timestamptz NOT NULL,
 latitude double precision NOT NULL,
 longitude double precision NOT NULL,
 speed_kmh integer NOT NULL,
 satellites integer NOT NULL,
 record jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tracker_imei_gps_time ON public.tracker_telemetry(imei,gps_time DESC);
COMMIT;
SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;
