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
    const connectionStatus: 'online' | 'standby' | 'offline' = connected ? 'online' : 'offline';
    const updated: DeviceInfo = {
      imei,
      name: existing?.name,
      firstSeen: existing ? existing.firstSeen : seenAt,
      lastSeen: seenAt,
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

// HTTP dashboard authentication only. The raw Teltonika TCP listener remains independent.
const AUTH_USER = process.env.ADMIN_USERNAME || 'Admin';
const AUTH_PASSWORD = process.env.ADMIN_PASSWORD || '123456'; // Demo only: override on Railway.
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const AUTH_TTL_MS = 8 * 60 * 60 * 1000;
const failedLogins = new Map<string, { count: number; until: number }>();
function makeToken() {
  const payload = Buffer.from(JSON.stringify({ user: AUTH_USER, expires: Date.now() + AUTH_TTL_MS })).toString('base64url');
  const mac = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return payload + '.' + mac;
}
function authenticated(req: Request): boolean {
  const cookie = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('zf_session='));
  if (!cookie) return false;
  const token = cookie.slice('zf_session='.length);
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest();
  let provided: Buffer;
  try { provided = Buffer.from(signature, 'base64url'); } catch { return false; }
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.user === AUTH_USER && typeof data.expires === 'number' && data.expires > Date.now();
  } catch { return false; }
}
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
  const usernameOk = user === AUTH_USER;
  const actual = crypto.createHash('sha256').update(pass).digest();
  const expected = crypto.createHash('sha256').update(AUTH_PASSWORD).digest();
  if (!usernameOk || !crypto.timingSafeEqual(actual, expected)) {
    const fresh = !state || now >= state.until;
    failedLogins.set(ip, { count: (fresh ? 0 : state.count) + 1, until: now + 15 * 60 * 1000 });
    res.status(401).json({ error: 'اسم الدخول أو كلمة المرور غير صحيحة' });
    return;
  }
  failedLogins.delete(ip);
  res.setHeader('Set-Cookie', sessionCookie(makeToken(), AUTH_TTL_MS / 1000));
  res.json({ authenticated: true, username: AUTH_USER });
});
app.get('/api/auth/session', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ authenticated: authenticated(req) });
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
  res.json(deviceRepo.getAll());
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
