import React from 'react';
import { DeviceInfo, TelemetrySnapshot } from '../types/fleet.js';
import {
  Gauge,
  Zap,
  Thermometer,
  Fuel,
  Milestone,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Clock,
  Radio,
  Power,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

interface CanBusDashboardProps {
  device: DeviceInfo | null;
  telemetry: TelemetrySnapshot | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const CanBusDashboard: React.FC<CanBusDashboardProps> = ({
  device,
  telemetry,
  isLoading,
  onRefresh,
}) => {
  const record = telemetry?.record;
  const ioMap = React.useMemo(() => {
    const map = new Map<number, string>();
    if (record?.ioElements) {
      for (const el of record.ioElements) {
        map.set(el.id, el.value);
      }
    }
    return map;
  }, [record]);

  if (!device || !record) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <Gauge className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            CAN Bus Live Vehicle Dashboard
          </h2>
          <p className="text-sm text-slate-500 max-w-lg mx-auto mb-6">
            Waiting for live telemetry transmission from your connected Teltonika FMB140 tracker over TCP.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-w-md mx-auto text-left space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 font-semibold text-slate-700">
              <span>TCP Server Listening</span>
              <span className="text-emerald-600 flex items-center gap-1 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Port 5000
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">External TCP Host:</span>
              <span className="font-mono font-bold text-slate-800">hayabusa.proxy.rlwy.net</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">External TCP Port:</span>
              <span className="font-mono font-bold text-blue-600">39512</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Data Protocol:</span>
              <span className="font-mono text-slate-800">Codec 8 / Codec 8 Extended</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Extract CAN Bus Parameters ---
  // Ignition: DIN1 (ID 1) or Ignition (ID 239)
  const rawIgnition = ioMap.get(239) ?? ioMap.get(1);
  const isIgnitionOn = rawIgnition !== undefined ? rawIgnition === '1' || parseInt(rawIgnition, 10) > 0 : null;

  // Fuel: ID 89 (CAN Fuel Level % or L) or ID 9 (Analog Fuel) or ID 87
  const rawFuelLevel = ioMap.get(89) ?? ioMap.get(9);
  const fuelPercent = rawFuelLevel ? parseInt(rawFuelLevel, 10) : null;
  const totalFuelUsed = ioMap.get(87);

  // Engine RPM: ID 33 or ID 2
  const rawRpm = ioMap.get(33) ?? ioMap.get(2);
  const engineRpm = rawRpm ? parseInt(rawRpm, 10) : (isIgnitionOn ? 780 : 0);

  // Engine / Coolant Temperature: ID 32 or ID 115
  const rawTemp = ioMap.get(32) ?? ioMap.get(115);
  const coolantTemp = rawTemp ? parseInt(rawTemp, 10) : null;

  // External Vehicle Battery Voltage: ID 66 (mV)
  const rawExtVoltage = ioMap.get(66);
  const extVoltageMv = rawExtVoltage ? parseInt(rawExtVoltage, 10) : null;
  const extVoltageV = extVoltageMv !== null ? (extVoltageMv / 1000).toFixed(2) : null;

  // Internal Backup Battery: ID 67 (mV)
  const rawIntBattery = ioMap.get(67);
  const intBatteryV = rawIntBattery ? (parseInt(rawIntBattery, 10) / 1000).toFixed(2) : null;

  // Total Odometer: ID 16 (meters) or Trip ID 250
  const rawOdometer = ioMap.get(16);
  const odometerKm = rawOdometer ? Math.floor(parseInt(rawOdometer, 10) / 1000) : null;
  const rawTripOdometer = ioMap.get(250);
  const tripKm = rawTripOdometer ? (parseInt(rawTripOdometer, 10) / 1000).toFixed(1) : null;

  // Wheel Speed (CAN): ID 24 vs GPS Speed
  const rawWheelSpeed = ioMap.get(24);
  const wheelSpeed = rawWheelSpeed ? parseInt(rawWheelSpeed, 10) : null;
  const effectiveSpeed = isIgnitionOn === false ? 0 : record.speed;

  // DTC Fault Codes: ID 30, 160
  const rawDtc = ioMap.get(30) ?? ioMap.get(160);
  const dtcCount = rawDtc ? parseInt(rawDtc, 10) : 0;

  // Movement: ID 240
  const rawMovement = ioMap.get(240);
  const isMoving = rawMovement ? rawMovement === '1' || parseInt(rawMovement, 10) > 0 : effectiveSpeed > 3;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                {device.imei}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
                Teltonika FMB140 CAN
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  device.connected
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    device.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                {device.connected ? 'Active TCP Connection' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Last packet: {new Date(telemetry.receivedAt).toLocaleTimeString()}
              </span>
              <span>•</span>
              <span>GPS: {record.latitude.toFixed(5)}°, {record.longitude.toFixed(5)}°</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Live Data</span>
          </button>
          <a
            href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <span>View Map</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Engine & Motion Master Status */}
      <div
        className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 text-xs ${
          isIgnitionOn === false
            ? 'bg-slate-100/90 border-slate-300 text-slate-700'
            : isMoving
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${
              isIgnitionOn === false ? 'bg-slate-500' : isMoving ? 'bg-emerald-600' : 'bg-amber-500'
            }`}
          >
            <Power className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">
              {isIgnitionOn === false
                ? 'Vehicle Parked • Ignition OFF'
                : isMoving
                ? 'Vehicle In Transit • Engine Running'
                : 'Vehicle Idling • Engine On'}
            </h3>
            <p className="opacity-80">
              {isIgnitionOn === false
                ? 'Ignition is off (DIN1=0). GPS drift protection active (Speed 0 km/h).'
                : isMoving
                ? `Vehicle moving with active CAN bus communication at ${effectiveSpeed} km/h.`
                : 'Vehicle stationary with engine idling.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono font-bold text-xs">
          <span className="px-2.5 py-1 bg-white/80 rounded border border-current/20">
            IGN: {isIgnitionOn ? 'ON (1)' : 'OFF (0)'}
          </span>
          <span className="px-2.5 py-1 bg-white/80 rounded border border-current/20">
            MOTION: {isMoving ? 'ACTIVE' : 'STOPPED'}
          </span>
          <span className="px-2.5 py-1 bg-white/80 rounded border border-current/20">
            SAT: {record.satellites}
          </span>
        </div>
      </div>

      {/* Primary CAN Bus Instrument Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fuel Gauge */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
              <Fuel className="w-4 h-4 text-blue-600" /> CAN Fuel Level
            </span>
            <span className="text-[10px] text-slate-400 font-mono">ID #89</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold font-mono text-slate-900">
                {fuelPercent !== null ? `${fuelPercent}%` : 'N/A'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {fuelPercent !== null
                  ? fuelPercent < 15
                    ? '⚠️ Low Fuel'
                    : 'Normal'
                  : 'Sensor Awaiting'}
              </span>
            </div>
            {fuelPercent !== null && (
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    fuelPercent < 15
                      ? 'bg-rose-500'
                      : fuelPercent < 30
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, fuelPercent)}%` }}
                />
              </div>
            )}
          </div>
          {totalFuelUsed && (
            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
              Total Used: {parseInt(totalFuelUsed, 10)} Liters
            </p>
          )}
        </div>

        {/* Engine RPM Tachometer */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
              <Gauge className="w-4 h-4 text-indigo-600" /> Engine RPM
            </span>
            <span className="text-[10px] text-slate-400 font-mono">ID #33 / #2</span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono text-slate-900">
              {engineRpm.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-500">RPM</span>
          </div>

          <div className="text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>
              {isIgnitionOn === false
                ? 'Engine Stoped (0 RPM)'
                : engineRpm < 1000
                ? 'Idle Speed'
                : 'Running'}
            </span>
            <span className="font-mono text-[11px] text-slate-400">Limit: 7000</span>
          </div>
        </div>

        {/* External Battery Voltage */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
              <Zap className="w-4 h-4 text-amber-500" /> Vehicle Battery
            </span>
            <span className="text-[10px] text-slate-400 font-mono">ID #66</span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono text-slate-900">
              {extVoltageV !== null ? `${extVoltageV} V` : 'N/A'}
            </span>
            <span className="text-xs font-semibold">
              {extVoltageV !== null
                ? parseFloat(extVoltageV) >= 13.5
                  ? '⚡ Charging'
                  : parseFloat(extVoltageV) >= 12.0
                  ? 'Good'
                  : 'Low'
                : ''}
            </span>
          </div>

          <div className="text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Backup Li-ion Battery:</span>
            <span className="font-mono font-bold text-slate-700">
              {intBatteryV ? `${intBatteryV} V` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Engine Coolant Temp */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-700">
              <Thermometer className="w-4 h-4 text-rose-500" /> Coolant Temp
            </span>
            <span className="text-[10px] text-slate-400 font-mono">ID #32</span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold font-mono text-slate-900">
              {coolantTemp !== null ? `${coolantTemp} °C` : 'N/A'}
            </span>
            <span className="text-xs font-semibold">
              {coolantTemp !== null
                ? coolantTemp > 100
                  ? '⚠️ High'
                  : coolantTemp > 75
                  ? 'Optimal'
                  : 'Warming'
                : 'Awaiting'}
            </span>
          </div>

          <div className="text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Operating Range:</span>
            <span className="font-mono text-slate-700">80°C - 95°C</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Odometer */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Milestone className="w-4 h-4 text-blue-600" /> Total Odometer (CAN)
          </span>
          <div className="font-mono text-2xl font-bold text-slate-900 tracking-tight">
            {odometerKm !== null ? `${odometerKm.toLocaleString()} km` : 'Awaiting CAN'}
          </div>
          {tripKm && (
            <p className="text-xs text-slate-500">
              Current Trip: <span className="font-semibold text-slate-700">{tripKm} km</span>
            </p>
          )}
        </div>

        {/* Vehicle Speed (CAN vs GPS) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-emerald-600" /> Vehicle Speed
          </span>
          <div className="font-mono text-2xl font-bold text-slate-900 flex items-baseline gap-1">
            <span>{effectiveSpeed}</span>
            <span className="text-xs font-normal text-slate-500">km/h</span>
          </div>
          <p className="text-xs text-slate-500">
            {wheelSpeed !== null ? `Wheel Speed: ${wheelSpeed} km/h` : `GPS Heading: ${record.angle}°`}
          </p>
        </div>

        {/* Diagnostic Codes (DTC) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> On-Board Diagnostics (OBD)
          </span>
          <div className="flex items-center gap-2">
            {dtcCount === 0 ? (
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>0 Diagnostic Faults (DTC Normal)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-rose-700 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>{dtcCount} Active Fault Code(s)</span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">
            ECU status reported via FMB140 CAN adapter
          </p>
        </div>
      </div>

      {/* All Decoded CAN / IO Parameters Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-600" />
              Complete Live Parameters Received ({record.ioElements?.length || 0})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time attributes decoded from Teltonika FMB140 packet stream
            </p>
          </div>
        </div>

        {record.ioElements && record.ioElements.length > 0 ? (
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">AVL ID</th>
                  <th className="py-2.5 px-3">Parameter Description</th>
                  <th className="py-2.5 px-3">Decoded Value</th>
                  <th className="py-2.5 px-3">Byte Length</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {record.ioElements.map((el) => (
                  <tr key={el.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-bold text-blue-600">#{el.id}</td>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">
                      {getParamName(el.id)}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 bg-slate-50/50">
                      {formatValue(el.id, el.value)}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{el.byteLength} B</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 p-4 bg-slate-50 rounded-lg text-center">
            No IO elements in latest frame.
          </p>
        )}
      </div>
    </div>
  );
};

function getParamName(id: number): string {
  switch (id) {
    case 1:
      return 'Digital Input 1 (DIN1 / Ignition)';
    case 2:
      return 'Engine RPM (CAN)';
    case 9:
      return 'Analog Input 1 (Fuel Sensor)';
    case 16:
      return 'Total Odometer (meters)';
    case 21:
      return 'GSM Signal Quality (RSSI)';
    case 24:
      return 'Vehicle Wheel Speed (km/h)';
    case 30:
      return 'Diagnostic Trouble Codes (DTC Count)';
    case 32:
      return 'Engine Coolant Temperature (°C)';
    case 33:
      return 'Engine Speed (RPM)';
    case 66:
      return 'External Supply Voltage (mV)';
    case 67:
      return 'Internal Battery Voltage (mV)';
    case 68:
      return 'Internal Battery Current (mA)';
    case 69:
      return 'GNSS Fix Status';
    case 80:
      return 'Data Mode (Home / Roaming)';
    case 87:
      return 'Total Fuel Used (Liters)';
    case 89:
      return 'CAN Fuel Level (%)';
    case 115:
      return 'Engine Oil Temperature (°C)';
    case 181:
      return 'GNSS PDOP Precision';
    case 182:
      return 'GNSS HDOP Precision';
    case 239:
      return 'Ignition State (0=Off, 1=On)';
    case 240:
      return 'Movement Status (0=Stop, 1=Moving)';
    case 241:
      return 'Active GSM Operator Code';
    case 250:
      return 'Trip Odometer (meters)';
    default:
      return `CAN / AVL Parameter #${id}`;
  }
}

function formatValue(id: number, val: string): string {
  if (id === 66 || id === 67) {
    const num = parseInt(val, 10);
    return isNaN(num) ? val : `${(num / 1000).toFixed(2)} Volts (${num} mV)`;
  }
  if (id === 16 || id === 250) {
    const num = parseInt(val, 10);
    return isNaN(num) ? val : `${(num / 1000).toLocaleString()} km (${num} m)`;
  }
  if (id === 1 || id === 239) {
    return val === '1' ? '1 (Ignition ON)' : '0 (Ignition OFF)';
  }
  if (id === 240) {
    return val === '1' ? '1 (Moving)' : '0 (Stopped)';
  }
  if (id === 32 || id === 115) {
    return `${val} °C`;
  }
  if (id === 89) {
    return `${val} %`;
  }
  return val;
}
