import React from 'react';
import { Cpu, Send, CheckCircle2, AlertCircle, Compass, MapPin, Gauge } from 'lucide-react';

interface TestClientSimulatorProps {
  initialImei?: string;
  onPacketSent?: (imei: string) => void;
}

export const TestClientSimulator: React.FC<TestClientSimulatorProps> = ({
  initialImei = '123456789012345',
  onPacketSent,
}) => {
  const [imei, setImei] = React.useState(initialImei);
  const [codecType, setCodecType] = React.useState<'codec8' | 'codec8ext'>('codec8');
  const [latitude, setLatitude] = React.useState('24.713600');
  const [longitude, setLongitude] = React.useState('46.675300');
  const [speed, setSpeed] = React.useState('75');
  const [altitude, setAltitude] = React.useState('612');
  const [angle, setAngle] = React.useState('145');
  const [satellites, setSatellites] = React.useState('12');

  const [isSending, setIsSending] = React.useState(false);
  const [result, setResult] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Sync initialImei if prop changes
  React.useEffect(() => {
    if (initialImei) {
      setImei(initialImei);
    }
  }, [initialImei]);

  const setPreset = (preset: 'riyadh' | 'highway' | 'idle' | 'zero' | 'fmb140') => {
    switch (preset) {
      case 'fmb140':
        setCodecType('codec8ext');
        setLatitude('24.713600');
        setLongitude('46.675300');
        setSpeed('78');
        setAltitude('615');
        setAngle('160');
        setSatellites('14');
        break;
      case 'riyadh':
        setCodecType('codec8');
        setLatitude('24.713600');
        setLongitude('46.675300');
        setSpeed('60');
        setAltitude('612');
        setAngle('135');
        setSatellites('12');
        break;
      case 'highway':
        setLatitude('24.789120');
        setLongitude('46.621040');
        setSpeed('118');
        setAltitude('625');
        setAngle('310');
        setSatellites('15');
        break;
      case 'idle':
        setLatitude('24.721450');
        setLongitude('46.690800');
        setSpeed('0');
        setAltitude('610');
        setAngle('80');
        setSatellites('9');
        break;
      case 'zero':
        setLatitude('0.000000');
        setLongitude('0.000000');
        setSpeed('0');
        setAltitude('0');
        setAngle('0');
        setSatellites('0');
        break;
    }
  };

  const handleSendPacket = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!/^\d{15}$/.test(imei.trim())) {
      setError('IMEI must be exactly 15 ASCII digits (e.g. 123456789012345)');
      return;
    }

    setIsSending(true);
    try {
      const payload = {
        imei: imei.trim(),
        type: codecType,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: parseInt(speed, 10),
        altitude: parseInt(altitude, 10),
        angle: parseInt(angle, 10),
        satellites: parseInt(satellites, 10),
      };

      const res = await fetch('/api/simulate/packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to simulate packet');
      }

      setResult(data);
      if (onPacketSent) {
        onPacketSent(imei.trim());
      }
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              Teltonika GPS Test Client Simulator
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Simulates a Teltonika hardware tracker establishing a session and dispatching binary
              AVL packets directly to the ZainFleet ingestion engine.
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-5 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <span className="text-xs font-semibold text-slate-600 block mb-2">
            Quick Route Presets:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPreset('fmb140')}
              className="px-2.5 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded border border-blue-200 shadow-2xs transition-colors flex items-center gap-1"
            >
              <span>Teltonika FMB140 Preset (Codec 8 Ext)</span>
            </button>
            <button
              type="button"
              onClick={() => setPreset('riyadh')}
              className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-200 shadow-2xs transition-colors"
            >
              City Driving (60 km/h)
            </button>
            <button
              type="button"
              onClick={() => setPreset('highway')}
              className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-200 shadow-2xs transition-colors"
            >
              Highway (118 km/h)
            </button>
            <button
              type="button"
              onClick={() => setPreset('idle')}
              className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-200 shadow-2xs transition-colors"
            >
              Parked / Idle (0 km/h)
            </button>
            <button
              type="button"
              onClick={() => setPreset('zero')}
              className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-200 shadow-2xs transition-colors"
            >
              Zero Test Fixture (0, 0)
            </button>
          </div>
        </div>

        <form onSubmit={handleSendPacket} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Device IMEI (15 Digits)
              </label>
              <input
                type="text"
                maxLength={15}
                required
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                placeholder="123456789012345"
                className="w-full font-mono text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Length: {imei.length}/15 digits
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Teltonika Codec
              </label>
              <select
                value={codecType}
                onChange={(e) => setCodecType(e.target.value as any)}
                className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
              >
                <option value="codec8">Codec 8 (Standard AVL - 0x08)</option>
                <option value="codec8ext">Codec 8 Extended (16-bit IO - 0x8E)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1 font-medium">
                <MapPin className="w-3 h-3 text-blue-600" /> Latitude
              </label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full font-mono text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1 font-medium">
                <MapPin className="w-3 h-3 text-blue-600" /> Longitude
              </label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full font-mono text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1 font-medium">
                <Gauge className="w-3 h-3 text-emerald-600" /> Speed (km/h)
              </label>
              <input
                type="number"
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
                className="w-full font-mono text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1 font-medium">
                Altitude (m)
              </label>
              <input
                type="number"
                value={altitude}
                onChange={(e) => setAltitude(e.target.value)}
                className="w-full font-mono text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1 font-medium">
                <Compass className="w-3 h-3 text-blue-600" /> Angle (0-360°)
              </label>
              <input
                type="number"
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                className="w-full font-mono text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1 font-medium">
                Satellites
              </label>
              <input
                type="number"
                value={satellites}
                onChange={(e) => setSatellites(e.target.value)}
                className="w-full font-mono text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSending}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Sending & Ingesting...' : 'Simulate & Transmit AVL Packet'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Result feedback */}
      {result && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 text-emerald-700 border-b border-slate-100 pb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Transmission Acknowledged (ACK Received)
              </h2>
              <p className="text-xs text-slate-500">
                Server returned 4-byte ACK{' '}
                <code className="font-mono text-blue-600 font-bold">
                  0x{result.acknowledgementHex}
                </code>{' '}
                confirming {result.recordsIngested} record(s) ingested.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase text-slate-600 block">
              Transmitted Frame Hex:
            </span>
            <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg break-all">
              {result.rawFrameHex}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
