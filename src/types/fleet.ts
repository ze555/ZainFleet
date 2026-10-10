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
  totalRecords?: number;
  totalDistanceKm?: number;
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

// Decoded CAN Bus Metrics for everyday driver dashboard
export interface CanMetrics {
  // Engine & Performance (M-CAN)
  ignition: boolean;
  isMoving: boolean;
  engineRpm: number | null;
  speedKmH: number;
  canSpeedKmH: number | null;
  coolantTempC: number | null;
  oilTempC: number | null;
  engineWorkHours: number | null;
  
  // Fuel & Consumption (M-CAN)
  fuelLevelPercent: number | null;
  fuelLevelLiters: number | null;
  totalFuelUsedLiters: number | null;
  fuelRateLitersPerHour: number | null;

  // Mileage & Odometer (M-CAN)
  odometerKm: number | null;
  tripOdometerKm: number | null;

  // Electrical & Battery System
  vehicleVoltage: number | null; // Volts (e.g. 13.8V)
  trackerBatteryVoltage: number | null; // Volts (e.g. 4.1V)
  isAlternatorCharging: boolean;

  // Doors & Comfort Security (C-CAN)
  doors: {
    driverOpen: boolean;
    passengerOpen: boolean;
    rearLeftOpen: boolean;
    rearRightOpen: boolean;
    hoodOpen: boolean;
    trunkOpen: boolean;
    anyOpen: boolean;
  } | null;
  seatbeltFastened: boolean | null;
  handbrakeEngaged: boolean | null;
  checkEngineLight: boolean | null;

  // GPS & GSM Signal
  satellites: number;
  altitudeMeters: number;
  headingDegrees: number;
  gsmSignalBars: number | null;
  operatorCode: string | null;

  // Raw element count
  rawIoCount: number;
}

// Past Trip Definition
export interface TripPoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: string;
  timestampMs: number;
  rpm?: number | null;
  fuelPercent?: number | null;
}

export interface VehicleTrip {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  distanceKm: number;
  maxSpeedKmH: number;
  avgSpeedKmH: number;
  startFuelPercent: number | null;
  endFuelPercent: number | null;
  fuelConsumedPercent: number | null;
  startCoords: [number, number];
  endCoords: [number, number];
  points: TripPoint[];
}

export interface VehicleAlert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  timestamp: string;
}
