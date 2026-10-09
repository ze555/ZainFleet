import React from 'react';
import {
  buildCodec8TestPacket,
  buildCodec8ExtendedTestPacket,
  bytesToHexString,
} from '../protocol/fixtures.js';
import { Terminal, CheckCircle2, AlertTriangle, Play, Sparkles, Copy, Layers } from 'lucide-react';
import { AvlRecord } from '../types/fleet.js';

interface DecodeResponse {
  success: boolean;
  validPreamble?: boolean;
  dataLength?: number;
  expectedCrc?: number;
  actualCrc?: number;
  crcValid?: boolean;
  codecId?: number;
  records?: AvlRecord[];
  acknowledgementHex?: string;
  error?: string;
}

export const PacketInspector: React.FC = () => {
  const [hexInput, setHexInput] = React.useState('');
  const [result, setResult] = React.useState<DecodeResponse | null>(null);
  const [isDecoding, setIsDecoding] = React.useState(false);
  const [copiedAck, setCopiedAck] = React.useState(false);

  // Load sample codec 8 fixture on start
  React.useEffect(() => {
    loadCodec8Fixture();
  }, []);

  const loadCodec8Fixture = () => {
    const bytes = buildCodec8TestPacket({
      timestampMs: 1700000000000,
      latitude: 0.54321,
      longitude: -0.1234567,
      altitude: 120,
      angle: 90,
      speed: 42,
      satellites: 8,
      priority: 2,
      eventIoId: 7,
      ioValue: 42,
    });
    setHexInput(bytesToHexString(bytes));
  };

  const loadCodec8ExtendedFixture = () => {
    const bytes = buildCodec8ExtendedTestPacket({
      timestampMs: 1700000000000,
      latitude: 0.54321,
      longitude: -0.1234567,
      altitude: 120,
      angle: 90,
      speed: 42,
      satellites: 8,
      priority: 2,
    });
    setHexInput(bytesToHexString(bytes));
  };

  const loadCorruptedCrcFixture = () => {
    const bytes = buildCodec8TestPacket();
    // Corrupt last byte
    bytes[bytes.length - 1] ^= 0x01;
    setHexInput(bytesToHexString(bytes));
  };

  const handleDecode = async () => {
    if (!hexInput.trim()) return;
    setIsDecoding(true);
    try {
      const res = await fetch('/api/packets/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hex: hexInput.trim() }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || 'Network error while contacting decoder API',
      });
    } finally {
      setIsDecoding(false);
    }
  };

  const copyAck = () => {
    if (!result?.acknowledgementHex) return;
    navigator.clipboard.writeText(result.acknowledgementHex);
    setCopiedAck(true);
    setTimeout(() => setCopiedAck(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-blue-600" />
              Teltonika Protocol Packet Inspector
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Decode and validate raw Teltonika AVL binary packets. Supports Codec 8 (
              <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">0x08</code>) and Codec 8
              Extended (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">0x8E</code>)
              with CRC-16/IBM validation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadCodec8Fixture}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Codec 8 Sample</span>
            </button>
            <button
              onClick={loadCodec8ExtendedFixture}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Codec 8 Ext Sample</span>
            </button>
            <button
              onClick={loadCorruptedCrcFixture}
              className="px-3 py-1.5 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors"
            >
              Corrupt CRC Test
            </button>
          </div>
        </div>

        {/* Input Textarea */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Raw Teltonika Packet Hex Stream ({Math.floor(hexInput.replace(/\s+/g, '').length / 2)}{' '}
            bytes)
          </label>
          <div className="relative">
            <textarea
              rows={4}
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              placeholder="Paste raw packet hex (e.g. 00000000000000300801...)"
              className="w-full font-mono text-xs bg-slate-900 text-emerald-400 p-3.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-wider break-all resize-y"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Format: 4-byte zero preamble + 4-byte data length + AVL payload + 4-byte CRC-16
            </span>
            <button
              onClick={handleDecode}
              disabled={isDecoding || !hexInput.trim()}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isDecoding ? 'Decoding...' : 'Decode Frame'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Result Section */}
      {result && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              {result.success ? (
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {result.success ? 'Frame Validated Successfully' : 'Validation Error'}
                </h2>
                <p className="text-xs text-slate-500">
                  {result.success
                    ? `Decoded ${result.records?.length || 0} AVL record(s)`
                    : result.error}
                </p>
              </div>
            </div>

            {result.success && result.acknowledgementHex && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
                <span className="text-slate-500">Generated ACK:</span>
                <code className="font-mono font-bold text-blue-600">
                  0x{result.acknowledgementHex}
                </code>
                <button
                  onClick={copyAck}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  title="Copy ACK bytes"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {copiedAck && <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>}
              </div>
            )}
          </div>

          {result.success && (
            <>
              {/* Protocol Header breakdown cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-xs text-slate-500 block">Preamble</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    0x00000000 (Valid)
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-xs text-slate-500 block">Data Length</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {result.dataLength} bytes
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-xs text-slate-500 block">Codec ID</span>
                  <span className="font-mono font-bold text-blue-600 text-sm">
                    0x{result.codecId?.toString(16).toUpperCase().padStart(2, '0')} (
                    {result.codecId === 0x8e ? 'Codec 8 Ext' : 'Codec 8'})
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-xs text-slate-500 block">CRC-16 / IBM</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    0x{result.actualCrc?.toString(16).toUpperCase().padStart(4, '0')} (Verified)
                  </span>
                </div>
              </div>

              {/* Decoded Records */}
              {result.records && result.records.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Decoded AVL Records
                  </h3>

                  {result.records.map((rec, i) => (
                    <div
                      key={i}
                      className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                        <span className="font-bold text-xs text-slate-800">
                          Record #{i + 1}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>
                            Timestamp: <b className="text-slate-800">{new Date(rec.timestamp).toISOString()}</b>
                          </span>
                          <span>
                            Priority: <b className="text-slate-800">{rec.priority}</b>
                          </span>
                        </div>
                      </div>

                      {/* GPS & Dynamics */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                        <div className="bg-white p-2.5 rounded border border-slate-200">
                          <span className="text-slate-400 block text-[11px]">Latitude</span>
                          <span className="font-mono font-bold text-slate-900">
                            {rec.latitude.toFixed(6)}°
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-slate-200">
                          <span className="text-slate-400 block text-[11px]">Longitude</span>
                          <span className="font-mono font-bold text-slate-900">
                            {rec.longitude.toFixed(6)}°
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-slate-200">
                          <span className="text-slate-400 block text-[11px]">Speed</span>
                          <span className="font-mono font-bold text-slate-900">
                            {rec.speed} km/h
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-slate-200">
                          <span className="text-slate-400 block text-[11px]">Altitude</span>
                          <span className="font-mono font-bold text-slate-900">
                            {rec.altitude} m
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-slate-200">
                          <span className="text-slate-400 block text-[11px]">Satellites</span>
                          <span className="font-mono font-bold text-slate-900">
                            {rec.satellites} sats
                          </span>
                        </div>
                      </div>

                      {/* IO Section */}
                      <div>
                        <span className="text-[11px] font-bold text-slate-600 block mb-2 flex items-center gap-1.5">
                          <Layers className="w-3 h-3 text-blue-600" />
                          IO Data (Event ID #{rec.eventIoId}, {rec.ioElements?.length || 0} Elements)
                        </span>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {rec.ioElements.map((io, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-2 rounded border border-slate-200 font-mono text-xs flex justify-between items-center"
                            >
                              <span className="font-bold text-blue-600">IO #{io.id}</span>
                              <span className="text-slate-800 font-semibold">{io.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
