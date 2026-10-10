import { AvlRecord, CanMetrics, VehicleAlert, VehicleTrip, TripPoint } from '../types/fleet.js';

/**
 * Parses numeric IO value from string (which might be decimal or hex representation)
 */
function parseIoNumber(val: string | undefined): number | null {
  if (val === undefined || val === null || val === '') return null;
  // If numeric string
  const num = Number(val);
  if (!Number.isNaN(num)) return num;
  // If hex string
  const hexNum = parseInt(val, 16);
  if (!Number.isNaN(hexNum)) return hexNum;
  return null;
}

/**
 * Decodes all standard Teltonika FMB140 M-CAN & C-CAN bus IO parameters
 */
export function decodeCanMetrics(record: AvlRecord): CanMetrics {
  const ioMap = new Map<number, string>();
  for (const el of record.ioElements || []) {
    ioMap.set(el.id, el.value);
  }

  // Helper to get numeric value
  const getNum = (id: number): number | null => parseIoNumber(ioMap.get(id));

  // --- Ignition (IO 239 or DIN1 IO 1) ---
  const io239 = getNum(239);
  const io1 = getNum(1);
  const ignition = (io239 !== null ? io239 === 1 : (io1 !== null ? io1 === 1 : record.speed > 0));

  // --- Movement Status (IO 240 or speed > 0) ---
  const io240 = getNum(240);
  const isMoving = (io240 !== null ? io240 === 1 : record.speed > 2);

  // --- Engine RPM (IO 85, IO 86, IO 33) ---
  let engineRpm = getNum(85);
  if (engineRpm === null) engineRpm = getNum(86);
  if (engineRpm === null) engineRpm = getNum(33);
  // Sanity check for RPM (0 - 9000)
  if (engineRpm !== null && (engineRpm < 0 || engineRpm > 12000)) {
    engineRpm = null;
  }

  // --- Speed ---
  const gpsSpeed = record.speed;
  const canSpeedRaw = getNum(81) ?? getNum(24);

  // --- Engine Coolant Temperature (IO 115, IO 32) ---
  let coolantTempC = getNum(115);
  if (coolantTempC === null) coolantTempC = getNum(32);
  // Some CAN profiles send coolant with -40 offset if raw byte is 0-255
  if (coolantTempC !== null) {
    if (coolantTempC > 180) {
      coolantTempC = coolantTempC - 40;
    }
  }

  // --- Engine Oil Temperature (IO 162) ---
  const oilTempC = getNum(162);

  // --- Engine Work Hours (IO 102) ---
  const rawWorkHours = getNum(102);
  const engineWorkHours = rawWorkHours !== null ? Math.round(rawWorkHours / 3600) : null;

  // --- Fuel Level % & Liters (IO 89, IO 90, IO 9) ---
  let fuelLevelPercent = getNum(89);
  if (fuelLevelPercent !== null && (fuelLevelPercent < 0 || fuelLevelPercent > 100)) {
    // If not in 0-100 range, clamp or ignore
    fuelLevelPercent = Math.min(100, Math.max(0, fuelLevelPercent));
  }
  const fuelLevelLiters = getNum(90);

  // --- Total Fuel Used (IO 83, IO 84, IO 87) ---
  const totalFuelUsedLiters = getNum(83) ?? getNum(84) ?? getNum(87);

  // --- Fuel Rate (IO 179) ---
  const fuelRateLitersPerHour = getNum(179);

  // --- Odometer (IO 87, IO 88, IO 16, IO 105) ---
  let odometerKm: number | null = null;
  const rawOdo16 = getNum(16);
  const rawOdo87 = getNum(87);
  const rawOdo88 = getNum(88);
  const rawOdo105 = getNum(105);

  if (rawOdo88 !== null && rawOdo88 > 0) {
    odometerKm = rawOdo88;
  } else if (rawOdo87 !== null && rawOdo87 > 0) {
    // If > 2,000,000 it might be in meters
    odometerKm = rawOdo87 > 1000000 ? Math.round(rawOdo87 / 1000) : rawOdo87;
  } else if (rawOdo16 !== null && rawOdo16 > 0) {
    odometerKm = Math.round(rawOdo16 / 1000);
  } else if (rawOdo105 !== null && rawOdo105 > 0) {
    odometerKm = Math.round(rawOdo105 / 1000);
  }

  // --- Trip Odometer (IO 250) ---
  const rawTripOdo = getNum(250);
  const tripOdometerKm = rawTripOdo !== null ? Math.round((rawTripOdo / 1000) * 10) / 10 : null;

  // --- Voltages (IO 66 external in mV, IO 67 internal in mV) ---
  const rawVehicleMv = getNum(66);
  const vehicleVoltage = rawVehicleMv !== null ? Math.round((rawVehicleMv / 1000) * 10) / 10 : null;

  const rawTrackerMv = getNum(67);
  const trackerBatteryVoltage = rawTrackerMv !== null ? Math.round((rawTrackerMv / 1000) * 10) / 10 : null;

  const isAlternatorCharging = vehicleVoltage !== null ? vehicleVoltage >= 13.2 : false;

  // --- C-CAN Doors Status (IO 100) ---
  const rawDoors = getNum(100);
  let doors: CanMetrics['doors'] = null;
  if (rawDoors !== null) {
    const driverOpen = (rawDoors & 0x01) !== 0;
    const passengerOpen = (rawDoors & 0x02) !== 0;
    const rearLeftOpen = (rawDoors & 0x04) !== 0;
    const rearRightOpen = (rawDoors & 0x08) !== 0;
    const hoodOpen = (rawDoors & 0x10) !== 0;
    const trunkOpen = (rawDoors & 0x20) !== 0;
    doors = {
      driverOpen,
      passengerOpen,
      rearLeftOpen,
      rearRightOpen,
      hoodOpen,
      trunkOpen,
      anyOpen: driverOpen || passengerOpen || rearLeftOpen || rearRightOpen || hoodOpen || trunkOpen,
    };
  }

  // --- Security Flags (IO 132) ---
  const rawSec = getNum(132);
  let seatbeltFastened: boolean | null = null;
  let handbrakeEngaged: boolean | null = null;
  let checkEngineLight: boolean | null = null;
  if (rawSec !== null) {
    handbrakeEngaged = (rawSec & 0x01) !== 0;
    seatbeltFastened = (rawSec & 0x02) !== 0;
    checkEngineLight = (rawSec & 0x08) !== 0;
  }

  // --- GSM & Operator (IO 21, IO 241) ---
  const gsmSignalBars = getNum(21) ?? getNum(6);
  const operatorCode = ioMap.get(241) || null;

  return {
    ignition,
    isMoving,
    engineRpm,
    speedKmH: gpsSpeed,
    canSpeedKmH: canSpeedRaw,
    coolantTempC,
    oilTempC,
    engineWorkHours,
    fuelLevelPercent,
    fuelLevelLiters,
    totalFuelUsedLiters,
    fuelRateLitersPerHour,
    odometerKm,
    tripOdometerKm,
    vehicleVoltage,
    trackerBatteryVoltage,
    isAlternatorCharging,
    doors,
    seatbeltFastened,
    handbrakeEngaged,
    checkEngineLight,
    satellites: record.satellites,
    altitudeMeters: record.altitude,
    headingDegrees: record.angle,
    gsmSignalBars,
    operatorCode,
    rawIoCount: record.ioElements?.length || 0,
  };
}

/**
 * Analyzes CAN metrics and returns active user-friendly alerts
 */
export function generateVehicleAlerts(metrics: CanMetrics): VehicleAlert[] {
  const alerts: VehicleAlert[] = [];
  const now = new Date().toISOString();

  // 1. Coolant Overheating Alert
  if (metrics.coolantTempC !== null && metrics.coolantTempC >= 105) {
    alerts.push({
      id: 'alert-overheat',
      type: 'danger',
      titleAr: 'تحذير: حرارة المحرك مرتفعة جداً!',
      titleEn: 'Engine Overheating Warning!',
      messageAr: `حرارة سائل التبريد وصلت إلى ${metrics.coolantTempC}°C. يُنصح بإيقاف المركبة وفحص مروحة التبريد ومستوى الماء.`,
      messageEn: `Coolant temperature reached ${metrics.coolantTempC}°C. Stop vehicle and check cooling system.`,
      timestamp: now,
    });
  }

  // 2. Low Fuel Warning
  if (metrics.fuelLevelPercent !== null && metrics.fuelLevelPercent <= 15) {
    alerts.push({
      id: 'alert-low-fuel',
      type: 'warning',
      titleAr: 'مستوى الوقود منخفض',
      titleEn: 'Low Fuel Alert',
      messageAr: `مستوى خزان الوقود ${metrics.fuelLevelPercent}%. يُرجى التوجه لأقرب محطة وقود.`,
      messageEn: `Fuel level is down to ${metrics.fuelLevelPercent}%. Refuel soon.`,
      timestamp: now,
    });
  }

  // 3. Vehicle Battery Low Voltage Warning
  if (metrics.vehicleVoltage !== null && metrics.vehicleVoltage <= 11.8 && !metrics.ignition) {
    alerts.push({
      id: 'alert-low-battery',
      type: 'warning',
      titleAr: 'بطارية السيارة ضعيفة',
      titleEn: 'Low Vehicle Battery Voltage',
      messageAr: `جهد بطارية السيارة ${metrics.vehicleVoltage}V (أقل من الطبيعي). قد تحتاج البطارية للشحن أو الاستبدال.`,
      messageEn: `Car battery voltage is ${metrics.vehicleVoltage}V while parked. Inspect battery health.`,
      timestamp: now,
    });
  }

  // 4. Alternator Not Charging Warning (Engine Running but voltage low)
  if (metrics.ignition && metrics.vehicleVoltage !== null && metrics.vehicleVoltage < 12.8) {
    alerts.push({
      id: 'alert-alternator',
      type: 'danger',
      titleAr: 'تنبيه: دينامو الشحن لا يشحن البطارية!',
      titleEn: 'Alternator Charging Fault',
      messageAr: `المحرك يعمل ولكن جهد النظام ${metrics.vehicleVoltage}V فقط. افحص دينامو الشحن وسير المحرك.`,
      messageEn: `Engine running but system voltage is only ${metrics.vehicleVoltage}V. Alternator may not be charging.`,
      timestamp: now,
    });
  }

  // 5. Door Open while moving
  if (metrics.isMoving && metrics.doors && metrics.doors.anyOpen) {
    alerts.push({
      id: 'alert-door-open',
      type: 'danger',
      titleAr: 'تحذير: أحد أبواب السيارة مفتوح أثناء الحركة!',
      titleEn: 'Door Ajar Warning While Moving',
      messageAr: 'تم اكتشاف باب أو صندوق مفتوح أثناء سير المركبة.',
      messageEn: 'Door, hood or trunk is open while vehicle is in motion.',
      timestamp: now,
    });
  }

  // 6. Check Engine Light (MIL)
  if (metrics.checkEngineLight) {
    alerts.push({
      id: 'alert-check-engine',
      type: 'warning',
      titleAr: 'لمبة فحص المحرك مضاءة (Check Engine)',
      titleEn: 'Check Engine Warning (MIL Active)',
      messageAr: 'نظام تشخيص المركبة يسجل رمز عطل في كمبيوتر السيارة (DTC).',
      messageEn: 'Onboard diagnostics reports active engine fault codes.',
      timestamp: now,
    });
  }

  return alerts;
}

/**
 * Calculates distance between two GPS coordinates using Haversine formula (km)
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Segments an array of AvlRecords into discrete trips (رحلات سابقة)
 * Groups records based on movement/ignition and gaps > 5 minutes.
 */
export function segmentRecordsIntoTrips(records: AvlRecord[]): VehicleTrip[] {
  if (!records || records.length === 0) return [];

  // Sort chronological
  const sorted = [...records].sort((a, b) => a.timestampMs - b.timestampMs);

  const trips: VehicleTrip[] = [];
  let currentPoints: TripPoint[] = [];

  const flushTrip = () => {
    if (currentPoints.length < 2) {
      currentPoints = [];
      return;
    }

    const first = currentPoints[0];
    const last = currentPoints[currentPoints.length - 1];
    const durationMs = last.timestampMs - first.timestampMs;
    const durationMinutes = Math.max(1, Math.round(durationMs / (1000 * 60)));

    let totalDistKm = 0;
    let maxSpeed = 0;
    let speedSum = 0;

    for (let i = 0; i < currentPoints.length; i++) {
      const p = currentPoints[i];
      if (p.speed > maxSpeed) maxSpeed = p.speed;
      speedSum += p.speed;

      if (i > 0) {
        const prev = currentPoints[i - 1];
        totalDistKm += calculateHaversineDistanceKm(prev.lat, prev.lng, p.lat, p.lng);
      }
    }

    const avgSpeed = Math.round(speedSum / currentPoints.length);

    const startFuel = first.fuelPercent ?? null;
    const endFuel = last.fuelPercent ?? null;
    let fuelConsumedPercent: number | null = null;
    if (startFuel !== null && endFuel !== null && startFuel >= endFuel) {
      fuelConsumedPercent = Math.round((startFuel - endFuel) * 10) / 10;
    }

    trips.push({
      id: `trip-${first.timestampMs}`,
      startTime: first.timestamp,
      endTime: last.timestamp,
      durationMinutes,
      distanceKm: Math.round(totalDistKm * 10) / 10,
      maxSpeedKmH: Math.round(maxSpeed),
      avgSpeedKmH: avgSpeed,
      startFuelPercent: startFuel,
      endFuelPercent: endFuel,
      fuelConsumedPercent,
      startCoords: [first.lat, first.lng],
      endCoords: [last.lat, last.lng],
      points: currentPoints,
    });

    currentPoints = [];
  };

  const GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes stationary/gap ends a trip

  for (let i = 0; i < sorted.length; i++) {
    const rec = sorted[i];
    const metrics = decodeCanMetrics(rec);
    const point: TripPoint = {
      lat: rec.latitude,
      lng: rec.longitude,
      speed: rec.speed,
      timestamp: rec.timestamp,
      timestampMs: rec.timestampMs,
      rpm: metrics.engineRpm,
      fuelPercent: metrics.fuelLevelPercent,
    };

    if (currentPoints.length === 0) {
      currentPoints.push(point);
      continue;
    }

    const lastPoint = currentPoints[currentPoints.length - 1];
    const gap = point.timestampMs - lastPoint.timestampMs;

    // Check if new trip should start
    if (gap > GAP_THRESHOLD_MS) {
      flushTrip();
      currentPoints.push(point);
    } else {
      currentPoints.push(point);
    }
  }

  // Flush final trip
  flushTrip();

  // Return trips with newest first
  return trips.reverse();
}
