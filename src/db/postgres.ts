import { Pool } from 'pg';
import type { AvlRecord } from '../types/fleet.js';

export const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  connectionTimeoutMillis: 10000,
}) : null;

export async function initPostgres() {
  if (!pool) {
    throw new Error('DATABASE_URL is missing in ZainFleet service Variables. Set it to the Postgres service reference before deployment.');
  }
  const connected = await pool.query('SELECT current_database() AS database_name, current_schema() AS schema_name');
  console.log('[Postgres] Connected database:', connected.rows[0].database_name, 'schema:', connected.rows[0].schema_name);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fleet_identity_state (
      id integer PRIMARY KEY CHECK (id=1),
      users jsonb NOT NULL DEFAULT '[]'::jsonb,
      companies jsonb NOT NULL DEFAULT '[]'::jsonb,
      assignments jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS fleet_system_admin (
      username text PRIMARY KEY,
      salt text NOT NULL,
      password_hash text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS tracker_devices (
      imei varchar(15) PRIMARY KEY,
      first_seen timestamptz NOT NULL DEFAULT now(),
      last_seen timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS tracker_telemetry (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      imei varchar(15) NOT NULL REFERENCES tracker_devices(imei),
      gps_time timestamptz NOT NULL,
      received_at timestamptz NOT NULL,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      speed_kmh integer NOT NULL,
      satellites integer NOT NULL,
      record jsonb NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tracker_imei_gps_time
      ON tracker_telemetry (imei, gps_time DESC);

    CREATE TABLE IF NOT EXISTS fleet_maintenance_plans (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      imei varchar(15) NOT NULL REFERENCES tracker_devices(imei),
      title text NOT NULL,
      due_at timestamptz,
      due_odometer_km numeric(14,2) CHECK (due_odometer_km >= 0),
      due_engine_hours numeric(14,2) CHECK (due_engine_hours >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (due_at IS NOT NULL OR due_odometer_km IS NOT NULL OR due_engine_hours IS NOT NULL)
    );
    CREATE TABLE IF NOT EXISTS fleet_work_orders (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      imei varchar(15) NOT NULL REFERENCES tracker_devices(imei),
      plan_id bigint REFERENCES fleet_maintenance_plans(id),
      title text NOT NULL,
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
      technician text,
      notes text,
      labor_cost numeric(14,3) NOT NULL DEFAULT 0 CHECK (labor_cost >= 0),
      currency char(3) NOT NULL DEFAULT 'LYD',
      opened_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS fleet_work_order_parts (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      work_order_id bigint NOT NULL REFERENCES fleet_work_orders(id),
      part_name text NOT NULL,
      quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
      unit_cost numeric(14,3) NOT NULL CHECK (unit_cost >= 0)
    );
    CREATE TABLE IF NOT EXISTS fleet_diagnostic_events (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      imei varchar(15) NOT NULL REFERENCES tracker_devices(imei),
      observed_at timestamptz NOT NULL,
      source text NOT NULL CHECK (source IN ('device','manual','rule')),
      code text,
      severity text NOT NULL CHECK (severity IN ('info','warning','critical','unknown')),
      description text NOT NULL,
      evidence jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_plans_imei ON fleet_maintenance_plans(imei);
    CREATE INDEX IF NOT EXISTS idx_fleet_orders_imei ON fleet_work_orders(imei,status);
    CREATE INDEX IF NOT EXISTS idx_fleet_events_imei ON fleet_diagnostic_events(imei,observed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_fleet_parts_order ON fleet_work_order_parts(work_order_id);
  `);
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('fleet_identity_state','fleet_system_admin','tracker_devices','tracker_telemetry','fleet_maintenance_plans','fleet_work_orders','fleet_work_order_parts','fleet_diagnostic_events') ORDER BY table_name");
  console.log('[Postgres] Schema initialized; verified tables:', tables.rows.map(row => row.table_name).join(', '));
}

export async function persistAvlBatch(imei: string, records: AvlRecord[], receivedAt: string) {
  if (!pool || !records.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO tracker_devices (imei,last_seen) VALUES ($1,$2) ON CONFLICT (imei) DO UPDATE SET last_seen=EXCLUDED.last_seen',
      [imei, receivedAt]
    );
    // Insert records in chunks to stay within PostgreSQL parameter limits.
    for (let offset = 0; offset < records.length; offset += 500) {
      const batch = records.slice(offset, offset + 500);
      const values: unknown[] = [];
      const tuples = batch.map((r, i) => {
        const start = i * 8;
        values.push(imei, r.timestamp, receivedAt, r.latitude, r.longitude, r.speed, r.satellites, JSON.stringify(r));
        return '(' + Array.from({length:8}, (_,j) => '$' + (start+j+1)).join(',') + ')';
      });
      await client.query(
        'INSERT INTO tracker_telemetry (imei,gps_time,received_at,latitude,longitude,speed_kmh,satellites,record) VALUES ' + tuples.join(','),
        values
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
