import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { CanDashboard } from './components/CanDashboard.tsx';
import { TripMap } from './components/TripMap.tsx';
import { CanSensorsLog } from './components/CanSensorsLog.tsx';
import { PrivacyPolicy } from './components/PrivacyPolicy.tsx';
import { DeviceInfo, TelemetrySnapshot } from './types/fleet.ts';
import {
  Car,
  Radio,
  RotateCw,
  Server,
  ChevronDown,
  Trash2,
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedImei, setSelectedImei] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [serverHealthy, setServerHealthy] = useState<boolean>(true);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(false);

  const isAr = lang === 'ar';

  // Check health endpoint
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        setServerHealthy(true);
      } else {
        setServerHealthy(false);
      }
    } catch {
      setServerHealthy(false);
    }
  }, []);

  // Fetch real connected devices from persistent server
  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data: DeviceInfo[] = await res.json();
        setDevices(data);
        if (data.length > 0) {
          // Keep current selection if valid, or default to first/newest device
          setSelectedImei((prev) => (prev && data.some((d) => d.imei === prev) ? prev : data[0].imei));
        } else {
          setSelectedImei(null);
        }
      }
    } catch {
      // Quiet fallback
    }
  }, []);

  // Fetch latest telemetry for selected device
  const fetchTelemetry = useCallback(async (imei: string) => {
    setIsLoadingTelemetry(true);
    try {
      const res = await fetch(`/api/devices/${imei}/latest`);
      if (res.ok) {
        const data: TelemetrySnapshot = await res.json();
        setTelemetry(data);
      } else {
        setTelemetry(null);
      }
    } catch {
      setTelemetry(null);
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    checkHealth();
    fetchDevices();
  }, [checkHealth, fetchDevices]);

  // Load telemetry when selected IMEI changes
  useEffect(() => {
    if (selectedImei) {
      fetchTelemetry(selectedImei);
    } else {
      setTelemetry(null);
    }
  }, [selectedImei, fetchTelemetry]);

  // Real-time periodic polling (every 3 seconds) for live vehicle updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDevices();
      if (selectedImei) {
        fetchTelemetry(selectedImei);
      }
      checkHealth();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchDevices, fetchTelemetry, selectedImei, checkHealth]);

  const selectedDevice = devices.find((d) => d.imei === selectedImei) || null;

  const handleDeleteDevice = async (imei: string) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من مسح بيانات هذه السيارة وسجلاتها؟' : 'Are you sure you want to clear this vehicle data?')) {
      return;
    }
    try {
      await fetch(`/api/devices/${imei}`, { method: 'DELETE' });
      fetchDevices();
    } catch {}
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans"
    >
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        serverHealthy={serverHealthy}
        activeDevice={selectedDevice}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Device Switcher & Status Bar (shown when devices exist) */}
        {devices.length > 0 && selectedDevice && (
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Car className="w-5 h-5" />
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  {isAr ? 'المركبة الحالية' : 'Active Vehicle'}
                </span>
                <div className="flex items-center gap-2">
                  {devices.length > 1 ? (
                    <div className="relative">
                      <select
                        value={selectedImei || ''}
                        onChange={(e) => setSelectedImei(e.target.value)}
                        className="font-mono font-bold text-sm text-slate-900 bg-transparent pr-6 pl-2 py-0.5 border border-slate-200 rounded-lg cursor-pointer focus:outline-hidden"
                      >
                        {devices.map((d) => (
                          <option key={d.imei} value={d.imei}>
                            {d.imei} {d.connected ? '(Live)' : '(Offline)'}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  ) : (
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {selectedDevice.imei}
                    </span>
                  )}

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      selectedDevice.connected
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        selectedDevice.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    {selectedDevice.connected
                      ? isAr
                        ? 'اتصال حي الآن'
                        : 'Live Online'
                      : isAr
                      ? 'آخر ظهور: ' + new Date(selectedDevice.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => selectedImei && fetchTelemetry(selectedImei)}
                disabled={isLoadingTelemetry}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors font-medium"
              >
                <RotateCw
                  className={`w-3.5 h-3.5 ${isLoadingTelemetry ? 'animate-spin text-blue-600' : ''}`}
                />
                <span>{isAr ? 'تحديث حي' : 'Sync'}</span>
              </button>

              <button
                onClick={() => selectedImei && handleDeleteDevice(selectedImei)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                title={isAr ? 'حذف سجلات هذه السيارة' : 'Delete Vehicle Data'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Live CAN Dashboard */}
        {currentTab === 'dashboard' && (
          <>
            {selectedDevice ? (
              <CanDashboard
                device={selectedDevice}
                telemetry={telemetry}
                isLoading={isLoadingTelemetry}
                onRefresh={() => selectedImei && fetchTelemetry(selectedImei)}
                lang={lang}
              />
            ) : (
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} />
            )}
          </>
        )}

        {/* Tab 2: Map & Past Trips */}
        {currentTab === 'map' && (
          <>
            {selectedDevice ? (
              <TripMap
                device={selectedDevice}
                latestTelemetry={telemetry}
                lang={lang}
              />
            ) : (
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} />
            )}
          </>
        )}

        {/* Tab 3: Detailed CAN Bus Sensor Table */}
        {currentTab === 'sensors' && (
          <CanSensorsLog telemetry={telemetry} lang={lang} />
        )}

        {/* Tab 4: Privacy Policy */}
        {currentTab === 'privacy' && <PrivacyPolicy />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            &copy; 2026 <span className="font-semibold text-slate-700">ZainFleet CAN</span> &bull;{' '}
            {isAr
              ? 'نظام التتبع وقراءات كمبيوتر السيارة CAN Bus عبر Teltonika FMB140'
              : 'Teltonika FMB140 M-CAN & C-CAN Protocol Server'}
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-mono">
              <Radio className="w-3.5 h-3.5 text-blue-600" />
              <span>TCP Socket: :5000</span>
            </span>
            <span>&bull;</span>
            <button
              onClick={() => setCurrentTab('privacy')}
              className="text-blue-600 hover:underline"
            >
              {isAr ? 'سياسة الخصوصية والأمان' : 'Privacy & Security'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface WaitingProps {
  isAr: boolean;
  onRefresh: () => void;
}

const WaitingForVehicleCard: React.FC<WaitingProps> = ({ isAr, onRefresh }) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-3xl mx-auto shadow-xs my-6">
      <div className="w-20 h-20 rounded-3xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-6 shadow-2xs">
        <Car className="w-10 h-10 animate-bounce" />
      </div>

      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
        {isAr
          ? 'في انتظار اتصال سيارتك وجهاز Teltonika FMB140...'
          : 'Waiting for Teltonika FMB140 Vehicle Connection...'}
      </h2>

      <p className="text-sm text-slate-600 mt-2 max-w-xl mx-auto leading-relaxed">
        {isAr
          ? 'السيرفر جاهز ومفتوح الآن لاستقبال حزم التتبع المباشرة وقراءات كمبيوتر السيارة (M-CAN و C-CAN). بمجرد تشغيل سويتش السيارة أو التقاط إشارة الشريحة، ستظهر جميع القراءات والرحلات هنا فورياً.'
          : 'The server is listening for real-time TCP connections and CAN bus packets (M-CAN & C-CAN). Turn on the vehicle ignition to begin streaming telemetry.'}
      </p>

      {/* Connection Info Box */}
      <div className="mt-8 p-5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-700 text-left max-w-lg mx-auto">
        <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-600" />
          <span>{isAr ? 'بيانات اتصال جهاز الـ FMB140 في برنامج Configurator:' : 'Teltonika Configurator Settings:'}</span>
        </h3>

        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex justify-between py-1 border-b border-slate-200/60">
            <span className="text-slate-500">Server Domain / IP:</span>
            <span className="font-bold text-slate-900">hayabusa.proxy.rlwy.net</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200/60">
            <span className="text-slate-500">Server Port:</span>
            <span className="font-bold text-blue-600">39512 (TCP)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200/60">
            <span className="text-slate-500">Data Protocol:</span>
            <span className="font-bold text-slate-900">Codec 8 / Codec 8 Extended</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500">CAN Bus Wiring:</span>
            <span className="font-bold text-emerald-700">CAN1 (M-CAN) + CAN2 (C-CAN)</span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
        >
          <RotateCw className="w-4 h-4" />
          <span>{isAr ? 'فحص الاتصال وتحديث' : 'Check for Connection'}</span>
        </button>
      </div>
    </div>
  );
};

export default App;
