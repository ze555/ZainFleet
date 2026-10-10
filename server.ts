import net from 'node:net';
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

  upsert(imei: string, seenAt: string, connected: boolean, lastGpsAt?: string): DeviceInfo {
    const existing = this.devices.get(imei);
    const tcpConnected = connected;
    const connectionStatus: 'online' | 'standby' | 'offline' = connected ? 'online' : 'offline';
    const updated: DeviceInfo = {
      imei,
      name: existing?.name,
      firstSeen: existing ? existing.firstSeen : seenAt,
      lastSeen: seenAt,
      lastPacketAt: seenAt,
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
const TCP_PORT = parseInt(process.env.TCP_PORT || '5000', 10);
let HTTP_PORT = parseInt(process.env.PORT || '3000', 10);
if (HTTP_PORT === TCP_PORT) {
  // If user set PORT=5000 in Railway variables, avoid port collision with TCP listener
  const fallback = process.env.NODE_ENV === 'production' ? 8080 : 3000;
  console.warn(`[Port Config] PORT and TCP_PORT both configured to ${TCP_PORT}. Directing HTTP server to ${fallback}.`);
  HTTP_PORT = fallback;
}
const TCP_IDLE_TIMEOUT_MS = parseInt(process.env.TCP_IDLE_TIMEOUT_SECONDS || '300', 10) * 1000;
const TCP_MAX_PACKET_BYTES = parseInt(process.env.TCP_MAX_PACKET_BYTES || '1048576', 10);

const tcpServer = net.createServer((socket) => {
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
    console.log(`[TCP] DEVICE TIMEOUT ${remote} (IMEI=${imei})`);
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
          console.warn(`[TCP] Rejected invalid IMEI length: ${imeiLength}`);
          socket.write(Buffer.from(createImeiResponse(false)));
          socket.destroy();
          return;
        }

        if (buffer.length < 2 + 15) return;
        const imeiBytes = buffer.subarray(2, 17);
        const parsed = tryParseImei(imeiBytes);
        if (!parsed) {
          console.warn(`[TCP] Rejected invalid IMEI digits`);
          socket.write(Buffer.from(createImeiResponse(false)));
          socket.destroy();
          return;
        }

        imei = parsed;
        handshakeDone = true;
        buffer = buffer.subarray(17);

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
          console.warn(`[TCP] Invalid packet preamble: 0x${p0.toString(16)} (buffer length=${buffer.length})`);
          socket.destroy();
          return;
        }

        const dataLength = buffer.readUInt32BE(4);
        if (dataLength < 3 || dataLength > TCP_MAX_PACKET_BYTES) {
          console.warn(`[TCP] Invalid dataLength: ${dataLength}`);
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

        const seenIso = new Date().toISOString();
        if (imei) {
          let latestGpsTime = '';
          for (const rec of decoded.records) {
            telemetryRepo.store(imei, rec, seenIso);
            if (rec.timestamp) {
              latestGpsTime = rec.timestamp;
            }
          }
          deviceRepo.incrementRecords(imei, decoded.records.length);
          deviceRepo.upsert(imei, seenIso, true, latestGpsTime || undefined);
        }

        // Send 4-byte big-endian ACK
        const ack = Buffer.from(createAvlAcknowledgement(decoded.records.length));
        socket.write(ack, (err) => {
          if (err) console.error(`[TCP] Failed to write ACK to ${imei}:`, err);
          else console.log(`[TCP] PACKET ACK sent to ${imei}: ${decoded.records.length} records (0x${ack.toString('hex')})`);
        });
      }
    } catch (err) {
      console.error(`[TCP] Error processing data from ${remote}:`, err);
      socket.destroy();
    }
  });

  socket.on('close', (hadError) => {
    if (imei) {
      deviceRepo.upsert(imei, new Date().toISOString(), false);
      console.log(`[TCP] DEVICE DISCONNECTED ${imei} (hadError=${hadError}, bufferRemaining=${buffer.length})`);
    } else {
      console.log(`[TCP] DEVICE DISCONNECTED ${remote} (hadError=${hadError}, bufferRemaining=${buffer.length})`);
    }
  });

  socket.on('error', (err) => {
    console.error(`[TCP] Socket error from ${remote}:`, err.message);
  });
});

// Try to listen on TCP_PORT, gracefully handle port restrictions or existing instances
tcpServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[TCP Server Notice] Port ${TCP_PORT} is already in use (EADDRINUSE). Another instance or process is currently holding the TCP socket.`);
  } else {
    console.warn(`[TCP Server Notice] Could not bind TCP port ${TCP_PORT}: ${err.message}. HTTP simulation endpoints remain fully operational.`);
  }
});

try {
  tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
    console.log(`Teltonika TCP listener started on 0.0.0.0:${TCP_PORT}`);
  });
} catch (err: any) {
  console.warn(`[TCP Server] listen error:`, err.message);
}

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

// API Endpoints matching ZainFleet original C# WebApplication
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    tcpPort: TCP_PORT,
    httpPort: HTTP_PORT,
  });
});

app.get('/api/devices', (_req: Request, res: Response) => {
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
    const { hex } = req.body;
    if (!hex || typeof hex !== 'string') {
      res.status(400).json({ error: 'Missing or invalid "hex" field in request body' });
      return;
    }
    const bytes = hexStringToBytes(hex);
    const decoded = decodeTeltonikaFrame(bytes);
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
