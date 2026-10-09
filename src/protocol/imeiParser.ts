/**
 * Validates and extracts a 15-digit Teltonika IMEI string.
 */
export function tryParseImei(payload: Uint8Array | Buffer): string | null {
  if (payload.length !== 15) {
    return null;
  }

  let imei = '';
  for (let i = 0; i < payload.length; i++) {
    const byte = payload[i];
    // Check if ASCII character '0' (48) to '9' (57)
    if (byte < 48 || byte > 57) {
      return null;
    }
    imei += String.fromCharCode(byte);
  }

  return imei;
}

export function isValidImei(imei: string): boolean {
  return /^\d{15}$/.test(imei);
}
