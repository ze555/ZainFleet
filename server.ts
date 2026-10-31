import net from 'node:net';
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
    const snapshot: TelemetrySnapshot = { imei, record, receivedAt };
    this.latest.set(imei, snapshot);

    const list = this.history.get(imei) || [];
    list.push(snapshot);
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

  socket.setTimeout(TCP_IDLE_TIMEOUT_MS);

  socket.on('timeout', () => {
    recordTcpFailure('TIMEOUT', `TCP session timed out (IMEI=${imei || 'unknown'})`);
    socket.destroy();
  });

  socket.on('data', (chunk) => {
    console.log(
      `[TCP RAW IN] ${remote} (IMEI=${imei || 'pending'}): ${chunk.length} bytes (hex: ${chunk.toString('hex').slice(0, 48)}${chunk.length > 24 ? '...' : ''})`
    );
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
        lastAvlPacketAt = seenIso;
        if (imei) {
          let latestGpsTime = '';
          for (const rec of decoded.records) {
            telemetryRepo.store(imei, rec, seenIso);
            if (rec.timestamp) {
              latestGpsTime = rec.timestamp;
            }
          }
          deviceRepo.incrementRecords(imei, decoded.records.length);
          deviceRepo.upsert(imei, seenIso, true, latestGpsTime || undefined, true);
        }

        // Send 4-byte big-endian ACK
        const ack = Buffer.from(createAvlAcknowledgement(decoded.records.length));
        socket.write(ack, (err) => {
          if (err) console.error(`[TCP] Failed to write ACK to ${imei}:`, err);
          else console.log(`[TCP] PACKET ACK sent to ${imei}: ${decoded.records.length} records (0x${ack.toString('hex')})`);
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
type FleetRole = 'admin' | 'company_admin' | 'user';
type CompanySector = 'rental'|'logistics'|'school'|'general';
type FleetCompany = {id:string;name:string;enabled:boolean;sector?:CompanySector};
type FleetUser = {username:string;displayName:string;salt:string;hash:string;devices:string[];enabled:boolean;role?:'company_admin'|'user';companyId?:string|null;phone?:string;email?:string;vehicleType?:string};
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
const saveFleetUsers=()=>saveJson(USERS_PATH,fleetUsers);
const saveCompanies=()=>saveJson(COMPANIES_PATH,fleetCompanies);
const saveAssignments=()=>saveJson(ASSIGNMENTS_PATH,deviceCompanies);
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
  if(data.user===AUTH_USER&&data.role==='admin')return {user:AUTH_USER,role:'admin',companyId:null};
  const managed=fleetUsers.find(u=>u.username===data.user&&u.enabled);
  if(!managed||data.role!==(managed.role||'user'))return null;
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
 return identity.role==='user'&&user.devices.includes(imei)&&!deviceCompanies[imei];
}
function visibleDevices(req:Request):DeviceInfo[]{return deviceRepo.getAll().filter(d=>fleetAccess(req,d.imei));}
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
  const payload = Buffer.from(JSON.stringify({ user: username, role, expires: Date.now() + AUTH_TTL_MS })).toString('base64url');
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
  const adminOk = isAdmin && crypto.timingSafeEqual(adminActual, adminExpected);
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
app.put('/api/admin/vehicle-profiles/:imei',(req:Request,res:Response)=>{
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
app.post('/api/admin/companies',(req:Request,res:Response)=>{
 if(sessionIdentity(req)?.role!=='admin'){res.sendStatus(403);return;}
 const name=typeof req.body?.name==='string'?req.body.name.trim():'';
 if(name.length<2||name.length>100){res.status(400).json({error:'اسم الشركة غير صالح'});return;}
 const sector:CompanySector=['rental','logistics','school','general'].includes(req.body?.sector)?req.body.sector:'general';
 const company={id:crypto.randomUUID(),name,enabled:true,sector};
 fleetCompanies.push(company);
 try{saveCompanies();res.status(201).json(company);}catch{fleetCompanies.pop();res.sendStatus(507);}
});
app.put('/api/admin/companies/:id',(req:Request,res:Response)=>{
 if(sessionIdentity(req)?.role!=='admin'){res.sendStatus(403);return;}
 const c=fleetCompanies.find(c=>c.id===req.params.id);
 if(!c){res.sendStatus(404);return;}
 const before={...c};
 if(typeof req.body?.name==='string'&&req.body.name.trim().length>=2&&req.body.name.length<=100)c.name=req.body.name.trim();
 if(typeof req.body?.enabled==='boolean')c.enabled=req.body.enabled;
 if(['rental','logistics','school','general'].includes(req.body?.sector))c.sector=req.body.sector;
 try{saveCompanies();res.json(c);}catch{Object.assign(c,before);res.sendStatus(507);}
});
app.put('/api/admin/devices/:imei/company',(req:Request,res:Response)=>{
 if(sessionIdentity(req)?.role!=='admin'){res.sendStatus(403);return;}
 const imei=String(req.params.imei),companyId=req.body?.companyId;
 if(!deviceRepo.get(imei)||!(companyId===null||typeof companyId==='string'&&fleetCompanies.some(c=>c.id===companyId))){res.sendStatus(400);return;}
 const before=deviceCompanies[imei];
 if(companyId===null)delete deviceCompanies[imei];else deviceCompanies[imei]=companyId;
 try{
  // Moving an IMEI to another company immediately revokes all previous user grants.
  const previousUsers=fleetUsers.map(u=>({...u,devices:[...u.devices]}));
  for(const user of fleetUsers)if(user.devices.includes(imei)&&user.companyId!==companyId)user.devices=user.devices.filter(id=>id!==imei);
  try{saveAssignments();saveFleetUsers();res.json({success:true});}
  catch(e){fleetUsers=previousUsers;throw e;}
 }catch{if(before===undefined)delete deviceCompanies[imei];else deviceCompanies[imei]=before;try{saveAssignments();}catch{}res.sendStatus(507);}
});
// Explicit IMEI -> user grants. Manager may only grant vehicles in own company.
app.put('/api/admin/users/:username/devices',(req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 const target=fleetUsers.find(u=>u.username===req.params.username);
 if(!target||(actor.role==='admin' ? (target.companyId!==null && target.companyId!==undefined) : (target.companyId!==actor.companyId||target.role==='company_admin'))){res.sendStatus(404);return;}
 const devices=req.body?.devices;
 if(!Array.isArray(devices)||devices.some(id=>typeof id!=='string'||!/^[0-9]{15}$/.test(id)||!deviceRepo.get(id)||(target.companyId ? deviceCompanies[id]!==target.companyId : !!deviceCompanies[id]))){
  res.status(400).json({error:'كل IMEI يجب أن يكون مسجلاً ويتبع شركة المستخدم'});return;
 }
 const old=[...target.devices];target.devices=[...new Set<string>(devices)];
 try{saveFleetUsers();res.json({success:true,username:target.username,devices:target.devices});}
 catch{target.devices=old;res.sendStatus(507);}
});
// Shared manager operations, scoped to their own company on every request.
app.get('/api/admin/users',(req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 const allowed=visibleDevices(req);
 const users=fleetUsers.filter(u=>actor.role==='admin' ? (!u.companyId || u.role==='company_admin') : (u.companyId===actor.companyId&&u.role!=='company_admin'))
  .map(({username,displayName,devices,enabled,role,companyId,phone,email,vehicleType})=>({username,displayName,devices,enabled,role:role||'user',companyId:companyId||null,phone:phone||'',email:email||'',vehicleType:vehicleType||''}));
 res.setHeader('Cache-Control','no-store');
 res.json({admin:{username:AUTH_USER,displayName:'محمد زين'},users,devices:allowed,companies:actor.role==='admin'?fleetCompanies:fleetCompanies.filter(c=>c.id===actor.companyId),role:actor.role,companyId:actor.companyId});
});
app.post('/api/admin/users',(req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 const {username,displayName,password,devices}=req.body||{};
 const phone=typeof req.body?.phone==='string'?req.body.phone.trim():'';
 const email=typeof req.body?.email==='string'?req.body.email.trim():'';
 const vehicleType=typeof req.body?.vehicleType==='string'?req.body.vehicleType.trim():'';
 const role=req.body?.role==='company_admin'?'company_admin':'user';
 const companyId=actor.role==='admin'?(role==='company_admin'?req.body?.companyId:null):actor.companyId;
 if((actor.role==='admin'&&role==='user'&&req.body?.companyId)||
    (role==='company_admin'&&actor.role!=='admin')||
    (companyId!==null&&!fleetCompanies.some(c=>c.id===companyId&&c.enabled))||
    typeof username!=='string'||!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)||
    username.toLowerCase()===AUTH_USER.toLowerCase()||fleetUsers.some(u=>u.username.toLowerCase()===username.toLowerCase())||
    typeof displayName!=='string'||!displayName.trim()||displayName.length>100||
    typeof password!=='string'||password.length<10||password.length>256||
    phone.length>35||email.length>150||(email!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||vehicleType.length>100||
    !Array.isArray(devices)||devices.some(id=>typeof id!=='string'||!/^[0-9]{15}$/.test(id)||!deviceRepo.get(id)||(companyId ? deviceCompanies[id]!==companyId : !!deviceCompanies[id]))){
   res.status(400).json({error:'تحقق من الشركة والدور وكلمة المرور والأجهزة التابعة للشركة'});return;
 }
 const salt=crypto.randomBytes(16).toString('hex');
 const user:FleetUser={username,displayName:displayName.trim(),salt,hash:fleetPasswordHash(password,salt),devices:[...new Set<string>(devices)],enabled:true,role,companyId,phone,email,vehicleType};
 fleetUsers.push(user);
 try{saveFleetUsers();res.status(201).json({success:true});}catch{fleetUsers.pop();res.sendStatus(507);}
});
app.put('/api/admin/users/:username',(req:Request,res:Response)=>{
 const actor=managerScope(req);if(!actor){res.sendStatus(403);return;}
 const user=fleetUsers.find(u=>u.username===req.params.username);
 if(!user||(actor.role==='admin' ? (!!user.companyId&&user.role!=='company_admin') : (user.companyId!==actor.companyId||user.role==='company_admin'))){res.sendStatus(404);return;}
 const companyId=actor.role==='admin'?user.role==='company_admin'?user.companyId:null:actor.companyId;
 const role=actor.role==='admin'&&['user','company_admin'].includes(req.body?.role)?req.body.role:user.role||'user';
 if((companyId&&!fleetCompanies.some(c=>c.id===companyId))||!['user','company_admin'].includes(role)||(actor.role==='admin'&&role!==user.role)){res.sendStatus(400);return;}
 const devices=req.body?.devices;
 if(!Array.isArray(devices)||devices.some(id=>typeof id!=='string'||!/^[0-9]{15}$/.test(id)||!deviceRepo.get(id)||(companyId ? deviceCompanies[id]!==companyId : !!deviceCompanies[id]))){res.sendStatus(400);return;}
 const previous={...user};
 user.companyId=companyId;user.role=role;user.devices=[...new Set<string>(devices)];
 if(typeof req.body?.enabled==='boolean')user.enabled=req.body.enabled;
 if(typeof req.body?.phone==='string'&&req.body.phone.length<=35)user.phone=req.body.phone.trim();
 if(typeof req.body?.email==='string'&&req.body.email.length<=150&&(!req.body.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)))user.email=req.body.email.trim();
 if(typeof req.body?.vehicleType==='string'&&req.body.vehicleType.length<=100)user.vehicleType=req.body.vehicleType.trim();
 try{saveFleetUsers();res.json({success:true});}catch{Object.assign(user,previous);res.sendStatus(507);}
});
// Every vehicle endpoint is tenant-scoped, including diagnostics and destructive actions.
app.use('/api',(req:Request,res:Response,next)=>{
 const who=sessionIdentity(req);if(!who){res.sendStatus(401);return;}
 if(who.role==='admin'){next();return;}
 if(req.path==='/devices'&&req.method==='GET'){next();return;}
 const match=req.path.match(/^\/devices\/([^/]+)(?:\/.*)?$/);
 if(match&&fleetAccess(req,match[1])){
   if(req.method==='GET'){next();return;}
   // Company admins may manage only their own company's devices.
   if(who.role==='company_admin'&&req.method==='DELETE'){next();return;}
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

app.get('/api/devices', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const who = sessionIdentity(_req);
  res.json(visibleDevices(_req));
});

app.get('/api/devices/:imei', (req: Request, res: Response) => {
  const imei = String(req.params.imei);
  const device = deviceRepo.get(imei);
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  res.json(device);
});

app.get('/api/devices/:imei/latest', (req: Request, res: Response) => {
  const imei = String(req.params.imei);
  const latest = telemetryRepo.getLatest(imei);
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
app.get('/api/devices/:imei/history', (req: Request, res: Response) => {
  const imei = String(req.params.imei);
  const limit = Math.min(5000, parseInt(String(req.query.limit || '1000'), 10));
  const history = telemetryRepo.getHistory(imei, limit);
  res.json(history);
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
