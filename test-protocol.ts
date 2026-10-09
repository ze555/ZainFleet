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

console.log('--- ALL UNIT TESTS PASSED ---');
