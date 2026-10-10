export interface IoElement {
  id: number;
  value: string;
  byteLength: number;
}

export interface AvlRecord {
  timestamp: string; // ISO 8601 string representation of timestamp
  timestampMs: number;
  priority: number;
  longitude: number;
  latitude: number;
  altitude: number;
  angle: number;
  satellites: number;
  speed: number;
  eventIoId: number;
  ioElements: IoElement[];
}

export interface DeviceInfo {
  imei: string;
  firstSeen: string;
  lastSeen: string;
  connected: boolean;
}

export interface TelemetrySnapshot {
  imei: string;
  record: AvlRecord;
  receivedAt: string;
}

export interface ParsedAvlPacket {
  codecId: number;
  records: AvlRecord[];
}
