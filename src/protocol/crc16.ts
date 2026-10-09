/**
 * Teltonika CRC-16/IBM implementation matching Teltonika Protocol spec.
 * Polynomial: 0xA001, initial value: 0x0000.
 */
export function computeTeltonikaCrc16(data: Uint8Array | Buffer): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 1) !== 0) {
        crc = ((crc >>> 1) ^ 0xA001) & 0xFFFF;
      } else {
        crc = (crc >>> 1) & 0xFFFF;
      }
    }
  }
  return crc & 0xFFFF;
}
