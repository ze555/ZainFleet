import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { CanDashboard } from './components/CanDashboard.tsx';
import { TripMap } from './components/TripMap.tsx';
import { TripsList } from './components/TripsList.tsx';
import { VehicleDataView } from './components/VehicleDataView.tsx';
import { AlertsView } from './components/AlertsView.tsx';
import { CanSensorsLog } from './components/CanSensorsLog.tsx';
import { DiagnosticView } from './components/DiagnosticView.tsx';
import { PrivacyPolicy } from './components/PrivacyPolicy.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { MobileDrawer } from './components/MobileDrawer.tsx';
import { DeviceInfo, TelemetrySnapshot } from './types/fleet.ts';
import { decodeCanMetrics, generateVehicleAlerts } from './utils/canBusDecoder.ts';
import {
  Car,
  RotateCw,
  Server,
  ChevronDown,
  Trash2,
  Radio,
  Settings,
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedImei, setSelectedImei] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [serverHealthy, setServerHealthy] = useState<boolean>(true);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [showManageModal, setShowManageModal] = useState<boolean>(false);

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

  // Periodic polling for live vehicle telemetry updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDevices();
      if (selectedImei) {
        fetchTelemetry(selectedImei);
      }
      checkHealth();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchDevices, fetchTelemetry, selectedImei, checkHealth]);

  const selectedDevice = devices.find((d) => d.imei === selectedImei) || null;

  // Vehicle custom friendly name per IMEI
  const [customNames, setCustomNames] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('zainfleet_vehicle_names');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const vehicleName = useMemo(() => {
    if (!selectedDevice) return 'Toyota Fortuner';
    if (customNames[selectedDevice.imei]) return customNames[selectedDevice.imei];
    return selectedDevice.name || 'Toyota Fortuner';
  }, [selectedDevice, customNames]);

  const handleUpdateVehicleName = (newName: string) => {
    if (!selectedDevice) return;
    const updated = { ...customNames, [selectedDevice.imei]: newName };
    setCustomNames(updated);
    try {
      localStorage.setItem('zainfleet_vehicle_names', JSON.stringify(updated));
    } catch {}
  };

  // Compute active alerts count
  const unreadAlertsCount = useMemo(() => {
    let count = 0;
    if (telemetry?.record) {
      const metrics = decodeCanMetrics(telemetry.record);
      count += generateVehicleAlerts(metrics).length;
    }
    if (selectedDevice && !selectedDevice.connected) {
      count += 1;
    }
    return count;
  }, [telemetry, selectedDevice]);

  // Safe device management delete
  const handleDeleteDevice = async (imei: string) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من مسح سجلات هذه السيارة؟' : 'Are you sure you want to clear this vehicle data?')) {
      return;
    }
    try {
      await fetch(`/api/devices/${imei}`, { method: 'DELETE' });
      setShowManageModal(false);
      fetchDevices();
    } catch {}
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans pb-16 lg:pb-0"
    >
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        serverHealthy={serverHealthy}
        activeDevice={selectedDevice}
        vehicleName={vehicleName}
        unreadAlertsCount={unreadAlertsCount}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        lang={lang}
        setLang={setLang}
      />

      {/* Mobile Slide-Out Drawer matching Screen 8 in Mockup */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        device={selectedDevice}
        vehicleName={vehicleName}
        unreadAlertsCount={unreadAlertsCount}
        serverHealthy={serverHealthy}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Compact connection overview, shared across dashboard views */}
        <div className="zf-panel zf-soft-glow mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Radio className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-bold text-slate-900">{isAr ? 'مراقبة الأسطول المباشرة' : 'Fleet Live Monitor'}</div>
              <div className="text-xs text-slate-500">{isAr ? 'تحديث تلقائي كل 4 ثوانٍ' : 'Automatically refreshed every 4 seconds'}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className={`rounded-full px-3 py-1.5 ${serverHealthy ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {serverHealthy ? (isAr ? 'الخادم متصل' : 'Server online') : (isAr ? 'الخادم غير متصل' : 'Server offline')}
            </span>
            <span className={`rounded-full px-3 py-1.5 ${selectedDevice?.connected ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
              {selectedDevice?.connected ? (isAr ? 'الجهاز متصل' : 'Device connected') : (isAr ? 'بانتظار الجهاز' : 'Awaiting device')}
            </span>
            <button onClick={() => { checkHealth(); fetchDevices(); if (selectedImei) fetchTelemetry(selectedImei); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              title={isAr ? 'تحديث الآن' : 'Refresh now'}>
              <RotateCw className="h-3.5 w-3.5" /> {isAr ? 'تحديث' : 'Refresh'}
            </button>
          </div>
        </div>
        {currentTab === 'dashboard' && (
          <section className="zf-v2-hero mb-6 overflow-hidden rounded-[30px] text-white" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="zf-v2-hero-inner relative z-10 grid gap-7 p-6 sm:p-8 lg:grid-cols-[1.35fr_1fr] lg:p-10">
              <div className="flex flex-col justify-between gap-6">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-bold tracking-[.18em] text-cyan-200">
                    <span className="zf-v2-pulse" /> ZAINFLEET / LIVE OPERATIONS
                  </div>
                  <h1 className="max-w-xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                    {isAr ? 'قيادة أذكى. أسطول أقوى.' : 'A smarter way to move.'}
                  </h1>
                  <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">
                    {isAr ? 'مركز قيادة متكامل لتتبع مركباتك ومراقبة حالتها وتحليل بياناتها لحظة بلحظة.' : 'Your command center for vehicle tracking, operational insights and real-time fleet intelligence.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`zf-v2-chip ${serverHealthy ? 'zf-v2-chip-ok' : 'zf-v2-chip-error'}`}><span className="zf-v2-pulse" />{serverHealthy ? (isAr ? 'الخادم يعمل' : 'Server online') : (isAr ? 'الخادم غير متصل' : 'Server offline')}</span>
                  <span className="zf-v2-chip">{isAr ? 'مزامنة تلقائية كل 4 ثوانٍ' : 'Sync every 4 seconds'}</span>
                </div>
              </div>
              <div className="zf-v2-stats grid grid-cols-2 gap-3">
                <div className="zf-v2-stat"><div className="text-xs text-slate-300">{isAr ? 'إجمالي المركبات' : 'Total vehicles'}</div><div className="mt-3 text-4xl font-black tabular-nums">{devices.length}</div><div className="mt-3 text-xs text-cyan-200">{isAr ? 'المسجلة في النظام' : 'Registered in fleet'}</div></div>
                <div className="zf-v2-stat"><div className="text-xs text-slate-300">{isAr ? 'مركبات متصلة' : 'Active vehicles'}</div><div className="mt-3 text-4xl font-black tabular-nums text-emerald-300">{devices.filter(d => d.connected).length}</div><div className="mt-3 text-xs text-emerald-200">{isAr ? 'تبث بيانات حالياً' : 'Online right now'}</div></div>
                <div className="zf-v2-stat col-span-2 flex items-center justify-between gap-3">
                  <div><div className="text-xs text-slate-300">{isAr ? 'المركبة المحددة' : 'Selected vehicle'}</div><div className="mt-1 max-w-[210px] truncate text-base font-bold">{selectedDevice ? vehicleName : (isAr ? 'لم يتم تحديد مركبة' : 'No vehicle selected')}</div></div>
                  <span className={`rounded-xl px-3 py-2 text-xs font-bold ${selectedDevice?.connected ? 'bg-emerald-400/15 text-emerald-200' : 'bg-slate-400/15 text-slate-200'}`}>{selectedDevice?.connected ? (isAr ? 'متصل' : 'Connected') : (isAr ? 'غير متصل' : 'Offline')}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Multi-vehicle Switcher Bar (only when > 1 vehicle exists) */}
        {devices.length > 1 && selectedDevice && (
          <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Car className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  {isAr ? 'المركبة المحددة:' : 'Selected Vehicle:'}
                </span>
                <div className="relative">
                  <select
                    value={selectedImei || ''}
                    onChange={(e) => setSelectedImei(e.target.value)}
                    className="font-bold text-xs text-slate-900 bg-transparent pr-6 pl-2 py-1 border border-slate-200 rounded-lg cursor-pointer focus:outline-hidden"
                  >
                    {devices.map((d) => (
                      <option key={d.imei} value={d.imei}>
                        {customNames[d.imei] || d.name || `IMEI ${d.imei.slice(-6)}`} {d.connected ? '(Live)' : '(Offline)'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowManageModal(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title={isAr ? 'إدارة المركبة' : 'Manage Vehicle'}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* View 1: Main Customer Dashboard matching Screen 1 in Mockup */}
        {currentTab === 'dashboard' && (
          <>
            {selectedDevice ? (
              <CanDashboard
                device={selectedDevice}
                telemetry={telemetry}
                isLoading={isLoadingTelemetry}
                onRefresh={() => selectedImei && fetchTelemetry(selectedImei)}
                onNavigate={(tab) => setCurrentTab(tab)}
                vehicleName={vehicleName}
                onUpdateVehicleName={handleUpdateVehicleName}
                lang={lang}
              />
            ) : (
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} />
            )}
          </>
        )}

        {/* View 2: Trip History Log matching Screen 3 & 4 in Mockup */}
        {currentTab === 'trips' && (
          <>
            {selectedDevice ? (
              <TripsList device={selectedDevice} lang={lang} />
            ) : (
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} />
            )}
          </>
        )}

        {/* View 3: Live Vehicle Map matching Screen 2 in Mockup */}
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

        {/* View 4: Vehicle Health & CAN Bus dynamics matching Screen 5 in Mockup */}
        {currentTab === 'vehicle' && (
          <>
            {selectedDevice ? (
              <VehicleDataView
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

        {/* View 5: Vehicle Alerts & Warnings matching Screen 7 in Mockup */}
        {currentTab === 'alerts' && (
          <>
            {selectedDevice ? (
              <AlertsView
                device={selectedDevice}
                telemetry={telemetry}
                lang={lang}
              />
            ) : (
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} />
            )}
          </>
        )}

        {/* View 6: Detailed CAN Sensors Diagnostic Table matching Screen 6 in Mockup */}
        {currentTab === 'sensors' && (
          <CanSensorsLog telemetry={telemetry} lang={lang} />
        )}

        {/* View 7: FMB140 Packet & CAN/OBD Diagnostics & Log Downloader */}
        {currentTab === 'diagnostics' && (
          <DiagnosticView device={selectedDevice} lang={lang} />
        )}

        {/* View 8: Privacy Policy */}
        {currentTab === 'privacy' && <PrivacyPolicy />}
      </main>

      {/* Fixed Bottom Navigation for Mobile matching all Mockup screens */}
      <BottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        unreadAlertsCount={unreadAlertsCount}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        lang={lang}
      />

      {/* Safe Device Management Modal */}
      {showManageModal && selectedDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {isAr ? 'إدارة المركبة وبيانات التتبع' : 'Vehicle Settings'}
            </h3>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">IMEI:</span>
                <span className="font-mono font-bold text-slate-900">{selectedDevice.imei}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? 'الاسم المعين:' : 'Assigned Name:'}</span>
                <span className="font-bold text-slate-900">{vehicleName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? 'الحالة:' : 'Connection:'}</span>
                <span className="font-bold text-slate-900">
                  {selectedDevice.connected ? (isAr ? 'متصل' : 'Connected') : (isAr ? 'غير متصل' : 'Offline')}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => handleDeleteDevice(selectedDevice.imei)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isAr ? 'مسح بيانات هذه السيارة' : 'Clear vehicle data'}</span>
              </button>

              <button
                onClick={() => setShowManageModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer (Desktop only) */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-slate-500">
          <div>
            &copy; 2026 <span className="font-semibold text-slate-700">ZainFleet CAN</span> &bull;{' '}
            {isAr
              ? 'نظام تتبع المركبات وقراءات كمبيوتر السيارة CAN Bus المباشرة عبر Teltonika FMB140'
              : 'Teltonika FMB140 Live CAN Bus & Vehicle Telemetry'}
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-mono">
              <Radio className="w-3.5 h-3.5 text-blue-600" />
              <span>TCP Port: 5000</span>
            </span>
            <span>&bull;</span>
            <button
              onClick={() => setCurrentTab('privacy')}
              className="text-blue-600 hover:underline"
            >
              {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
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
