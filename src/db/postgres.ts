import { Pool } from 'pg';
import type { AvlRecord } from '../types/fleet.js';

export const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  connectionTimeoutMillis: 10000,
}) : null;

export async function initPostgres() {
  if (!pool) {
    console.warn('[Postgres] DATABASE_URL missing; JSON compatibility mode');
    return;
  }
  await pool.query(`
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
  `);
  console.log('[Postgres] Schema initialized');
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
