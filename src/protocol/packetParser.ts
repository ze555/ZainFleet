import { AvlRecord, IoElement, ParsedAvlPacket } from '../types/fleet.js';
import { computeTeltonikaCrc16 } from './crc16.js';

export class AvlDataReader {
  private offset = 0;
  private readonly data: Uint8Array;

  constructor(data: Uint8Array | Buffer) {
    this.data = data instanceof Uint8Array ? data : new Uint8Array(data);
  }

  get position(): number {
    return this.offset;
  }

  get remaining(): number {
    return this.data.length - this.offset;
  }

  readByte(): number {
    const bytes = this.read(1);
    return bytes[0];
  }

  readUInt16(): number {
    const bytes = this.read(2);
    return (bytes[0] << 8) | bytes[1];
  }

  readInt16(): number {
    const unsigned = this.readUInt16();
    return (unsigned & 0x8000) ? unsigned - 0x10000 : unsigned;
  }

  readUInt32(): number {
    const bytes = this.read(4);
    return ((bytes[0] << 24) >>> 0) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  }

  readInt32(): number {
    const unsigned = this.readUInt32();
    return unsigned | 0; // Sign-extend to 32-bit signed
  }

  readUInt64(): bigint {
    const bytes = this.read(8);
    let val = 0n;
    for (let i = 0; i < 8; i++) {
      val = (val << 8n) | BigInt(bytes[i]);
    }
    return val;
  }

  readBytes(length: number): Uint8Array {
    return this.read(length);
  }

  private read(length: number): Uint8Array {
    if (length < 0 || length > this.remaining) {
      throw new Error(`AVL record is truncated or malformed. Requested ${length} bytes, remaining ${this.remaining}`);
    }
    const result = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }
}

function bufferToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}

export function readValue(reader: AvlDataReader, length: number): string {
  switch (length) {
    case 1:
      return reader.readByte().toString();
    case 2:
      return reader.readUInt16().toString();
    case 4:
      return reader.readUInt32().toString();
    case 8:
      return reader.readUInt64().toString();
    default:
      throw new Error(`Unsupported IO scalar width: ${length}`);
  }
}

interface IoData {
  eventIoId: number;
  elements: IoElement[];
}

function readCodec8Io(reader: AvlDataReader): IoData {
  const eventId = reader.readByte();
  const total = reader.readByte();
  const values: IoElement[] = [];

  const readGroup = (valueLength: number): number => {
    const count = reader.readByte();
    for (let i = 0; i < count; i++) {
      const id = reader.readByte();
      const raw = readValue(reader, valueLength);
      values.push({ id, value: raw, byteLength: valueLength });
    }
    return count;
  };

  const readVariableGroup = (): number => {
    const count = reader.readByte();
    for (let i = 0; i < count; i++) {
      const id = reader.readByte();
      const length = reader.readByte();
      if (length === 0 || length > reader.remaining) {
        throw new Error(`Invalid variable-length IO element. Id=${id}, Length=${length}`);
      }
      const rawHex = bufferToHex(reader.readBytes(length));
      values.push({ id, value: rawHex, byteLength: length });
    }
    return count;
  };

  const actual =
    readGroup(1) +
    readGroup(2) +
    readGroup(4) +
    readGroup(8) +
    readVariableGroup();

  if (actual !== total) {
    throw new Error(`Codec 8 IO element count does not match total. Expected=${total}, Actual=${actual}`);
  }

  return { eventIoId: eventId, elements: values };
}

function readCodec8ExtendedIo(reader: AvlDataReader): IoData {
  const eventId = reader.readUInt16();
  const total = reader.readUInt16();
  const values: IoElement[] = [];

  const readGroup = (valueLength: number): number => {
    const count = reader.readUInt16();
    for (let i = 0; i < count; i++) {
      const id = reader.readUInt16();
      const raw = readValue(reader, valueLength);
      values.push({ id, value: raw, byteLength: valueLength });
    }
    return count;
  };

  const readVariableGroup = (): number => {
    const count = reader.readUInt16();
    for (let i = 0; i < count; i++) {
      const id = reader.readUInt16();
      const length = reader.readUInt16();
      if (length === 0 || length > reader.remaining) {
        throw new Error(`Invalid variable-length IO element. Id=${id}, Length=${length}`);
      }
      const rawHex = bufferToHex(reader.readBytes(length));
      values.push({ id, value: rawHex, byteLength: length });
    }
    return count;
  };

  const actual =
    readGroup(1) +
    readGroup(2) +
    readGroup(4) +
    readGroup(8) +
    readVariableGroup();

  if (actual !== total) {
    throw new Error(`Codec 8 Extended IO element count does not match total. Expected=${total}, Actual=${actual}`);
  }

  return { eventIoId: eventId, elements: values };
}

function readRecord(codecId: number, reader: AvlDataReader): AvlRecord {
  const timestampRaw = reader.readUInt64();
  const timestampMs = Number(timestampRaw);
  const timestamp = new Date(timestampMs).toISOString();

  const priority = reader.readByte();
  const longitude = reader.readInt32() / 10000000;
  const latitude = reader.readInt32() / 10000000;
  const altitude = reader.readInt16();
  const angle = reader.readUInt16();
  const satellites = reader.readByte();
  const speed = reader.readUInt16();

  const io = codecId === 0x8E ? readCodec8ExtendedIo(reader) : readCodec8Io(reader);

  return {
    timestamp,
    timestampMs,
    priority,
    longitude,
    latitude,
    altitude,
    angle,
    satellites,
    speed,
    eventIoId: io.eventIoId,
    ioElements: io.elements,
  };
}

export function parseTeltonikaDataField(dataField: Uint8Array): ParsedAvlPacket {
  const reader = new AvlDataReader(dataField);
  const codecId = reader.readByte();

  if (codecId !== 0x08 && codecId !== 0x8E) {
    throw new Error(`Unsupported Teltonika codec: 0x${codecId.toString(16).toUpperCase().padStart(2, '0')}`);
  }

  const recordCount = codecId === 0x8E ? reader.readUInt16() : reader.readByte();
  const records: AvlRecord[] = [];

  for (let i = 0; i < recordCount; i++) {
    records.push(readRecord(codecId, reader));
  }

  const secondCount = codecId === 0x8E ? reader.readUInt16() : reader.readByte();
  if (secondCount !== recordCount) {
    throw new Error(`AVL record count mismatch. First=${recordCount}, Second=${secondCount}`);
  }

  if (reader.remaining !== 0) {
    throw new Error(`AVL packet has unexpected trailing bytes (${reader.remaining} bytes)`);
  }

  return { codecId, records };
}

export interface DecodedFrameResult {
  validPreamble: boolean;
  dataLength: number;
  expectedCrc: number;
  actualCrc: number;
  crcValid: boolean;
  codecId: number;
  records: AvlRecord[];
  acknowledgementHex: string;
}

export function decodeTeltonikaFrame(frameBytes: Uint8Array): DecodedFrameResult {
  if (frameBytes.length < 12) {
    throw new Error(`Packet too short (${frameBytes.length} bytes, minimum 12 required)`);
  }

  // Preamble: 4 zero bytes
  const isPreambleZero =
    frameBytes[0] === 0 &&
    frameBytes[1] === 0 &&
    frameBytes[2] === 0 &&
    frameBytes[3] === 0;

  if (!isPreambleZero) {
    throw new Error('AVL packet preamble is not zero');
  }

  // Data length: 4 bytes big endian
  const dataLength =
    ((frameBytes[4] << 24) >>> 0) |
    (frameBytes[5] << 16) |
    (frameBytes[6] << 8) |
    frameBytes[7];

  const expectedTotalLength = 8 + dataLength + 4;
  if (frameBytes.length < expectedTotalLength) {
    throw new Error(
      `Packet incomplete: Expected ${expectedTotalLength} bytes (dataLength=${dataLength}), but got ${frameBytes.length} bytes`
    );
  }

  const dataField = frameBytes.subarray(8, 8 + dataLength);
  const actualCrc = computeTeltonikaCrc16(dataField);

  const crcOffset = 8 + dataLength;
  const transmittedCrc =
    ((frameBytes[crcOffset] << 24) >>> 0) |
    (frameBytes[crcOffset + 1] << 16) |
    (frameBytes[crcOffset + 2] << 8) |
    frameBytes[crcOffset + 3];

  const crcValid = transmittedCrc === actualCrc;
  if (!crcValid) {
    throw new Error(
      `AVL packet CRC-16 validation failed. Expected 0x${actualCrc.toString(16).toUpperCase().padStart(4, '0')}, transmitted 0x${transmittedCrc.toString(16).toUpperCase()}`
    );
  }

  const { codecId, records } = parseTeltonikaDataField(dataField);
  const ack = createAvlAcknowledgement(records.length);

  return {
    validPreamble: isPreambleZero,
    dataLength,
    expectedCrc: transmittedCrc,
    actualCrc,
    crcValid,
    codecId,
    records,
    acknowledgementHex: bufferToHex(ack),
  };
}

export function createAvlAcknowledgement(recordCount: number): Uint8Array {
  if (recordCount < 0 || recordCount > 0xFFFF) {
    throw new Error(`Invalid record count for ACK: ${recordCount}`);
  }
  const ack = new Uint8Array(4);
  ack[0] = (recordCount >>> 24) & 0xFF;
  ack[1] = (recordCount >>> 16) & 0xFF;
  ack[2] = (recordCount >>> 8) & 0xFF;
  ack[3] = recordCount & 0xFF;
  return ack;
}

export function createImeiResponse(accepted: boolean): Uint8Array {
  return new Uint8Array([accepted ? 0x01 : 0x00]);
}
