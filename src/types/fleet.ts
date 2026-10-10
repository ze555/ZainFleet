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
  name?: string;
  firstSeen: string;
  lastSeen: string; // compatibility field
  lastPacketAt: string; // timestamp when server received latest TCP packet
  lastGpsAt?: string; // GPS fix timestamp of latest AVL record
  tcpConnected: boolean; // whether active TCP socket is open right now
  connected: boolean; // backward compatibility alias
  connectionStatus: 'online' | 'standby' | 'offline';
  totalRecords?: number;
  totalDistanceKm?: number;
}

export interface TelemetrySnapshot {
  imei: string;
  record: AvlRecord;
  receivedAt: string;
  freshnessSeconds?: number;
  isStale?: boolean;
}

export interface ParsedAvlPacket {
  codecId: number;
  records: AvlRecord[];
}

// Classification of parameter sources
export type ParameterSource =
  | 'device_io' // Measured directly by tracker hardware (DIN1, ADC, Internal Battery, External Voltage, Movement, GSM)
  | 'can_powertrain' // Vehicle CAN bus (M-CAN / CAN1) - Engine RPM, Speed, Fuel Level, Coolant Temp, Odometer
  | 'can_comfort' // Vehicle CAN bus (C-CAN / CAN2) - Doors, Hood, Trunk, Seatbelt, Handbrake
  | 'obd' // Standard OBD-II PID parameters
  | 'diagnostic'; // Manufacturer trouble codes or custom raw frames

export interface CanParameterDefinition {
  id: number;
  officialName: string;
  nameAr: string;
  nameEn: string;
  source: ParameterSource;
  sourceBusLabelAr: string;
  sourceBusLabelEn: string;
  byteLength: number;
  signed: boolean;
  multiplier: number;
  unit: string;
  valueRange: string;
  descriptionAr: string;
  descriptionEn: string;
  configDependency: string;
  verified: boolean;
  documentationUrl: string;
}

export interface DecodedCanParameter {
  id: number;
  raw: string;
  rawNumber: number | null;
  formatted: string;
  numericValue: number | null;
  unit: string;
  definition: CanParameterDefinition;
  status: 'active' | 'not_reported' | 'unsupported';
}

// Decoded CAN Bus Metrics for the dashboard
export interface CanMetrics {
  // Ignition & Engine State
  ignition: {
    isOn: boolean;
    source: 'IO239' | 'DIN1' | 'SPEED' | 'NONE';
    labelAr: string;
    labelEn: string;
    verified: boolean;
  };

  isMoving: {
    state: boolean;
    source: 'IO240' | 'SPEED';
    labelAr: string;
    labelEn: string;
  };

  // Speed
  speed: {
    gpsKmH: number;
    canKmH: number | null;
    displaySpeedKmH: number;
    source: 'CAN' | 'GPS';
  };

  // Engine Performance (M-CAN / OBD)
  engine: {
    rpm: number | null; // RPM
    coolantTempC: number | null; // °C
    oilTempC: number | null; // °C
    workHours: number | null; // Hours
    loadPercent: number | null; // %
  };

  // Fuel & Consumption (M-CAN / OBD)
  fuel: {
    levelPercent: number | null; // % (0-100)
    levelLiters: number | null; // Liters
    totalConsumedLiters: number | null; // Liters
    instantRateLitersPerHour: number | null; // L/h
  };

  // Odometer & Mileage
  odometer: {
    totalKm: number | null; // Total vehicle km from CAN
    tripKm: number | null; // Trip km
    source: 'CAN_ODOMETER' | 'GPS_ACCUMULATED' | 'NONE';
  };

  // Electrical System
  electrical: {
    vehicleVoltageV: number | null; // Volts (external)
    trackerBatteryV: number | null; // Volts (internal backup)
    alternatorStatus: 'charging' | 'battery_only' | 'low_voltage' | 'unknown';
    alternatorStatusAr: string;
    alternatorStatusEn: string;
  };

  // Comfort & Security (C-CAN)
  comfort: {
    hasDoorData: boolean;
    doors: {
      driverOpen: boolean;
      passengerOpen: boolean;
      rearLeftOpen: boolean;
      rearRightOpen: boolean;
      hoodOpen: boolean;
      trunkOpen: boolean;
      anyOpen: boolean;
    };
    seatbeltFastened: boolean | null;
    handbrakeEngaged: boolean | null;
    checkEngineLight: boolean | null;
  };

  // GNSS & Connectivity
  gnss: {
    satellites: number;
    altitudeMeters: number;
    headingDegrees: number;
    isFixValid: boolean;
  };

  cellular: {
    signalBars: number | null; // 0-5
    operatorCode: string | null;
  };

  // Raw Diagnostic info
  rawIoCount: number;
  activeCanIds: number[];
}

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
  parameterId?: number;
}
