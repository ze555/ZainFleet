import net from 'node:net';
import express, { Request, Response } from 'express';
import cors from 'cors';
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

// No mock or simulation devices seeded. Only authentic live hardware devices connecting via TCP are stored.

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
          for (const rec of decoded.records) {
            telemetryRepo.store(imei, rec, seenIso);
          }
          deviceRepo.upsert(imei, seenIso, true);
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
