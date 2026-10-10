import React from 'react';
import { DeviceInfo, TelemetrySnapshot } from '../types/fleet.js';
import {
  MapPin,
  Gauge,
  Layers,
  Signal,
  CheckCircle2,
  XCircle,
  Cpu,
  RotateCw,
  Copy,
  ExternalLink
} from 'lucide-react';

interface DeviceDetailProps {
  device: DeviceInfo;
  telemetry: TelemetrySnapshot | null;
  isLoadingTelemetry: boolean;
  onRefreshTelemetry: () => void;
  onToggleConnection: (imei: string) => void;
  onSimulateForDevice: (imei: string) => void;
}

export const DeviceDetail: React.FC<DeviceDetailProps> = ({
  device,
  telemetry,
  isLoadingTelemetry,
  onRefreshTelemetry,
  onToggleConnection,
  onSimulateForDevice,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyJson = () => {
    if (!telemetry) return;
    navigator.clipboard.writeText(JSON.stringify(telemetry, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const record = telemetry?.record;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-full overflow-y-auto">
      {/* Device Header */}
      <div className="p-5 border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                IMEI Identifier
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  device.connected
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {device.connected ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-400" />
                )}
                {device.connected ? 'Active Connection' : 'Disconnected'}
              </span>
            </div>
            <h1 className="text-xl font-mono font-bold text-slate-900 mt-1">{device.imei}</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleConnection(device.imei)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                device.connected
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {device.connected ? 'Simulate Disconnect' : 'Simulate Connect'}
            </button>
            <button
              onClick={() => onSimulateForDevice(device.imei)}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Send Packet</span>
            </button>
          </div>
        </div>

        {/* Device metadata badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">First Connected</span>
            <span className="font-medium text-slate-700">
              {new Date(device.firstSeen).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Last Transmission</span>
            <span className="font-medium text-slate-700">
              {new Date(device.lastSeen).toLocaleString()}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-slate-400 block mb-0.5">Telemetry Ingestion</span>
            <span className="font-medium text-slate-700">
              {telemetry ? 'Stored in Memory' : 'No records yet'}
            </span>
          </div>
        </div>
      </div>

      {/* Telemetry section */}
      <div className="p-5 flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Latest AVL Telemetry
            </h2>
            {isLoadingTelemetry && <RotateCw className="w-3.5 h-3.5 animate-spin text-blue-600" />}
          </div>
          <div className="flex items-center gap-2">
            {telemetry && (
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
              </button>
            )}
            <button
              onClick={onRefreshTelemetry}
              disabled={isLoadingTelemetry}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              title="Refresh telemetry"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoadingTelemetry ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {record ? (
          <div className="space-y-5">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Coordinates */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 col-span-2 sm:col-span-2">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" /> GPS Position
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-0.5 text-[11px]"
                  >
                    View Map <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="font-mono font-bold text-base text-slate-900">
                  {record.latitude.toFixed(6)}°, {record.longitude.toFixed(6)}°
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Altitude: {record.altitude} meters
                </div>
              </div>

              {/* Speed */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1 font-medium">
                  <Gauge className="w-3.5 h-3.5 text-emerald-600" /> Speed
                </div>
                <div className="font-mono font-bold text-lg text-slate-900">
                  {record.speed} <span className="text-xs font-normal text-slate-500">km/h</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Angle: {record.angle}°
                </div>
              </div>

              {/* Satellites & Quality */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1 font-medium">
                  <Signal className="w-3.5 h-3.5 text-amber-600" /> Satellites
                </div>
                <div className="font-mono font-bold text-lg text-slate-900">
                  {record.satellites}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Priority: {record.priority}
                </div>
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50/50 p-3 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-400 block">Record Timestamp</span>
                <span className="font-medium text-slate-800">
                  {new Date(record.timestamp).toLocaleTimeString([], { hour12: false })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Ingested At</span>
                <span className="font-medium text-slate-800">
                  {new Date(telemetry.receivedAt).toLocaleTimeString([], { hour12: false })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Event Trigger IO</span>
                <span className="font-mono font-bold text-blue-600">ID #{record.eventIoId}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total IO Attributes</span>
                <span className="font-medium text-slate-800">
                  {record.ioElements?.length || 0} items
                </span>
              </div>
            </div>

            {/* IO Elements Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  Decoded IO Telemetry Attributes ({record.ioElements?.length || 0})
                </h3>
              </div>

              {record.ioElements && record.ioElements.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
                      <tr>
                        <th className="py-2 px-3">IO ID</th>
                        <th className="py-2 px-3">Width / Type</th>
                        <th className="py-2 px-3">Raw Value</th>
                        <th className="py-2 px-3">Description / Hint</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                      {record.ioElements.map((io, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-bold text-blue-700">#{io.id}</td>
                          <td className="py-2 px-3 text-slate-500 font-sans">
                            {io.byteLength} {io.byteLength === 1 ? 'byte' : 'bytes'}
                          </td>
                          <td className="py-2 px-3 font-semibold">{io.value}</td>
                          <td className="py-2 px-3 font-sans text-slate-500">
                            {getIoDescription(io.id)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No IO elements in this record.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
            <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-600">No telemetry recorded yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;Send Packet&quot; above to ingest a sample Teltonika Codec 8 or Codec 8
              Extended record.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

function getIoDescription(id: number): string {
  switch (id) {
    case 1:
      return 'Digital Input 1 (DIN1 / Ignition)';
    case 2:
      return 'Digital Input 2 (DIN2)';
    case 3:
      return 'Digital Input 3 (DIN3)';
    case 6:
      return 'GSM Signal Quality (RSSI)';
    case 7:
      return 'Movement / Acceleration Sensor';
    case 9:
      return 'Analog Input 1 (AIN1 / Fuel or Sensor)';
    case 16:
      return 'Total Odometer (meters)';
    case 21:
      return 'GSM Signal Level';
    case 24:
      return 'Vehicle Speed (km/h)';
    case 30:
      return 'Diagnostic Trouble Codes (DTC Count)';
    case 32:
      return 'Coolant Temperature (°C)';
    case 33:
      return 'Engine Speed (RPM)';
    case 42:
      return 'Custom Extended Event IO';
    case 66:
      return 'External Supply Voltage (mV)';
    case 67:
      return 'Internal Battery Voltage (mV)';
    case 68:
      return 'Internal Battery Current (mA)';
    case 69:
      return 'GNSS Status (Fix State)';
    case 80:
      return 'Data Mode (Home / Roaming)';
    case 87:
      return 'Total Fuel Used (Liters)';
    case 89:
      return 'Fuel Level (CAN / OBD % or L)';
    case 115:
      return 'Engine Temperature (°C)';
    case 181:
      return 'GNSS PDOP (Precision)';
    case 182:
      return 'GNSS HDOP (Horizontal Dilution)';
    case 239:
      return 'Ignition State (0=Off, 1=On)';
    case 240:
      return 'Movement Status (0=Stopped, 1=Moving)';
    case 241:
      return 'Active GSM Operator Code (MCC/MNC)';
    case 246:
      return 'Towing Detection Alarm';
    case 247:
      return 'Crash Detection Event';
    case 249:
      return 'GSM Jamming Detection';
    case 250:
      return 'Trip Odometer (meters)';
    case 251:
      return 'Idling Status';
    case 252:
      return 'Power Unplug Detection';
    case 255:
      return 'Over-Speeding Alarm';
    default:
      return 'Teltonika AVL IO Parameter';
  }
}
