import net from 'node:net';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import {
  decodeTeltonikaFrame,
  createAvlAcknowledgement,
  createImeiResponse,
} from './src/protocol/packetParser.js';
import { tryParseImei, isValidImei } from './src/protocol/imeiParser.js';
import {
  buildCodec8TestPacket,
  buildCodec8ExtendedTestPacket,
  bytesToHexString,
  hexStringToBytes,
} from './src/protocol/fixtures.js';
import { DeviceInfo, TelemetrySnapshot, AvlRecord } from './src/types/fleet.js';

// --- In-Memory Repositories ---
class InMemoryDeviceRepository {
  private devices = new Map<string, DeviceInfo>();

  upsert(imei: string, seenAt: string, connected: boolean): DeviceInfo {
    const existing = this.devices.get(imei);
    const updated: DeviceInfo = {
      imei,
      firstSeen: existing ? existing.firstSeen : seenAt,
      lastSeen: seenAt,
      connected,
    };
    this.devices.set(imei, updated);
    return updated;
  }

  get(imei: string): DeviceInfo | null {
    return this.devices.get(imei) ?? null;
  }

  getAll(): DeviceInfo[] {
    return Array.from(this.devices.values());
  }
}

class InMemoryTelemetryRepository {
  private latest = new Map<string, TelemetrySnapshot>();

  store(imei: string, record: AvlRecord, receivedAt: string): void {
    this.latest.set(imei, {
      imei,
      record,
      receivedAt,
    });
  }

  getLatest(imei: string): TelemetrySnapshot | null {
    return this.latest.get(imei) ?? null;
  }

  getAll(): TelemetrySnapshot[] {
    return Array.from(this.latest.values());
  }
}

const deviceRepo = new InMemoryDeviceRepository();
const telemetryRepo = new InMemoryTelemetryRepository();

// Seed initial test device with realistic fixture data
const initialImei = '123456789012345';
const nowIso = new Date().toISOString();
deviceRepo.upsert(initialImei, nowIso, true);

// Parse initial fixture to seed telemetry
try {
  const seedBytes = buildCodec8TestPacket({
    timestampMs: Date.now(),
    latitude: 24.7136, // Riyadh coordinates as example
    longitude: 46.6753,
    altitude: 612,
    speed: 65,
    angle: 145,
    satellites: 12,
    priority: 1,
    eventIoId: 1,
    ioValue: 12400,
  });
  const decoded = decodeTeltonikaFrame(seedBytes);
  if (decoded.records.length > 0) {
    telemetryRepo.store(initialImei, decoded.records[0], nowIso);
  }
} catch (e) {
  console.warn('Initial telemetry seeding note:', e);
}

// Seed second demo vehicle
const demoImei2 = '860293048172941';
const demoIso = new Date(Date.now() - 1000 * 60 * 5).toISOString();
deviceRepo.upsert(demoImei2, demoIso, false);
try {
  const seedExt = buildCodec8ExtendedTestPacket({
    timestampMs: Date.now() - 1000 * 60 * 5,
    latitude: 24.7210,
    longitude: 46.6912,
    altitude: 618,
    speed: 0,
    angle: 80,
    satellites: 9,
    priority: 0,
  });
  const decodedExt = decodeTeltonikaFrame(seedExt);
  if (decodedExt.records.length > 0) {
    telemetryRepo.store(demoImei2, decodedExt.records[0], demoIso);
  }
} catch (e) {
  console.warn('Second demo seeding note:', e);
}

// --- Teltonika TCP Server (raw TCP socket) ---
const TCP_PORT = parseInt(process.env.TCP_PORT || '5000', 10);
const TCP_IDLE_TIMEOUT_MS = parseInt(process.env.TCP_IDLE_TIMEOUT_SECONDS || '300', 10) * 1000;
const TCP_MAX_PACKET_BYTES = parseInt(process.env.TCP_MAX_PACKET_BYTES || '1048576', 10);

const tcpServer = net.createServer((socket) => {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[TCP] DEVICE CONNECTED ${remote}`);

  let imei: string | null = null;
  let buffer = Buffer.alloc(0);
  let handshakeDone = false;

  socket.setTimeout(TCP_IDLE_TIMEOUT_MS);

  socket.on('timeout', () => {
    console.log(`[TCP] DEVICE TIMEOUT ${remote} (IMEI=${imei})`);
    socket.destroy();
  });

  socket.on('data', (chunk) => {
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
        socket.write(Buffer.from(createImeiResponse(true)));
      }

      // Read AVL packets from stream
      while (buffer.length >= 8) {
        // Preamble: 4 zero bytes
        const p0 = buffer.readUInt32BE(0);
        if (p0 !== 0) {
          console.warn(`[TCP] Invalid packet preamble: 0x${p0.toString(16)}`);
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
          // Wait for more bytes
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
          for (const rec of decoded.records) {
            telemetryRepo.store(imei, rec, seenIso);
          }
          deviceRepo.upsert(imei, seenIso, true);
        }

        // Send 4-byte big-endian ACK
        const ack = Buffer.from(createAvlAcknowledgement(decoded.records.length));
        socket.write(ack);
        console.log(`[TCP] PACKET ACK ${imei}: ${decoded.records.length} records`);
      }
    } catch (err) {
      console.error(`[TCP] Error processing data from ${remote}:`, err);
      socket.destroy();
    }
  });

  socket.on('close', () => {
    if (imei) {
      deviceRepo.upsert(imei, new Date().toISOString(), false);
      console.log(`[TCP] DEVICE DISCONNECTED ${imei}`);
    } else {
      console.log(`[TCP] DEVICE DISCONNECTED ${remote}`);
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
app.use(express.json());

// API Endpoints matching ZainFleet original C# WebApplication
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    tcpPort: TCP_PORT,
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

// Simulation endpoint: Ingest packet for an IMEI or run fixture test
app.post('/api/simulate/packet', (req: Request, res: Response) => {
  try {
    const { imei, type, latitude, longitude, speed, altitude, angle, satellites } = req.body;
    const targetImei = imei || '123456789012345';
    if (!isValidImei(targetImei)) {
      res.status(400).json({ error: 'IMEI must contain exactly 15 digits' });
      return;
    }

    let frameBytes: Uint8Array;
    if (type === 'codec8ext') {
      frameBytes = buildCodec8ExtendedTestPacket({
        timestampMs: Date.now(),
        latitude: typeof latitude === 'number' ? latitude : 24.7136,
        longitude: typeof longitude === 'number' ? longitude : 46.6753,
        speed: typeof speed === 'number' ? speed : 55,
        altitude: typeof altitude === 'number' ? altitude : 610,
        angle: typeof angle === 'number' ? angle : 120,
        satellites: typeof satellites === 'number' ? satellites : 11,
      });
    } else {
      frameBytes = buildCodec8TestPacket({
        timestampMs: Date.now(),
        latitude: typeof latitude === 'number' ? latitude : 24.7136,
        longitude: typeof longitude === 'number' ? longitude : 46.6753,
        speed: typeof speed === 'number' ? speed : 72,
        altitude: typeof altitude === 'number' ? altitude : 615,
        angle: typeof angle === 'number' ? angle : 95,
        satellites: typeof satellites === 'number' ? satellites : 14,
      });
    }

    const decoded = decodeTeltonikaFrame(frameBytes);
    const now = new Date().toISOString();
    deviceRepo.upsert(targetImei, now, true);
    for (const rec of decoded.records) {
      telemetryRepo.store(targetImei, rec, now);
    }

    res.json({
      success: true,
      imei: targetImei,
      recordsIngested: decoded.records.length,
      codecId: decoded.codecId,
      acknowledgementHex: decoded.acknowledgementHex,
      latestRecord: decoded.records[0],
      rawFrameHex: bytesToHexString(frameBytes),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Simulation failed' });
  }
});

// Device status toggling
app.post('/api/devices/:imei/toggle-connection', (req: Request, res: Response) => {
  const imei = String(req.params.imei);
  const current = deviceRepo.get(imei);
  if (!current) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  const updated = deviceRepo.upsert(imei, new Date().toISOString(), !current.connected);
  res.json(updated);
});

// Setup Vite or static serving
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProd) {
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

  const serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZainFleet HTTP server running on http://0.0.0.0:${PORT}`);
  });

  serverInstance.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[HTTP Server Notice] Port ${PORT} is already in use (EADDRINUSE). Another instance is already serving traffic.`);
    } else {
      console.error(`[HTTP Server Error]`, err);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
