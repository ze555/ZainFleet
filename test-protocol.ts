import { computeTeltonikaCrc16 } from './src/protocol/crc16.js';
import { tryParseImei } from './src/protocol/imeiParser.js';
import {
  decodeTeltonikaFrame,
  createAvlAcknowledgement,
  createImeiResponse,
} from './src/protocol/packetParser.js';
import {
  buildCodec8TestPacket,
  buildCodec8ExtendedTestPacket,
} from './src/protocol/fixtures.js';

console.log('--- Running Protocol Unit Tests ---');

// Test 1: CRC-16 check value
const checkData = Buffer.from('123456789', 'ascii');
const crcCheck = computeTeltonikaCrc16(checkData);
console.assert(crcCheck === 0xbb3d, `CRC-16 mismatch: expected 0xBB3D, got 0x${crcCheck.toString(16)}`);
console.log('✓ CRC-16 known check value 0xBB3D matches');

// Test 2: IMEI parser
const validImeiBytes = Buffer.from('123456789012345', 'ascii');
const parsedValid = tryParseImei(validImeiBytes);
console.assert(parsedValid === '123456789012345', 'IMEI parser failed valid 15 digits');
const invalidImeiBytes = Buffer.from('1234x6789012345', 'ascii');
const parsedInvalid = tryParseImei(invalidImeiBytes);
console.assert(parsedInvalid === null, 'IMEI parser should reject non-digit character');
console.log('✓ IMEI parser correctly accepts 15 digits and rejects invalid');

// Test 3: Codec 8 decoding
const c8Frame = buildCodec8TestPacket();
const c8Decoded = decodeTeltonikaFrame(c8Frame);
console.assert(c8Decoded.codecId === 0x08, 'Codec ID should be 0x08');
console.assert(c8Decoded.records.length === 1, 'Should have 1 record');
const r8 = c8Decoded.records[0];
console.assert(r8.priority === 2, `Priority mismatch: ${r8.priority}`);
console.assert(Math.abs(r8.longitude - -0.1234567) < 0.000001, `Longitude mismatch: ${r8.longitude}`);
console.assert(Math.abs(r8.latitude - 0.54321) < 0.000001, `Latitude mismatch: ${r8.latitude}`);
console.assert(r8.altitude === 120, `Altitude mismatch: ${r8.altitude}`);
console.assert(r8.angle === 90, `Angle mismatch: ${r8.angle}`);
console.assert(r8.satellites === 8, `Satellites mismatch: ${r8.satellites}`);
console.assert(r8.speed === 42, `Speed mismatch: ${r8.speed}`);
console.assert(r8.eventIoId === 7, `EventIoId mismatch: ${r8.eventIoId}`);
console.assert(r8.ioElements.length === 1, `IoElements count mismatch: ${r8.ioElements.length}`);
console.assert(r8.ioElements[0].id === 1 && r8.ioElements[0].value === '42', 'IO element mismatch');
console.log('✓ Codec 8 packet decoded with accurate GPS and IO values');

// Test 4: Codec 8 Extended decoding
const c8ExtFrame = buildCodec8ExtendedTestPacket();
const c8ExtDecoded = decodeTeltonikaFrame(c8ExtFrame);
console.assert(c8ExtDecoded.codecId === 0x8e, 'Codec ID should be 0x8E');
console.assert(c8ExtDecoded.records.length === 1, 'Should have 1 record');
const r8Ext = c8ExtDecoded.records[0];
console.assert(r8Ext.eventIoId === 42, `EventIoId mismatch: ${r8Ext.eventIoId}`);
console.assert(r8Ext.ioElements.length === 2, `IoElements count: ${r8Ext.ioElements.length}`);
console.assert(r8Ext.ioElements[0].id === 1 && r8Ext.ioElements[0].value === '1', 'IO 1 mismatch');
console.assert(r8Ext.ioElements[1].id === 2 && r8Ext.ioElements[1].value === 'ABCD', 'IO 2 mismatch');
console.log('✓ Codec 8 Extended packet decoded with 16-bit IDs and variable length IO');

// Test 5: Corrupted CRC throws error
const corruptedFrame = new Uint8Array(c8Frame);
corruptedFrame[corruptedFrame.length - 1] ^= 0x01;
let threw = false;
try {
  decodeTeltonikaFrame(corruptedFrame);
} catch (e: any) {
  threw = true;
  console.assert(e.message.includes('CRC-16 validation failed'), 'Should indicate CRC error');
}
console.assert(threw, 'Should throw on corrupt CRC');
console.log('✓ Corrupted frame rejected by CRC-16 check');

// Test 6: ACK generation
const ack = createAvlAcknowledgement(2);
console.assert(ack[0] === 0 && ack[1] === 0 && ack[2] === 0 && ack[3] === 2, 'ACK mismatch');
console.log('✓ AVL ACK contains big-endian record count (4 bytes)');

// Test 7: Verify Codec 8 Extended variable-length IO and the standard 1-byte record counts
console.assert(r8Ext.ioElements[1].byteLength === 2, 'Codec 8 Extended NX byte length mismatch');
console.assert(r8Ext.ioElements[1].value === 'ABCD', 'Codec 8 Extended NX raw hex mismatch');
console.log('✓ Codec 8 Extended variable-length IO and uint8 record counts');

// Test 8: Real-world multi-record Codec 8 (multiple consecutive records with no trailing 5th group)
const multiData: number[] = [0x08, 2]; // Codec 8, 2 records
for (let r = 0; r < 2; r++) {
  multiData.push(...[0, 0, 1, 160, 134, 228, 225, 112]); // timestamp
  multiData.push(0); // priority
  multiData.push(...[7, 223, 172, 11]); // lon
  multiData.push(...[0, 240, 10, 20]); // lat
  multiData.push(...[0, 120]); // alt
  multiData.push(...[0, 90]); // angle
  multiData.push(12); // sats
  multiData.push(...[0, 45]); // speed
  // IO: eventId=1, total=1, N1=1 (id=1, val=1), N2=0, N4=0, N8=0 -> NO 5TH ZERO
  multiData.push(1, 1, 1, 1, 1, 0, 0, 0);
}
multiData.push(2); // Second record count = 2
const dataField8 = new Uint8Array(multiData);
const crc8 = computeTeltonikaCrc16(dataField8);
const frame8 = new Uint8Array(8 + dataField8.length + 4);
frame8[4] = (dataField8.length >>> 24) & 0xff;
frame8[5] = (dataField8.length >>> 16) & 0xff;
frame8[6] = (dataField8.length >>> 8) & 0xff;
frame8[7] = dataField8.length & 0xff;
frame8.set(dataField8, 8);
const crcOff8 = 8 + dataField8.length;
frame8[crcOff8] = (crc8 >>> 24) & 0xff;
frame8[crcOff8 + 1] = (crc8 >>> 16) & 0xff;
frame8[crcOff8 + 2] = (crc8 >>> 8) & 0xff;
frame8[crcOff8 + 3] = crc8 & 0xff;

const decoded8 = decodeTeltonikaFrame(frame8);
console.assert(decoded8.records.length === 2, 'Should decode 2 records');
console.assert(decoded8.records[0].speed === 45, 'Record 1 speed should be 45');
console.assert(decoded8.records[1].speed === 45, 'Record 2 speed should be 45');
console.assert(decoded8.records[1].satellites === 12, 'Record 2 satellites should be 12');
console.log('✓ Successfully decoded multi-record Codec 8 packet with standard Teltonika byte layout');

console.log('--- ALL UNIT TESTS PASSED ---');
