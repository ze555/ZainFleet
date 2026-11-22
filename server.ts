import net from 'node:net';
import { initPostgres, persistAvlBatch, pool as postgresPool } from './src/db/postgres.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Request, Response } from 'express';
import cors from 'cors';
import {
  decodeTeltonikaFrame,
  createAvlAcknowledgement,
  createImeiResponse,
} from './src/protocol/packetParser.js';
import { tryParseImei } from './src/protocol/imeiParser.js';
import { hexStringToBytes } from './src/protocol/fixtures.js';
import { DeviceInfo, TelemetrySnapshot, AvlRecord } from './src/types/fleet.js';
import { segmentRecordsIntoTrips } from './src/utils/canBusDecoder.js';
import { diagnosticLogger } from './src/utils/diagnosticLogger.js';

// --- Persistent File Storage for Real Vehicle Telemetry ---
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class PersistentDeviceRepository {
  private devices = new Map<string, DeviceInfo>();
  private filePath = path.join(DATA_DIR, 'devices.json');

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: DeviceInfo[] = JSON.parse(raw);
        for (const d of list) {
          // Devices start marked disconnected until TCP socket connects
          this.devices.set(d.imei, { ...d, connected: false });
        }
      }
    } catch (e) {
      console.warn('[Storage] Notice loading devices:', e);
    }
  }

  private save() {
    try {
      const list = Array.from(this.devices.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Storage] Notice saving devices:', e);
    }
  }

  upsert(imei: string, seenAt: string, connected: boolean, lastGpsAt?: string, receivedAvl = false): DeviceInfo {
    const existing = this.devices.get(imei);
    const tcpConnected = connected;
    const lastPacket = receivedAvl ? seenAt : (existing?.lastPacketAt || '');
    const recentlyReceived = lastPacket !== '' && Date.now() - new Date(lastPacket).getTime() < 15 * 60 * 1000;
    const connectionStatus: 'online' | 'standby' | 'offline' = connected ? 'online' : recentlyReceived ? 'standby' : 'offline';
    const updated: DeviceInfo = {
      imei,
      name: existing?.name,
      firstSeen: existing ? existing.firstSeen : seenAt,
      lastSeen: connected || receivedAvl ? seenAt : (existing?.lastSeen || seenAt),
      // Handshakes/disconnects are not AVL transmissions. Update only after decoded records arrive.
      lastPacketAt: receivedAvl ? seenAt : (existing?.lastPacketAt || ''),
      lastGpsAt: lastGpsAt || existing?.lastGpsAt,
      tcpConnected,
      connected,
      connectionStatus,
      totalRecords: existing?.totalRecords || 0,
      totalDistanceKm: existing?.totalDistanceKm || 0,
    };
    this.devices.set(imei, updated);
    this.save();
    return updated;
  }

  incrementRecords(imei: string, count: number): void {
    const d = this.devices.get(imei);
    if (d) {
      d.totalRecords = (d.totalRecords || 0) + count;
      this.save();
    }
  }

  get(imei: string): DeviceInfo | null {
    return this.devices.get(imei) ?? null;
  }

  getAll(): DeviceInfo[] {
    return Array.from(this.devices.values());
  }

  delete(imei: string): boolean {
    const res = this.devices.delete(imei);
    this.save();
    return res;
  }
}

class PersistentTelemetryRepository {
  private latest = new Map<string, TelemetrySnapshot>();
  private history = new Map<string, TelemetrySnapshot[]>();
  private readonly MAX_HISTORY = 10000;

  constructor() {
    this.loadAll();
  }

  private getHistoryPath(imei: string): string {
    return path.join(DATA_DIR, `telemetry_${imei}.json`);
  }

  private loadAll() {
    try {
      const files = fs.readdirSync(DATA_DIR);
      for (const file of files) {
        if (file.startsWith('telemetry_') && file.endsWith('.json')) {
          const imei = file.replace('telemetry_', '').replace('.json', '');
          const fullPath = path.join(DATA_DIR, file);
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const points: TelemetrySnapshot[] = JSON.parse(raw);
          if (Array.isArray(points) && points.length > 0) {
            this.history.set(imei, points);
            this.latest.set(imei, points[points.length - 1]);
          }
        }
      }
    } catch (e) {
      console.warn('[Storage] Notice loading telemetry history:', e);
    }
  }

  private saveHistory(imei: string) {
    try {
      const points = this.history.get(imei) || [];
      fs.writeFileSync(this.getHistoryPath(imei), JSON.stringify(points), 'utf-8');
    } catch (e) {
      console.warn(`[Storage] Notice saving telemetry for ${imei}:`, e);
    }
  }

  store(imei: string, record: AvlRecord, receivedAt: string): void {
    this.storeBatch(imei, [record], receivedAt);
  }

  // Write a complete decoded AVL packet once, instead of rewriting the
  // full history file for every record. Persistence still precedes ACK.
  storeBatch(imei: string, records: AvlRecord[], receivedAt: string): void {
    if (records.length === 0) return;
    const list = this.history.get(imei) || [];
    for (const record of records) {
      const snapshot: TelemetrySnapshot = { imei, record, receivedAt };
      list.push(snapshot);
      this.latest.set(imei, snapshot);
    }
    if (list.length > this.MAX_HISTORY) {
      list.splice(0, list.length - this.MAX_HISTORY);
    }
    this.history.set(imei, list);
    this.saveHistory(imei);
  }

  getLatest(imei: string): TelemetrySnapshot | null {
    return this.latest.get(imei) ?? null;
  }

  getHistory(imei: string, limit = 1000): TelemetrySnapshot[] {
    const list = this.history.get(imei) || [];
    if (list.length <= limit) return list;
    return list.slice(list.length - limit);
  }

  clearHistory(imei: string): void {
    this.history.delete(imei);
    this.latest.delete(imei);
    try {
      const p = this.getHistoryPath(imei);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}
  }
}

const deviceRepo = new PersistentDeviceRepository();
const telemetryRepo = new PersistentTelemetryRepository();

// PostgreSQL is the durable primary ingest store when DATABASE_URL is set.
// Startup fails on schema/connectivity errors rather than silently losing records.
async function restoreRegisteredDevices(){
 if(!postgresPool)return;
 const result=await postgresPool.query("SELECT d.imei,d.first_seen,d.last_seen,t.gps_time,t.received_at FROM tracker_devices d LEFT JOIN LATERAL (SELECT gps_time,received_at FROM tracker_telemetry WHERE imei=d.imei ORDER BY gps_time DESC LIMIT 1) t ON true");
 for(const d of result.rows){
 if(deviceRepo.get(d.imei))continue;
 deviceRepo.upsert(d.imei,new Date(d.first_seen).toISOString(),false);
 if(d.received_at)deviceRepo.upsert(d.imei,new Date(d.received_at).toISOString(),false,new Date(d.gps_time).toISOString(),true);
 }
}
const demoProfileNames=["عبدالله يوسف السنوسي","محمد سالم الورفلي","أحمد علي الزوي","خالد فرج المصراتي","محمود مفتاح الترهوني"];
async function updateDemoProfileNames(){
 if(!postgresPool)return;
 const changed:{user:FleetUser;displayName:string;driverName?:string}[]=[];
 for(let i=0;i<demoProfileNames.length;i++){
 const username=i===0?'demo.manager':'demo.driver'+i;
 const old=i===0?'مدير تجريبي':'سائق تجريبي '+i;
 const user=fleetUsers.find(u=>u.username===username&&u.demo===true&&u.companyId==='zf-demo-company-v1');
 if(!user||user.displayName!==old)continue;
 changed.push({user,displayName:user.displayName,driverName:user.driverName});
 user.displayName=demoProfileNames[i];
 if(!user.driverName||user.driverName===old)user.driverName=demoProfileNames[i];
 }
 if(!changed.length)return;
 try{await persistIdentityState();console.log('[Demo] Updated fictional profile names: '+changed.length);}
 catch(e){for(const c of changed){c.user.displayName=c.displayName;c.user.driverName=c.driverName;}throw e;}
}

async function seedDemoFleet(){
 if(!postgresPool||fleetCompanies.some(c=>c.id==='zf-demo-company-v1'))return;
 const password=process.env.DEMO_FLEET_PASSWORD;
 if(!password||password.length<12)return;
 const ids=['000000000000901','000000000000902','000000000000903','000000000000904'];
 const existing=await postgresPool.query('SELECT imei FROM tracker_devices WHERE imei=ANY($1::text[])',[ids]);
 if(existing.rowCount||fleetUsers.some(u=>['demo.manager','demo.driver1','demo.driver2','demo.driver3','demo.driver4'].includes(u.username)))return;
 const companyId='zf-demo-company-v1';
 const company:FleetCompany={id:companyId,name:'زين للنقل - تجريبي',enabled:true,sector:'logistics'};
 const make=(username:string,displayName:string,role:'company_admin'|'employee',devices:string[],i:number):FleetUser=>{const salt=crypto.randomBytes(16).toString('hex');return {username,displayName,role,devices,companyId,enabled:true,salt,hash:fleetPasswordHash(password,salt),demo:true,driverName:displayName,phone:'000000000'+i,chassisNumber:'DEMO-VIN-'+i,vehicleType:['','Toyota Fortuner','Hyundai Sonata','Kia Sportage','Toyota Hilux'][i]};};
 for(let i=0;i<ids.length;i++){
 const imei=ids[i],now=Date.now();
 const records:AvlRecord[]=Array.from({length:12},(_,j)=>({timestamp:new Date(now-(11-j)*60000).toISOString(),timestampMs:now-(11-j)*60000,priority:0,longitude:13.18+i*.025+j*.0005,latitude:32.88-i*.012+j*.0003,altitude:15,angle:90,satellites:10,speed:[42,58,0,35][i],eventIoId:0,ioElements:[{id:115,value:String([910,1080,880,960][i]),byteLength:2},{id:89,value:String([78,12,55,36][i]),byteLength:1},{id:239,value:'1',byteLength:1}]}));
 await persistAvlBatch(imei,records,new Date(now).toISOString());
 await postgresPool.query("INSERT INTO fleet_diagnostic_events(imei,observed_at,source,code,severity,description,evidence) VALUES($1,now(),'manual',$2,$3,$4,$5::jsonb)",[imei,['P0128','P0217','P0562','P0101'][i],i===1?'critical':'warning',['فحص حرارة التبريد','ارتفاع حرارة المحرك','فحص جهد البطارية','فحص تدفق الهواء'][i],JSON.stringify({demo:true})]);
 deviceCompanies[imei]=companyId;
 }
 fleetCompanies.push(company);
 fleetUsers.push(make('demo.manager',demoProfileNames[0],'company_admin',[],0),...ids.map((id,i)=>make('demo.driver'+(i+1),demoProfileNames[i+1],'employee',[id],i+1)));
 await persistIdentityState();
 console.log('[Demo] Demo company initialized');
}
async function enrichDemoFaults(){
 if(!postgresPool||!fleetCompanies.some(c=>c.id==='zf-demo-company-v1'))return;
 const faults=[
 ['000000000000901','P0524','critical','انخفاض ضغط زيت المحرك'],
 ['000000000000901','P0300','critical','خلل احتراق عشوائي'],
 ['000000000000901','P0130','warning','خلل حساس الأكسجين'],
 ['000000000000901','P0420','warning','انخفاض كفاءة المحول الحفاز'],
 ['000000000000902','P0087','critical','انخفاض ضغط الوقود'],
 ['000000000000902','P0171','warning','خليط وقود فقير'],
 ['000000000000902','P0301','warning','خلل احتراق الأسطوانة الأولى'],
 ['000000000000903','P0563','warning','ارتفاع جهد النظام'],
 ['000000000000903','P0700','warning','خلل نظام التحكم بناقل الحركة'],
 ['000000000000903','P0500','warning','خلل حساس سرعة المركبة'],
 ['000000000000904','P0335','warning','خلل دائرة حساس عمود الكرنك'],
 ['000000000000904','P0401','warning','تدفق EGR غير كاف'],
 ['000000000000904','P0172','warning','خليط وقود غني']
 ];
 const client=await postgresPool.connect();
 try{
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(731902)');
 let added=0;
 for(const [imei,code,severity,description] of faults){
 if(deviceCompanies[imei]!=='zf-demo-company-v1'||!fleetUsers.some(u=>u.demo&&u.companyId==='zf-demo-company-v1'&&u.devices.includes(imei)))continue;
 const result=await client.query(`INSERT INTO fleet_diagnostic_events(imei,observed_at,source,code,severity,description,evidence)
 SELECT $1::varchar(15),now(),'manual',$2::text,$3::text,$4::text,$5::jsonb
 WHERE EXISTS(SELECT 1 FROM tracker_devices WHERE imei=$1)
 AND NOT EXISTS(SELECT 1 FROM fleet_diagnostic_events WHERE imei=$1 AND code=$2 AND evidence->>'demo'='true')`,[imei,code,severity,description,JSON.stringify({demo:true,scenario:'fault-demo-v2'})]);
 added+=result.rowCount||0;
 }
 await client.query('COMMIT');
 console.log('[Demo] Additional diagnostic events inserted: '+added);
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
async function normalizeDemoFaultLabels(){
 if(!postgresPool)return;
 const ids=Object.keys(deviceCompanies).filter(imei=>deviceCompanies[imei]==='zf-demo-company-v1');
 if(!ids.length)return;
 const r=await postgresPool.query("UPDATE fleet_diagnostic_events SET description=regexp_replace(description, '^محاكاة تجريبية - ', '') WHERE imei=ANY($1::text[]) AND evidence->>'demo'='true' AND description LIKE 'محاكاة تجريبية - %'",[ids]);
 console.log('[Demo] Normalized diagnostic labels: '+r.rowCount);
}
const postgresReady=initPostgres().then(loadIdentityState).then(()=>seedDemoFleet().catch(e=>console.error('[Demo] Seed failed',e))).then(()=>updateDemoProfileNames().catch(e=>console.error('[Demo] Profile update failed',e))).then(()=>enrichDemoFaults().catch(e=>console.error('[Demo] Fault seed failed',e))).then(()=>normalizeDemoFaultLabels().catch(e=>console.error('[Demo] Label update failed',e))).then(restoreRegisteredDevices).catch(err => { console.error('[Postgres] Startup failed:', err); process.exit(1); throw err; });

// --- Teltonika TCP Server (raw TCP socket) ---
// Separate internal listeners: FMB140 TCP on 5000, web/API on 8080.
// Railway PORT can be 5000 for the TCP proxy; HTTP_PORT controls the website.
const TCP_PORT = Number(process.env.TCP_PORT || 5000);
const HTTP_PORT = Number(process.env.HTTP_PORT || 8080);
if (![TCP_PORT, HTTP_PORT].every(p => Number.isInteger(p) && p > 0 && p <= 65535) || TCP_PORT === HTTP_PORT) {
  throw new Error('Invalid port setup: TCP_PORT and HTTP_PORT must be distinct valid ports.');
}
console.log(`[Ports] Teltonika TCP :${TCP_PORT} | Web HTTP :${HTTP_PORT}`);
const TCP_IDLE_TIMEOUT_MS = parseInt(process.env.TCP_IDLE_TIMEOUT_SECONDS || '4200', 10) * 1000;
const TCP_MAX_PACKET_BYTES = parseInt(process.env.TCP_MAX_PACKET_BYTES || '1048576', 10);

let tcpConnectionsSinceStart = 0;
let lastTcpConnectionAt: string | null = null;
let lastAvlPacketAt: string | null = null;
type TcpFailureCode = 'HANDSHAKE_INVALID' | 'PACKET_INVALID' | 'PACKET_DECODE_FAILED' | 'TIMEOUT' | 'SOCKET_ERROR';
let lastTcpFailure: { code: TcpFailureCode; message: string; at: string } | null = null;
const tcpFailureCounts: Record<TcpFailureCode, number> = {
  HANDSHAKE_INVALID: 0, PACKET_INVALID: 0, PACKET_DECODE_FAILED: 0, TIMEOUT: 0, SOCKET_ERROR: 0
};
function recordTcpFailure(code: TcpFailureCode, message: string) {
  lastTcpFailure = { code, message, at: new Date().toISOString() };
  tcpFailureCounts[code] += 1;
  console.warn(`[TCP DIAGNOSTIC] ${code}: ${message}`);
}

const activeDeviceSockets = new Map<string, Set<net.Socket>>();
const tcpServer = net.createServer((socket) => {
  tcpConnectionsSinceStart += 1;
  lastTcpConnectionAt = new Date().toISOString();
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[TCP] DEVICE CONNECTED ${remote}`);

  // Disable Nagle algorithm to immediately flush 1-byte handshake and 4-byte ACK
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 15000);

  let imei: string | null = null;
  let buffer = Buffer.alloc(0);
  let handshakeDone = false;
  let persistenceQueue: Promise<void> = Promise.resolve();

  socket.setTimeout(TCP_IDLE_TIMEOUT_MS);

  socket.on('timeout', () => {
    recordTcpFailure('TIMEOUT', `TCP session timed out (IMEI=${imei || 'unknown'})`);
    socket.destroy();
  });

  socket.on('data', (chunk) => {
    console.log(
      `[TCP RAW IN] ${remote} (IMEI=${imei || 'pending'}): ${chunk.length} bytes (hex: ${chunk.toString('hex').slice(0, 48)}${chunk.length > 24 ? '...' : ''})`
    );
    // FMB140 can send 0xFF as a TCP keepalive between AVL frames.
    // Ignore it only when no AVL frame is being assembled.
    if (handshakeDone && buffer.length === 0 && chunk.length === 1 && chunk[0] === 0xff) {
      console.log(`[TCP] FMB140 keepalive from ${imei}`);
      return;
    }
    buffer = Buffer.concat([buffer, chunk]);

    try {
      if (!handshakeDone) {
        // Handshake: 2 bytes length + 15 ASCII bytes IMEI
        if (buffer.length < 2) return;
        const imeiLength = buffer.readUInt16BE(0);
        if (imeiLength !== 15) {
          recordTcpFailure('HANDSHAKE_INVALID', `Invalid IMEI length: ${imeiLength}`);
          socket.write(Buffer.from(createImeiResponse(false)));
          socket.destroy();
          return;
        }

        if (buffer.length < 2 + 15) return;
        const imeiBytes = buffer.subarray(2, 17);
        const parsed = tryParseImei(imeiBytes);
        if (!parsed) {
          recordTcpFailure('HANDSHAKE_INVALID', 'Invalid IMEI digits');
          socket.write(Buffer.from(createImeiResponse(false)));
          socket.destroy();
          return;
        }

        imei = parsed;
        handshakeDone = true;
        buffer = buffer.subarray(17);

        const active = activeDeviceSockets.get(imei) ?? new Set<net.Socket>();
        active.add(socket);
        activeDeviceSockets.set(imei, active);
        deviceRepo.upsert(imei, new Date().toISOString(), true);
        console.log(`[TCP] DEVICE IMEI ${imei} connected from ${remote}`);
        const acceptResp = Buffer.from(createImeiResponse(true));
        socket.write(acceptResp, (err) => {
          if (err) console.error(`[TCP] Failed to write IMEI accept 0x01:`, err);
          else console.log(`[TCP] Sent IMEI ACCEPT (0x01) to ${imei}`);
        });
      }

      // Read AVL packets from stream
      while (buffer.length >= 8) {
        // Preamble: 4 zero bytes
        const p0 = buffer.readUInt32BE(0);
        if (p0 !== 0) {
          recordTcpFailure('PACKET_INVALID', `Invalid AVL packet preamble (length=${buffer.length})`);
          socket.destroy();
          return;
        }

        const dataLength = buffer.readUInt32BE(4);
        if (dataLength < 3 || dataLength > TCP_MAX_PACKET_BYTES) {
          recordTcpFailure('PACKET_INVALID', `Invalid AVL data length: ${dataLength}`);
          socket.destroy();
          return;
        }

        const totalPacketLength = 8 + dataLength + 4;
        if (buffer.length < totalPacketLength) {
          console.log(`[TCP] Waiting for full packet: have ${buffer.length}/${totalPacketLength} bytes`);
          break;
        }

        const packetBytes = buffer.subarray(0, totalPacketLength);
        buffer = buffer.subarray(totalPacketLength);

        const decoded = decodeTeltonikaFrame(new Uint8Array(packetBytes));
        console.log(
          `[TCP] PACKET RECEIVED ${imei}: ${decoded.records.length} records (Codec 0x${decoded.codecId.toString(16).toUpperCase()})`
        );

        // Record to comprehensive FMB140 diagnostic packet log
        try {
          diagnosticLogger.recordPacket(
            imei || 'pending_handshake',
            socket.remoteAddress || 'unknown',
            socket.remotePort || 0,
            new Uint8Array(packetBytes),
            decoded
          );
        } catch (diagErr) {
          console.warn('[TCP] Diagnostic logging error:', diagErr);
        }

        const seenIso = new Date().toISOString();
        const packetImei = imei;
        const records = decoded.records;
        // Serialize writes and ACKs per TCP session; acknowledge only after durable insert.
        persistenceQueue = persistenceQueue.then(async () => {
          if (packetImei && postgresPool) {
            await persistAvlBatch(packetImei, records, seenIso);
          }
          lastAvlPacketAt = seenIso;
          if (packetImei) {
            let latestGpsTime = '';
            // Keep legacy API reads working during the PostgreSQL migration.
            telemetryRepo.storeBatch(packetImei, records, seenIso);
            for (const rec of records) {
              if (rec.timestamp) latestGpsTime = rec.timestamp;
            }
            deviceRepo.incrementRecords(packetImei, records.length);
            deviceRepo.upsert(packetImei, seenIso, true, latestGpsTime || undefined, true);
          }
          const ack = Buffer.from(createAvlAcknowledgement(records.length));
          if (!socket.destroyed) {
            socket.write(ack, err => {
              if (err) console.error('[TCP] ACK failed:', err);
              else console.log(`[TCP] PACKET ACK sent to ${packetImei}: ${records.length} records`);
            });
          }
        }).catch(err => {
          recordTcpFailure('PACKET_DECODE_FAILED', 'Persistence failed: ' + String(err));
          console.error('[TCP] Database persistence failed; no ACK sent:', err);
          socket.destroy();
        });
      }
    } catch (err) {
      recordTcpFailure('PACKET_DECODE_FAILED', err instanceof Error ? err.message : String(err));
      console.error(`[TCP] Error processing data from ${remote}:`, err);
      socket.destroy();
    }
  });

  socket.on('close', (hadError) => {
    if (imei) {
      const active = activeDeviceSockets.get(imei);
      active?.delete(socket);
      if (!active || active.size === 0) {
        activeDeviceSockets.delete(imei);
        deviceRepo.upsert(imei, new Date().toISOString(), false);
      }
      console.log(`[TCP] DEVICE DISCONNECTED ${imei} (hadError=${hadError}, bufferRemaining=${buffer.length})`);
    } else {
      console.log(`[TCP] DEVICE DISCONNECTED ${remote} (hadError=${hadError}, bufferRemaining=${buffer.length})`);
    }
  });

  socket.on('error', (err) => {
    recordTcpFailure('SOCKET_ERROR', err.message);
    console.error(`[TCP] Socket error from ${remote}:`, err.message);
  });
});

// The TCP listener is essential: do not report a healthy deployment when it fails.
let tcpListenerReady = false;
tcpServer.on('error', (err: Error) => {
  tcpListenerReady = false;
  console.error(`[TCP FATAL] Failed to listen on port ${TCP_PORT}: ${err.message}`);
  process.exitCode = 1;
  // End process so Railway restarts the service and surfaces the failure.
  setImmediate(() => process.exit(1));
});
tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
  tcpListenerReady = true;
  console.log(`Teltonika TCP listener started on 0.0.0.0:${TCP_PORT}`);
});

// --- HTTP Management & API Server ---
const app = express();
app.use(cors());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});
app.use(express.json());

// Tenant-aware authorization. Tracker TCP ingestion stays independent of browser sessions.
type FleetRole = 'admin' | 'company_admin' | 'employee' | 'user';
type CompanySector = 'rental'|'logistics'|'school'|'general';
type FleetCompany = {id:string;name:string;enabled:boolean;sector?:CompanySector};
type FleetUser = {username:string;displayName:string;salt:string;hash:string;devices:string[];enabled:boolean;role?:'company_admin'|'employee'|'user';companyId?:string|null;phone?:string;email?:string;vehicleType?:string;plateNumber?:string;chassisNumber?:string;driverName?:string;demo?:boolean};
const USERS_PATH = path.join(DATA_DIR,'fleet_users.json');
const COMPANIES_PATH = path.join(DATA_DIR,'fleet_companies.json');
const ASSIGNMENTS_PATH = path.join(DATA_DIR,'fleet_device_companies.json');
function loadJson<T>(filename:string, fallback:T):T {try{return JSON.parse(fs.readFileSync(filename,'utf8')) as T;}catch{return fallback;}}
let fleetUsers=loadJson<FleetUser[]>(USERS_PATH,[]).filter(u=>u&&typeof u.username==='string');
let fleetCompanies=loadJson<FleetCompany[]>(COMPANIES_PATH,[]).filter(c=>c&&typeof c.id==='string');
let deviceCompanies=loadJson<Record<string,string>>(ASSIGNMENTS_PATH,{});
function saveJson(filename:string,value:unknown) {
  const temp=filename+'.tmp';
  fs.writeFileSync(temp,JSON.stringify(value,null,2),{encoding:'utf8',mode:0o600});
  fs.renameSync(temp,filename);
}
let adminFromDatabase:{username:string;salt:string;hash:string}|null=null;
async function persistIdentityState(){
 if(!postgresPool){throw new Error('DATABASE_URL required for user management');}
 await postgresPool.query(`INSERT INTO fleet_identity_state(id,users,companies,assignments,updated_at)
 VALUES(1,$1::jsonb,$2::jsonb,$3::jsonb,now())
 ON CONFLICT(id) DO UPDATE SET users=EXCLUDED.users,companies=EXCLUDED.companies,assignments=EXCLUDED.assignments,updated_at=now()`,[JSON.stringify(fleetUsers),JSON.stringify(fleetCompanies),JSON.stringify(deviceCompanies)]);
}
async function loadIdentityState(){
 if(!postgresPool) return;
 const {rows}=await postgresPool.query('SELECT users,companies,assignments FROM fleet_identity_state WHERE id=1');
 if(rows.length){
  fleetUsers=rows[0].users;
  fleetCompanies=rows[0].companies;
  deviceCompanies=rows[0].assignments;
 }else{
  // One-time import of existing users, companies and assignments.
  await persistIdentityState();
 }
 const admins=await postgresPool.query('SELECT username,salt,password_hash FROM fleet_system_admin WHERE username=$1',['Admin']);
 if(admins.rows.length){
  adminFromDatabase={username:admins.rows[0].username,salt:admins.rows[0].salt,hash:admins.rows[0].password_hash};
 }else{
  const salt=crypto.randomBytes(16).toString('hex');
  const password=process.env.ADMIN_PASSWORD||'123456';
  const hash=fleetPasswordHash(password,salt);
  await postgresPool.query('INSERT INTO fleet_system_admin(username,salt,password_hash) VALUES($1,$2,$3) ON CONFLICT(username) DO NOTHING',['Admin',salt,hash]);
  const saved=await postgresPool.query('SELECT username,salt,password_hash FROM fleet_system_admin WHERE username=$1',['Admin']);
  adminFromDatabase={username:saved.rows[0].username,salt:saved.rows[0].salt,hash:saved.rows[0].password_hash};
  console.warn('[Security] Admin initialized; change the initial password immediately.');
 }
 console.log('[Postgres] Users, companies and assignments loaded from PostgreSQL');
}
const saveFleetUsers=()=>persistIdentityState();
const saveCompanies=()=>persistIdentityState();
const saveAssignments=()=>persistIdentityState();
function fleetPasswordHash(pass:string,salt:string):string {return crypto.scryptSync(pass,salt,64).toString('hex');}
function sessionIdentity(req:Request):{user:string;role:FleetRole;companyId:string|null}|null {
 const cookie=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('zf_session='));
 if(!cookie)return null;
 const token=cookie.slice('zf_session='.length),dot=token.lastIndexOf('.');
 if(dot<0)return null;
 const payload=token.slice(0,dot),signature=token.slice(dot+1);
 const expected=crypto.createHmac('sha256',AUTH_SECRET).update(payload).digest();
 let supplied:Buffer;
 try{supplied=Buffer.from(signature,'base64url');}catch{return null;}
 if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return null;
 try{
  const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  if(typeof data.expires!=='number'||data.expires<Date.now())return null;
  if(data.user===AUTH_USER&&data.role==='admin') { if(!adminFromDatabase || data.passwordVersion!==adminFromDatabase.hash) return null; return {user:AUTH_USER,role:'admin',companyId:null}; }
  const managed=fleetUsers.find(u=>u.username===data.user&&u.enabled);
  if(!managed||data.role!==(managed.role||'user')||data.passwordVersion!==managed.hash)return null;
  if(managed.companyId && !fleetCompanies.some(c=>c.id===managed.companyId&&c.enabled))return null;
  return {user:managed.username,role:managed.role||'user',companyId:managed.companyId||null};
 }catch{return null;}
}
function fleetAccess(req:Request,imei:string):boolean {
 const identity=sessionIdentity(req);
 if(!identity)return false;
 if(identity.role==='admin')return true;
 const user=fleetUsers.find(u=>u.username===identity.user&&u.enabled);
 if(!user)return false;
 if(identity.companyId){
  if(deviceCompanies[imei]!==identity.companyId)return false;
  return identity.role==='company_admin'||user.devices.includes(imei);
 }
 // Backward-compatible legacy users with pre-existing device grants.
 return (identity.role==='user'||identity.role==='employee')&&user.devices.includes(imei)&&!deviceCompanies[imei];
}
function visibleDevices(req:Request):DeviceInfo[]{return deviceRepo.getAll().filter(d=>fleetAccess(req,d.imei)).map(d=>deviceCompanies[d.imei]==='zf-demo-company-v1'?{...d,name:(fleetUsers.find(u=>u.companyId==='zf-demo-company-v1'&&u.devices.includes(d.imei)&&u.vehicleType)?.vehicleType||d.imei),connected:false,tcpConnected:false,connectionStatus:'offline'}:d);}
function managerScope(req:Request):{user:string;role:FleetRole;companyId:string|null}|null {
 const identity=sessionIdentity(req);
 return identity&&(identity.role==='admin'||identity.role==='company_admin')?identity:null;
}
// HTTP dashboard authentication only. The raw Teltonika TCP listener remains independent.
const AUTH_USER = process.env.ADMIN_USERNAME || 'Admin';
const AUTH_PASSWORD = process.env.ADMIN_PASSWORD || '123456'; // Demo only: override on Railway.
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const AUTH_TTL_MS = 8 * 60 * 60 * 1000;
const failedLogins = new Map<string, { count: number; until: number }>();
function makeToken(username = AUTH_USER, role: FleetRole = 'admin') {
  const passwordVersion = role === 'admin' ? adminFromDatabase?.hash : fleetUsers.find(u=>u.username===username)?.hash;
  const payload = Buffer.from(JSON.stringify({ user: username, role, passwordVersion, expires: Date.now() + AUTH_TTL_MS })).toString('base64url');
  const mac = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return payload + '.' + mac;
}
function authenticated(req: Request): boolean { return sessionIdentity(req) !== null; }

function sessionCookie(value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `zf_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}
app.post('/api/auth/login', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const state = failedLogins.get(ip);
  if (state && state.count >= 5 && now < state.until) {
    res.status(429).json({ error: 'محاولات كثيرة، حاول بعد 15 دقيقة' });
    return;
  }
  const user = typeof req.body?.username === 'string' ? req.body.username : '';
  const pass = typeof req.body?.password === 'string' ? req.body.password : '';
  const isAdmin = user === AUTH_USER;
  const managed = fleetUsers.find(u => u.username === user && u.enabled);
  const adminActual = crypto.createHash('sha256').update(pass).digest();
  const adminExpected = crypto.createHash('sha256').update(AUTH_PASSWORD).digest();
  const adminOk = isAdmin && (adminFromDatabase ? crypto.timingSafeEqual(Buffer.from(fleetPasswordHash(pass,adminFromDatabase.salt),'hex'),Buffer.from(adminFromDatabase.hash,'hex')) : crypto.timingSafeEqual(adminActual, adminExpected));
  const managedOk = !isAdmin && !!managed && /^[a-f0-9]{128}$/.test(managed.hash) &&
    crypto.timingSafeEqual(Buffer.from(fleetPasswordHash(pass, managed.salt), 'hex'), Buffer.from(managed.hash, 'hex'));
  if (!adminOk && !managedOk) {
    const fresh = !state || now >= state.until;
    failedLogins.set(ip, { count: (fresh ? 0 : state.count) + 1, until: now + 15 * 60 * 1000 });
    res.status(401).json({ error: 'اسم الدخول أو كلمة المرور غير صحيحة' });
    return;
  }
  failedLogins.delete(ip);
  res.setHeader('Set-Cookie', sessionCookie(makeToken(adminOk ? AUTH_USER : managed!.username, adminOk ? 'admin' : (managed!.role||'user')), AUTH_TTL_MS / 1000));
  res.json({ authenticated:true, username:adminOk?AUTH_USER:managed!.username, displayName:adminOk?'محمد زين':managed!.displayName, role:adminOk?'admin':(managed!.role||'user'), companyId:adminOk?null:(managed!.companyId||null) });
});
app.get('/api/auth/session', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const identity = sessionIdentity(req);
  res.json({ authenticated: !!identity, username: identity?.user, role: identity?.role, displayName: identity?.role === 'admin' ? 'محمد زين' : fleetUsers.find(u => u.username === identity?.user)?.displayName, companyId: identity?.companyId || null });
});
app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.json({ authenticated: false });
});
// Account profile and self-service password change; no extra database tables needed.
app.get('/api/auth/profile', (req: Request, res: Response) => {
  res.setHeader('Cache-Control','no-store');
  const actor=sessionIdentity(req);
  if(!actor){res.status(401).json({error:'يجب تسجيل الدخول'});return;}
  if(actor.role==='admin'){res.json({username:actor.user,displayName:'مدير النظام',role:actor.role,companyName:null,email:'',phone:''});return;}
  const user=fleetUsers.find(u=>u.username===actor.user&&u.enabled);
  if(!user){res.sendStatus(404);return;}
  res.json({username:user.username,displayName:user.displayName,role:actor.role,companyName:fleetCompanies.find(c=>c.id===user.companyId)?.name||null,email:user.email||'',phone:user.phone||'',vehicleType:user.vehicleType||''});
});
app.post('/api/auth/change-password', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control','no-store');
  const actor=sessionIdentity(req);
  if(!actor){res.status(401).json({error:'يجب تسجيل الدخول'});return;}
  const current=req.body?.currentPassword;
  const next=req.body?.newPassword;
  if(typeof current!=='string'||typeof next!=='string'||next.length<10||next.length>128||current===next){
    res.status(400).json({error:'كلمة المرور الجديدة يجب أن تكون مختلفة وبطول 10 إلى 128 حرفاً'});return;
  }
  try{
    if(actor.role==='admin'){
      if(!adminFromDatabase||!postgresPool){res.sendStatus(503);return;}
      const expected=Buffer.from(adminFromDatabase.hash,'hex');
      const actual=Buffer.from(fleetPasswordHash(current,adminFromDatabase.salt),'hex');
      if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual)){res.status(400).json({error:'كلمة المرور الحالية غير صحيحة'});return;}
      const salt=crypto.randomBytes(16).toString('hex');
      const hash=fleetPasswordHash(next,salt);
      await postgresPool.query('UPDATE fleet_system_admin SET salt=$1,password_hash=$2 WHERE username=$3',[salt,hash,adminFromDatabase.username]);
      adminFromDatabase={...adminFromDatabase,salt,hash};
    }else{
      const user=fleetUsers.find(u=>u.username===actor.user&&u.enabled);
      if(!user){res.sendStatus(404);return;}
      const expected=Buffer.from(user.hash,'hex');
      const actual=Buffer.from(fleetPasswordHash(current,user.salt),'hex');
      if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual)){res.status(400).json({error:'كلمة المرور الحالية غير صحيحة'});return;}
      const salt=crypto.randomBytes(16).toString('hex');
      const hash=fleetPasswordHash(next,salt);
      const updated=fleetUsers.map(u=>u.username===user.username?{...u,salt,hash}:u);
      if(!postgresPool){res.sendStatus(503);return;}
      await postgresPool.query(`UPDATE fleet_identity_state SET users=$1::jsonb,updated_at=now() WHERE id=1`,[JSON.stringify(updated)]);
      fleetUsers=updated;
    }
    // Existing sessions automatically expire because their passwordVersion no longer matches.
    res.setHeader('Set-Cookie',sessionCookie('',0));
    res.json({success:true,message:'تم تغيير كلمة المرور. سجّل الدخول بالكلمة الجديدة.'});
  }catch(err){console.error('[Auth] Password change failed:',err);res.status(500).json({error:'تعذر حفظ كلمة المرور في قاعدة البيانات'});}
});
// Protect API telemetry, diagnostic downloads and mutation routes from unauthenticated browsers.
app.use('/api', (req: Request, res: Response, next) => {
  if (!authenticated(req)) { res.status(401).json({ error: 'Authentication required' }); return; }
  next();
});

// Vehicle profiles can be created before the physical tracker first connects.
type VehicleProfile={name:string;model:string;driverName:string;plateNumber:string;phoneNumber:string};
const VEHICLE_PROFILES_PATH=path.join(DATA_DIR,'fleet_vehicle_profiles.json');
const vehicleProfiles=loadJson<Record<string,VehicleProfile>>(VEHICLE_PROFILES_PATH,{});
function profileScope(req:Request,imei:string):boolean {
 const actor=managerScope(req);
 if(!actor)return false;
 return actor.role==='admin'?true:deviceCompanies[imei]===actor.companyId;
}
app.get('/api/admin/available-imeis',(req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 res.setHeader('Cache-Control','no-store');
 const devices=deviceRepo.getAll().filter(d=>{
  if(!d.connected||vehicleProfiles[d.imei])return false;
  const owner=deviceCompanies[d.imei];
  return actor.role==='admin'?!owner:owner===actor.companyId;
 }).map(d=>({imei:d.imei,connected:d.connected,lastSeen:d.lastSeen||null}));
 res.json({devices});
});
app.get('/api/admin/vehicle-profiles',(req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 res.setHeader('Cache-Control','no-store');
 res.json({vehicles:deviceRepo.getAll().filter(d=>profileScope(req,d.imei)).map(d=>({imei:d.imei,connected:d.connected,profile:vehicleProfiles[d.imei]||null})),role:actor.role});
});
app.put('/api/admin/vehicle-profiles/:imei',async (req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 const imei=String(req.params.imei);
 if(!/^[0-9]{15}$/.test(imei)){res.status(400).json({error:'IMEI يجب أن يحتوي على 15 رقماً'});return;}
 if(!profileScope(req,imei)){res.sendStatus(403);return;}
 if(!deviceRepo.get(imei)||(!vehicleProfiles[imei]&&!deviceRepo.get(imei)?.connected)){res.status(400).json({error:'يجب اختيار جهاز متصل ومسجل في الخادم'});return;}
 const keys=['name','model','driverName','plateNumber','phoneNumber'] as const;
 const profile={} as VehicleProfile;
 for(const key of keys){
  const value=req.body?.[key];
  if(typeof value!=='string'||value.trim().length>120){res.status(400).json({error:'بيانات المركبة غير صالحة'});return;}
  profile[key]=value.trim();
 }
 if(!profile.name){res.status(400).json({error:'اسم المركبة مطلوب'});return;}
 const previous=vehicleProfiles[imei];
 const wasNew=!deviceRepo.get(imei);
 vehicleProfiles[imei]=profile;
 try{
  saveJson(VEHICLE_PROFILES_PATH,vehicleProfiles);
  if(wasNew)deviceRepo.upsert(imei,new Date().toISOString(),false);
  res.json({success:true,imei,profile});
 }catch{
  if(previous)vehicleProfiles[imei]=previous;else delete vehicleProfiles[imei];
  res.status(507).json({error:'تعذر حفظ البيانات في التخزين الدائم'});
 }
});
// Company CRUD and vehicle assignment: available only to the global administrator.
app.get('/api/admin/companies',(req:Request,res:Response)=>{
 if(sessionIdentity(req)?.role!=='admin'){res.sendStatus(403);return;}
 res.json({companies:fleetCompanies,assignments:deviceCompanies,devices:deviceRepo.getAll()});
});
app.post('/api/admin/companies',async (req:Request,res:Response)=>{
 if(sessionIdentity(req)?.role!=='admin'){res.sendStatus(403);return;}
 const name=typeof req.body?.name==='string'?req.body.name.trim():'';
 if(name.length<2||name.length>100){res.status(400).json({error:'اسم الشركة غير صالح'});return;}
 const sector:CompanySector=['rental','logistics','school','general'].includes(req.body?.sector)?req.body.sector:'general';
 const company={id:crypto.randomUUID(),name,enabled:true,sector};
 fleetCompanies.push(company);
 try{await saveCompanies();res.status(201).json(company);}catch{fleetCompanies.pop();res.sendStatus(507);}
});
app.put('/api/admin/companies/:id',async (req:Request,res:Response)=>{
 if(sessionIdentity(req)?.role!=='admin'){res.sendStatus(403);return;}
 const c=fleetCompanies.find(c=>c.id===req.params.id);
 if(!c){res.sendStatus(404);return;}
 const before={...c};
 if(typeof req.body?.name==='string'&&req.body.name.trim().length>=2&&req.body.name.length<=100)c.name=req.body.name.trim();
 if(typeof req.body?.enabled==='boolean')c.enabled=req.body.enabled;
 if(['rental','logistics','school','general'].includes(req.body?.sector))c.sector=req.body.sector;
 try{await saveCompanies();res.json(c);}catch{Object.assign(c,before);res.sendStatus(507);}
});
app.put('/api/admin/devices/:imei/company',async (req:Request,res:Response)=>{
 if(sessionIdentity(req)?.role!=='admin'){res.sendStatus(403);return;}
 const imei=String(req.params.imei),companyId=req.body?.companyId;
 if(!deviceRepo.get(imei)||!(companyId===null||typeof companyId==='string'&&fleetCompanies.some(c=>c.id===companyId))){res.sendStatus(400);return;}
 const before=deviceCompanies[imei];
 if(companyId===null)delete deviceCompanies[imei];else deviceCompanies[imei]=companyId;
 try{
  // Moving an IMEI to another company immediately revokes all previous user grants.
  const previousUsers=fleetUsers.map(u=>({...u,devices:[...u.devices]}));
  for(const user of fleetUsers)if(user.devices.includes(imei)&&user.companyId!==companyId)user.devices=user.devices.filter(id=>id!==imei);
  try{await saveAssignments();await saveFleetUsers();res.json({success:true});}
  catch(e){fleetUsers=previousUsers;throw e;}
 }catch{if(before===undefined)delete deviceCompanies[imei];else deviceCompanies[imei]=before;try{await saveAssignments();}catch{}res.sendStatus(507);}
});
// Explicit IMEI -> user grants. Manager may only grant vehicles in own company.
app.put('/api/admin/users/:username/devices',async (req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 const target=fleetUsers.find(u=>u.username===req.params.username);
 if(!target||(actor.role==='admin' ? (target.companyId!==null && target.companyId!==undefined) : (target.companyId!==actor.companyId||target.role==='company_admin'))){res.sendStatus(404);return;}
 const devices=req.body?.devices;
 if(!Array.isArray(devices)||devices.some(id=>typeof id!=='string'||!/^[0-9]{15}$/.test(id)||!deviceRepo.get(id)||(target.companyId ? deviceCompanies[id]!==target.companyId : !!deviceCompanies[id])||fleetUsers.some(u=>u.username!==target.username&&u.enabled&&u.devices.includes(id)))){
  res.status(400).json({error:'كل IMEI يجب أن يكون مسجلاً ويتبع شركة المستخدم'});return;
 }
 const old=[...target.devices];target.devices=[...new Set<string>(devices)];
 try{await saveFleetUsers();res.json({success:true,username:target.username,devices:target.devices});}
 catch{target.devices=old;res.sendStatus(507);}
});
// Shared manager operations, scoped to their own company on every request.
app.get('/api/admin/users',(req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 const allowed=visibleDevices(req);
 const users=fleetUsers.filter(u=>actor.role==='admin' ? (!u.companyId || u.role==='company_admin') : (u.companyId===actor.companyId&&u.role!=='company_admin'))
  .map(({username,displayName,devices,enabled,role,companyId,phone,email,vehicleType,plateNumber,chassisNumber,driverName,demo})=>({username,displayName,devices,enabled,role:role||'user',companyId:companyId||null,phone:phone||'',email:email||'',vehicleType:vehicleType||'',plateNumber:plateNumber||'',chassisNumber:chassisNumber||'',driverName:driverName||'',demo:!!demo}));
 res.setHeader('Cache-Control','no-store');
 res.json({admin:{username:AUTH_USER,displayName:'محمد زين'},users,devices:allowed,companies:actor.role==='admin'?fleetCompanies:fleetCompanies.filter(c=>c.id===actor.companyId),role:actor.role,companyId:actor.companyId});
});
app.post('/api/admin/users',async (req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 const {username,displayName,password,devices}=req.body||{};
 const phone=typeof req.body?.phone==='string'?req.body.phone.trim():'';
 const email=typeof req.body?.email==='string'?req.body.email.trim():'';
 const vehicleType=typeof req.body?.vehicleType==='string'?req.body.vehicleType.trim():'';
 const plateNumber=typeof req.body?.plateNumber==='string'?req.body.plateNumber.trim():'';
 const chassisNumber=typeof req.body?.chassisNumber==='string'?req.body.chassisNumber.trim():'';
 const driverName=typeof req.body?.driverName==='string'?req.body.driverName.trim():'';
 const role=req.body?.role==='company_admin'?'company_admin':req.body?.role==='employee'?'employee':'user';
 const companyId=actor.role==='admin'?(role==='company_admin'?req.body?.companyId:null):actor.companyId;
 if((actor.role==='admin'&&role!=='company_admin'&&req.body?.companyId)||
    (actor.role==='company_admin'&&role!=='employee')||
    (role==='company_admin'&&actor.role!=='admin')||
    (companyId!==null&&!fleetCompanies.some(c=>c.id===companyId&&c.enabled))||
    typeof username!=='string'||!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)||
    username.toLowerCase()===AUTH_USER.toLowerCase()||fleetUsers.some(u=>u.username.toLowerCase()===username.toLowerCase())||
    (!!email&&fleetUsers.some(u=>u.email?.toLowerCase()===email.toLowerCase()))||
    typeof displayName!=='string'||!displayName.trim()||displayName.length>100||
    typeof password!=='string'||password.length<10||password.length>256||
    phone.length>35||email.length>150||(email!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||vehicleType.length>100||plateNumber.length>40||chassisNumber.length>50||driverName.length>100||
    !Array.isArray(devices)||devices.some(id=>typeof id!=='string'||!/^[0-9]{15}$/.test(id)||!deviceRepo.get(id)||(companyId ? deviceCompanies[id]!==companyId : !!deviceCompanies[id]))||devices.some((id:string)=>fleetUsers.some(u=>u.enabled&&u.devices.includes(id)))){
   res.status(400).json({error:'تحقق من الشركة والدور وكلمة المرور والأجهزة التابعة للشركة'});return;
 }
 const salt=crypto.randomBytes(16).toString('hex');
 const user:FleetUser={username,displayName:displayName.trim(),salt,hash:fleetPasswordHash(password,salt),devices:[...new Set<string>(devices)],enabled:true,role,companyId,phone,email,vehicleType,plateNumber,chassisNumber,driverName};
 fleetUsers.push(user);
 try{await saveFleetUsers();res.status(201).json({success:true});}catch{fleetUsers.pop();res.sendStatus(507);}
});
app.put('/api/admin/users/:username',async (req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 const user=fleetUsers.find(u=>u.username===req.params.username);
 if(!user||(actor.role==='admin' ? (!!user.companyId&&user.role!=='company_admin') : (user.companyId!==actor.companyId||user.role==='company_admin'))){res.sendStatus(404);return;}
 const companyId=actor.role==='admin'?user.role==='company_admin'?user.companyId:null:actor.companyId;
 const role=actor.role==='admin'&&['user','company_admin'].includes(req.body?.role)?req.body.role:user.role||'user';
 if((companyId&&!fleetCompanies.some(c=>c.id===companyId))||!['user','employee','company_admin'].includes(role)||(actor.role==='admin'&&role!==user.role)){res.sendStatus(400);return;}
 const devices=req.body?.devices;
 if(!Array.isArray(devices)||devices.some(id=>typeof id!=='string'||!/^[0-9]{15}$/.test(id)||!deviceRepo.get(id)||(companyId ? deviceCompanies[id]!==companyId : !!deviceCompanies[id])||fleetUsers.some(u=>u.username!==user.username&&u.enabled&&u.devices.includes(id)))){res.status(409).json({error:'IMEI مخصص لمستخدم آخر'});return;}
 const previous={...user};
 user.companyId=companyId;user.role=role;user.devices=[...new Set<string>(devices)];
 if(typeof req.body?.displayName==='string' && req.body.displayName.trim() && req.body.displayName.length<=100)user.displayName=req.body.displayName.trim();
 if(typeof req.body?.enabled==='boolean')user.enabled=req.body.enabled;
 if(typeof req.body?.phone==='string'&&req.body.phone.length<=35)user.phone=req.body.phone.trim();
 if(typeof req.body?.email==='string'&&req.body.email.length<=150&&(!req.body.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)))user.email=req.body.email.trim();
 if(typeof req.body?.vehicleType==='string'&&req.body.vehicleType.length<=100)user.vehicleType=req.body.vehicleType.trim();
 if(typeof req.body?.plateNumber==='string'&&req.body.plateNumber.length<=40)user.plateNumber=req.body.plateNumber.trim();
 if(typeof req.body?.chassisNumber==='string'&&req.body.chassisNumber.length<=50)user.chassisNumber=req.body.chassisNumber.trim();
 if(typeof req.body?.driverName==='string'&&req.body.driverName.length<=100)user.driverName=req.body.driverName.trim();
 try{await saveFleetUsers();res.json({success:true});}catch{Object.assign(user,previous);res.sendStatus(507);}
});
// Managers can reset passwords only for accounts they are authorized to manage.
// Passwords are never returned by APIs; saving a reset invalidates the previous password.
app.put('/api/admin/users/:username/password',async (req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 const user=fleetUsers.find(u=>u.username===req.params.username);
 if(!user || (actor.role==='admin' ? (!!user.companyId && user.role!=='company_admin') : (user.companyId!==actor.companyId || user.role==='company_admin'))){res.sendStatus(404);return;}
 const password=req.body?.password;
 if(typeof password!=='string'||password.length<10||password.length>256){res.status(400).json({error:'كلمة المرور يجب أن تتكون من 10 أحرف على الأقل'});return;}
 const oldSalt=user.salt,oldHash=user.hash;
 user.salt=crypto.randomBytes(16).toString('hex');user.hash=fleetPasswordHash(password,user.salt);
 try{await saveFleetUsers();res.setHeader('Cache-Control','no-store');res.json({success:true});}
 catch{user.salt=oldSalt;user.hash=oldHash;res.status(507).json({error:'تعذر حفظ كلمة المرور'});}
});
// Company managers may remove ONLY their own ordinary users; tracker ownership is never deleted.
app.delete('/api/admin/users/:username',async (req:Request,res:Response)=>{
 const actor=managerScope(req);
 if(!actor){res.sendStatus(403);return;}
 const index=fleetUsers.findIndex(u=>u.username===req.params.username);
 const target=index>=0?fleetUsers[index]:null;
 if(!target || target.role==='company_admin' ||
    (actor.role==='company_admin' ? target.companyId!==actor.companyId : !!target.companyId)){
   res.status(403).json({error:'لا يمكنك حذف هذا الحساب'});return;
 }
 fleetUsers.splice(index,1);
 try {await saveFleetUsers();res.json({success:true});}
 catch {fleetUsers.splice(index,0,target);res.status(507).json({error:'تعذر حفظ الحذف'});}
});
// Every vehicle endpoint is tenant-scoped, including diagnostics and destructive actions.
app.use('/api',(req:Request,res:Response,next)=>{
 const who=sessionIdentity(req);if(!who){res.sendStatus(401);return;}
 if(who.role==='admin'){next();return;}
 if(req.path==='/devices'&&req.method==='GET'){next();return;}
 const smartMatch=req.path.match(/^\/smart-fleet\/([^/]+)(?:\/.*)?$/);
 if(smartMatch&&req.method==='GET'&&fleetAccess(req,smartMatch[1])){next();return;}
 const match=req.path.match(/^\/devices\/([^/]+)(?:\/.*)?$/);
 if(match&&fleetAccess(req,match[1])){
   if(req.method==='GET'){next();return;}
   // Only the global administrator may delete a tracker or change fleet-wide ownership.
   // Company managers have read access to their assigned devices only.
 }
 res.status(403).json({error:'ليس لديك صلاحية الوصول إلى هذا الجهاز أو العملية'});
});
// API Endpoints matching ZainFleet original C# WebApplication
app.get('/health', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!tcpListenerReady) res.status(503);
  res.json({
    status: tcpListenerReady ? 'healthy' : 'tcp_listener_unavailable',
    tcpListenerReady,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    tcpPort: TCP_PORT,
    httpPort: HTTP_PORT,
    tcpIdleTimeoutSeconds: Math.floor(TCP_IDLE_TIMEOUT_MS / 1000),
    tcpConnectionsSinceStart,
    lastTcpConnectionAt,
    lastAvlPacketAt,
    knownDevices: deviceRepo.getAll().length,
    lastTcpFailure,
    tcpFailureCounts,

    activeDeviceSockets: Array.from(activeDeviceSockets.values()).reduce((sum, group) => sum + group.size, 0),
    // Railway's public TCP proxy is NOT the internal TCP listener port.
    // Configure these from Settings > Networking > TCP Proxy; do not guess them.
    tcpPublicHost: process.env.TCP_PUBLIC_HOST || null,
    tcpPublicPort: process.env.TCP_PUBLIC_PORT ? Number(process.env.TCP_PUBLIC_PORT) : null,
  });
});

// Explain observable connection failures without claiming to know the device's network state.
app.get('/api/connection/diagnostics', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const activeSockets = Array.from(activeDeviceSockets.values()).reduce((sum, group) => sum + group.size, 0);
  const reasonCode = !tcpListenerReady ? 'TCP_LISTENER_DOWN'
    : tcpConnectionsSinceStart === 0 ? 'NO_INBOUND_CONNECTION'
    : !lastAvlPacketAt && lastTcpFailure ? lastTcpFailure.code
    : !lastAvlPacketAt ? 'TCP_RECEIVED_NO_AVL'
    : activeSockets === 0 ? 'DEVICE_DISCONNECTED'
    : 'DATA_RECEIVED';
  const reasonAr: Record<string, string> = {
    TCP_LISTENER_DOWN: 'فشل تشغيل منفذ TCP على السيرفر',
    NO_INBOUND_CONNECTION: 'لم يصل أي اتصال TCP إلى السيرفر منذ تشغيله. لا يمكن تحديد السبب من الخادم وحده؛ افحص الشبكة والشريحة وTCP Proxy',
    HANDSHAKE_INVALID: 'وصل اتصال ولكن فشلت مصافحة IMEI',
    PACKET_INVALID: 'وصلت بيانات TCP لكن تنسيق حزمة AVL غير صالح',
    PACKET_DECODE_FAILED: 'وصلت حزمة AVL لكن تعذر فكها',
    TIMEOUT: 'وصل اتصال TCP ثم انتهت مهلة الانتظار',
    SOCKET_ERROR: 'حدث خطأ أثناء اتصال TCP',
    TCP_RECEIVED_NO_AVL: 'وصل اتصال TCP لكن لم تصل حزمة AVL صحيحة بعد',
    DEVICE_DISCONNECTED: 'استقبل السيرفر بيانات AVL سابقاً، ولا توجد جلسة جهاز مفتوحة الآن',
    DATA_RECEIVED: 'استقبل السيرفر بيانات AVL وتوجد جلسة جهاز مفتوحة'
  };
  res.json({ tcpListenerReady, tcpConnectionsSinceStart, activeSockets,
    lastTcpConnectionAt, lastAvlPacketAt, lastTcpFailure, tcpFailureCounts,
    reasonCode, reasonAr: reasonAr[reasonCode], checkedAt: new Date().toISOString() });
});

// Smart fleet endpoints: existing device permissions govern every read and mutation.
app.get('/api/smart-fleet/:imei', async (req: Request,res: Response) => {
 const imei=String(req.params.imei);
 if(!sessionIdentity(req)||!fleetAccess(req,imei)){res.sendStatus(403);return;}
 if(!postgresPool){res.sendStatus(503);return;}
 try {
 const [plans,orders,events]=await Promise.all([
 postgresPool.query('SELECT * FROM fleet_maintenance_plans WHERE imei=$1 ORDER BY due_at NULLS LAST LIMIT 200',[imei]),
 postgresPool.query(`SELECT w.*, COALESCE((SELECT SUM(p.quantity*p.unit_cost) FROM fleet_work_order_parts p WHERE p.work_order_id=w.id),0) AS parts_cost, COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id::text,'part_name',p.part_name,'quantity',p.quantity,'unit_cost',p.unit_cost) ORDER BY p.id) FROM fleet_work_order_parts p WHERE p.work_order_id=w.id),'[]'::jsonb) AS parts FROM fleet_work_orders w WHERE imei=$1 ORDER BY opened_at DESC LIMIT 200`,[imei]),
 postgresPool.query('SELECT * FROM fleet_diagnostic_events WHERE imei=$1 ORDER BY observed_at DESC LIMIT 200',[imei])
 ]);
 res.setHeader('Cache-Control','no-store');
 res.json({plans:plans.rows,orders:orders.rows,events:events.rows,canEdit:!!managerScope(req)});
 }catch(e){console.error('[SmartFleet]',e);res.status(500).json({error:'تعذر تحميل البيانات'});}
});
app.post('/api/smart-fleet/:imei/:kind', async (req: Request,res: Response) => {
 const imei=String(req.params.imei),kind=String(req.params.kind),b=req.body||{};
 if(!managerScope(req)||!fleetAccess(req,imei)){res.sendStatus(403);return;}
 if(!postgresPool){res.sendStatus(503);return;}
 const title=typeof b.title==='string'?b.title.trim():'';
 if(!title||title.length>300){res.status(400).json({error:'العنوان مطلوب'});return;}
 try {
 let result;
 if(kind==='plans'){
 const date=typeof b.dueAt==='string'?new Date(b.dueAt):null;
 if(!date||!Number.isFinite(date.getTime())){res.status(400).json({error:'تاريخ الصيانة مطلوب'});return;}
 result=await postgresPool.query('INSERT INTO fleet_maintenance_plans(imei,title,due_at) VALUES ($1,$2,$3) RETURNING id',[imei,title,date.toISOString()]);
 }else if(kind==='orders'){
 result=await postgresPool.query('INSERT INTO fleet_work_orders(imei,title) VALUES ($1,$2) RETURNING id',[imei,title]);
 }else if(kind==='events'){
 const severity=['info','warning','critical','unknown'].includes(b.severity)?b.severity:'unknown';
 const code=typeof b.code==='string'?b.code.trim().slice(0,30):null;
 result=await postgresPool.query("INSERT INTO fleet_diagnostic_events(imei,observed_at,source,code,severity,description) VALUES ($1,now(),'manual',$2,$3,$4) RETURNING id",[imei,code,severity,title]);
 }else{res.sendStatus(404);return;}
 res.status(201).json(result.rows[0]);
 }catch(e){console.error('[SmartFleet]',e);res.status(500).json({error:'تعذر الحفظ'});}
});
app.post('/api/smart-fleet/:imei/orders/:id/parts',async(req:Request,res:Response)=>{
 const imei=String(req.params.imei),id=String(req.params.id),b=req.body||{};
 if(!managerScope(req)||!fleetAccess(req,imei)){res.sendStatus(403);return;}
 if(!postgresPool){res.sendStatus(503);return;}
 const name=typeof b.name==='string'?b.name.trim():'';
 if(!/^\d{1,18}$/.test(id)||!name||name.length>200||typeof b.quantity!=='number'||!Number.isFinite(b.quantity)||b.quantity<=0||b.quantity>999999999||typeof b.unitCost!=='number'||!Number.isFinite(b.unitCost)||b.unitCost<0||b.unitCost>99999999999){res.sendStatus(400);return;}
 try{const q=await postgresPool.query("INSERT INTO fleet_work_order_parts(work_order_id,part_name,quantity,unit_cost) SELECT id,$3,$4,$5 FROM fleet_work_orders WHERE id=$1 AND imei=$2 AND status IN ('open','in_progress') RETURNING id",[id,imei,name,b.quantity,b.unitCost]);if(!q.rowCount){res.sendStatus(404);return;}res.status(201).json(q.rows[0]);}catch(e){console.error('[SmartFleet]',e);res.sendStatus(500);}
});
app.get('/api/smart-fleet/:imei/report',async(req:Request,res:Response)=>{
 const imei=String(req.params.imei);
 if(!fleetAccess(req,imei)){res.sendStatus(403);return;}
 if(!postgresPool){res.sendStatus(503);return;}
 try{const q=await postgresPool.query("SELECT COUNT(*) AS orders,COUNT(*) FILTER(WHERE status='completed') AS completed,COUNT(*) FILTER(WHERE status IN ('open','in_progress')) AS active,COALESCE(SUM(labor_cost) FILTER(WHERE status <> 'cancelled'),0) AS labor,COALESCE(SUM((SELECT COALESCE(SUM(quantity*unit_cost),0) FROM fleet_work_order_parts p WHERE p.work_order_id=w.id)) FILTER(WHERE status <> 'cancelled'),0) AS parts FROM fleet_work_orders w WHERE imei=$1",[imei]);res.json(q.rows[0]);}catch(e){console.error('[SmartFleet]',e);res.sendStatus(500);}
});
app.patch('/api/smart-fleet/:imei/orders/:id', async(req:Request,res:Response)=>{
 const imei=String(req.params.imei),id=String(req.params.id),b=req.body||{};
 if(!managerScope(req)||!fleetAccess(req,imei)){res.sendStatus(403);return;}
 if(!postgresPool){res.sendStatus(503);return;}
 if(!/^\d{1,18}$/.test(id)||!['open','in_progress','completed','cancelled'].includes(b.status)||typeof b.laborCost!=='number'||!Number.isFinite(b.laborCost)||b.laborCost<0||b.laborCost>99999999999){res.sendStatus(400);return;}
 try{
 const result=await postgresPool.query("UPDATE fleet_work_orders SET status=$1,labor_cost=$2,completed_at=CASE WHEN $1='completed' THEN COALESCE(completed_at,now()) ELSE NULL END WHERE id=$3 AND imei=$4 RETURNING id",[b.status,b.laborCost,id,imei]);
 if(!result.rowCount){res.sendStatus(404);return;}res.json(result.rows[0]);
 }catch(e){console.error('[SmartFleet]',e);res.sendStatus(500);}
});

app.get('/api/devices', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const who = sessionIdentity(_req);
  res.json(visibleDevices(_req));
});

app.get('/api/devices/:imei', (req: Request, res: Response) => {
  const imei = String(req.params.imei);
  if(!fleetAccess(req,imei)){res.sendStatus(403);return;}
  const device = deviceRepo.get(imei);
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  res.json(device);
});

app.get('/api/devices/:imei/latest', async (req: Request, res: Response) => {
  const imei = String(req.params.imei);
  if(!fleetAccess(req,imei)){res.sendStatus(403);return;}
  let latest = telemetryRepo.getLatest(imei);
  if(!latest && postgresPool){try{const q=await postgresPool.query('SELECT record,received_at FROM tracker_telemetry WHERE imei=$1 ORDER BY gps_time DESC LIMIT 1',[imei]);if(q.rows[0])latest={imei,record:q.rows[0].record,receivedAt:new Date(q.rows[0].received_at).toISOString()};}catch(e){console.error('[Postgres] latest lookup',e);res.sendStatus(503);return;}}
  if (!latest) {
    res.status(404).json({ error: 'No telemetry record found for device' });
    return;
  }
  res.json(latest);
});

// Advanced API endpoint: Parse and inspect any Teltonika raw hex frame
app.post('/api/packets/decode', (req: Request, res: Response) => {
  try {
    const { hex, imei } = req.body;
    if (!hex || typeof hex !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "hex" field in request body' });
      return;
    }
    const bytes = hexStringToBytes(hex);
    const decoded = decodeTeltonikaFrame(bytes);

    // Also record into diagnostic log for inspection and troubleshooting
    try {
      diagnosticLogger.recordPacket(
        imei || 'simulated_decoder',
        req.ip || '127.0.0.1',
        0,
        bytes,
        decoded
      );
    } catch {}

    res.json({
      success: true,
      ...decoded,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to decode packet',
    });
  }
});

// Diagnostic Endpoints for FMB140 Battery Voltage & CAN Bus Investigation
app.get('/api/diagnostics/summary', (_req: Request, res: Response) => {
  res.json(diagnosticLogger.getSummary());
});

app.get('/api/diagnostics/download', (_req: Request, res: Response) => {
  const filePath = diagnosticLogger.getJsonPath();
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Diagnostic log file not found' });
    return;
  }
  res.download(filePath, 'fmb140_packet_diagnostic.json');
});

app.get('/api/diagnostics/download-log', (_req: Request, res: Response) => {
  const filePath = diagnosticLogger.getLogPath();
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Diagnostic text log file not found' });
    return;
  }
  res.download(filePath, 'fmb140_packet_diagnostic.log');
});

app.get('/api/devices/:imei/diagnostics/download', (req: Request, res: Response) => {
  const filePath = diagnosticLogger.getJsonPath();
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Diagnostic log file not found' });
    return;
  }
  res.download(filePath, `fmb140_packet_diagnostic_${req.params.imei}.json`);
});

app.post('/api/diagnostics/clear', (_req: Request, res: Response) => {
  diagnosticLogger.clear();
  res.json({ success: true, message: 'Diagnostic logs cleared' });
});

// Telemetry History endpoint
app.get('/api/devices/:imei/history', async (req: Request, res: Response) => {
 const imei=String(req.params.imei);
 if(!fleetAccess(req,imei)){res.sendStatus(403);return;}
 const limit=Math.max(1,Math.min(5000,Number.parseInt(String(req.query.limit||'1000'),10)||1000));
 const from=req.query.from?new Date(String(req.query.from)):null,to=req.query.to?new Date(String(req.query.to)):null;
 if((from&&!Number.isFinite(from.getTime()))||(to&&!Number.isFinite(to.getTime()))||(from&&to&&from>to)){res.sendStatus(400);return;}
 try{
 if(postgresPool){const q=await postgresPool.query('SELECT record,received_at FROM tracker_telemetry WHERE imei=$1 AND ($2::timestamptz IS NULL OR gps_time >= $2) AND ($3::timestamptz IS NULL OR gps_time <= $3) ORDER BY gps_time DESC LIMIT $4',[imei,from?.toISOString()||null,to?.toISOString()||null,limit]);res.json(q.rows.map(r=>({imei,record:r.record,receivedAt:new Date(r.received_at).toISOString()})));return;}
 res.json(telemetryRepo.getHistory(imei,limit).filter(r=>(!from||new Date(r.record.timestamp)>=from)&&(!to||new Date(r.record.timestamp)<=to)));
 }catch(e){console.error('[History]',e);res.sendStatus(503);}
});

// Trips endpoint: Segments recorded history into discrete vehicle trips
app.get('/api/devices/:imei/trips', (req: Request, res: Response) => {
  const imei = String(req.params.imei);
  const history = telemetryRepo.getHistory(imei, 5000);
  const records = history.map((h) => h.record);
  const trips = segmentRecordsIntoTrips(records);
  res.json(trips);
});

// Delete history endpoint
app.delete('/api/devices/:imei/history', (req: Request, res: Response) => {
  const imei = String(req.params.imei);
  telemetryRepo.clearHistory(imei);
  res.json({ success: true, message: 'History cleared' });
});

// Delete device endpoint
app.delete('/api/devices/:imei', (req: Request, res: Response) => {
  const imei = String(req.params.imei);
  deviceRepo.delete(imei);
  telemetryRepo.clearHistory(imei);
  res.json({ success: true });
});

// Setup Vite or static serving
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  await postgresReady;
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  }

  const serverInstance = app.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`ZainFleet HTTP server running on http://0.0.0.0:${HTTP_PORT}`);
  });

  serverInstance.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[HTTP Server Notice] Port ${HTTP_PORT} is already in use (EADDRINUSE). Another instance is already serving traffic.`);
    } else {
      console.error(`[HTTP Server Error]`, err);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
