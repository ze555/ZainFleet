import { computeTeltonikaCrc16 } from './crc16.js';

export function createInt32Bytes(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

export function createInt16Bytes(value: number): number[] {
  return [
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

export function createUInt64Bytes(timestampMs: number): number[] {
  const bytes = new Array<number>(8);
  const big = BigInt(timestampMs);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = Number((big >> BigInt((7 - i) * 8)) & 0xffn);
  }
  return bytes;
}

/**
 * Builds a Codec 8 packet frame matching TestFixtureBuilder.Codec8Packet()
 */
export function buildCodec8TestPacket(options?: {
  timestampMs?: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  angle?: number;
  speed?: number;
  satellites?: number;
  priority?: number;
  eventIoId?: number;
  ioValue?: number;
}): Uint8Array {
  const ts = options?.timestampMs ?? 1_700_000_000_000;
  const lat = Math.round((options?.latitude ?? 0.54321) * 10_000_000);
  const lon = Math.round((options?.longitude ?? -0.1234567) * 10_000_000);
  const alt = options?.altitude ?? 120;
  const ang = options?.angle ?? 90;
  const spd = options?.speed ?? 42;
  const sats = options?.satellites ?? 8;
  const prio = options?.priority ?? 2;
  const eventId = options?.eventIoId ?? 7;
  const val = options?.ioValue ?? 42;

  const data: number[] = [0x08, 1]; // Codec 8, 1 record
  data.push(...createUInt64Bytes(ts));
  data.push(prio);
  data.push(...createInt32Bytes(lon));
  data.push(...createInt32Bytes(lat));
  data.push(...createInt16Bytes(alt));
  data.push(...createInt16Bytes(ang));
  data.push(sats);
  data.push(...createInt16Bytes(spd));

  // IO: eventId, total=1, group1(1, id=1, val), group2=0, group4=0, group8=0, varGroup=0
  data.push(eventId, 1, 1, 0x01, val & 0xff, 0, 0, 0, 0);
  data.push(1); // Second record count

  const dataField = new Uint8Array(data);
  const crc = computeTeltonikaCrc16(dataField);

  const frame = new Uint8Array(8 + dataField.length + 4);
  // Preamble: 4 zero bytes (already 0)
  // Data length:
  frame[4] = (dataField.length >>> 24) & 0xff;
  frame[5] = (dataField.length >>> 16) & 0xff;
  frame[6] = (dataField.length >>> 8) & 0xff;
  frame[7] = dataField.length & 0xff;

  frame.set(dataField, 8);

  const crcOffset = 8 + dataField.length;
  frame[crcOffset] = (crc >>> 24) & 0xff;
  frame[crcOffset + 1] = (crc >>> 16) & 0xff;
  frame[crcOffset + 2] = (crc >>> 8) & 0xff;
  frame[crcOffset + 3] = crc & 0xff;

  return frame;
}

/**
 * Builds a Codec 8 Extended packet frame matching TestFixtureBuilder.Codec8ExtendedPacket()
 */
export function buildCodec8ExtendedTestPacket(options?: {
  timestampMs?: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  angle?: number;
  speed?: number;
  satellites?: number;
  priority?: number;
}): Uint8Array {
  const ts = options?.timestampMs ?? 1_700_000_000_000;
  const lat = Math.round((options?.latitude ?? 0.54321) * 10_000_000);
  const lon = Math.round((options?.longitude ?? -0.1234567) * 10_000_000);
  const alt = options?.altitude ?? 120;
  const ang = options?.angle ?? 90;
  const spd = options?.speed ?? 42;
  const sats = options?.satellites ?? 8;
  const prio = options?.priority ?? 2;

  const data: number[] = [0x8e, 0, 1]; // Codec 8 Extended, 1 record
  data.push(...createUInt64Bytes(ts));
  data.push(prio);
  data.push(...createInt32Bytes(lon));
  data.push(...createInt32Bytes(lat));
  data.push(...createInt16Bytes(alt));
  data.push(...createInt16Bytes(ang));
  data.push(sats);
  data.push(...createInt16Bytes(spd));

  // Event ID = 42 (0x002A), Total = 2 (0x0002)
  // Group 1: count=1 (0x0001), id=1 (0x0001), value=1 (0x01)
  // Group 2: count=0, Group 4: count=0, Group 8: count=0
  // VarGroup: count=1 (0x0001), id=2 (0x0002), len=2 (0x0002), val=0xAB, 0xCD
  data.push(
    0, 0x2a, // eventId 42
    0, 2,    // total 2
    0, 1,    // group 1 count 1
    0, 1, 0x01, // id=1, val=1
    0, 0,    // group 2 count 0
    0, 0,    // group 4 count 0
    0, 0,    // group 8 count 0
    0, 1,    // var group count 1
    0, 2,    // id=2
    0, 2,    // length=2
    0xab, 0xcd // val ABCD
  );
  data.push(0, 1); // Second record count: 1 (uint16)

  const dataField = new Uint8Array(data);
  const crc = computeTeltonikaCrc16(dataField);

  const frame = new Uint8Array(8 + dataField.length + 4);
  frame[4] = (dataField.length >>> 24) & 0xff;
  frame[5] = (dataField.length >>> 16) & 0xff;
  frame[6] = (dataField.length >>> 8) & 0xff;
  frame[7] = dataField.length & 0xff;

  frame.set(dataField, 8);

  const crcOffset = 8 + dataField.length;
  frame[crcOffset] = (crc >>> 24) & 0xff;
  frame[crcOffset + 1] = (crc >>> 16) & 0xff;
  frame[crcOffset + 2] = (crc >>> 8) & 0xff;
  frame[crcOffset + 3] = crc & 0xff;

  return frame;
}

export function bytesToHexString(bytes: Uint8Array): string {
  let res = '';
  for (let i = 0; i < bytes.length; i++) {
    res += bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return res;
}

export function hexStringToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) {
    throw new Error('Hex string must have an even number of characters');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}
