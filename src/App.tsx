import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { CanDashboard } from './components/CanDashboard.tsx';
import { TripMap } from './components/TripMap.tsx';
import { TodayGpsRoute } from './components/TodayGpsRoute.tsx';
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
  LockKeyhole, Eye, EyeOff, LogIn, ShieldCheck, Wifi, LogOut,
} from 'lucide-react';

const DashboardApp: React.FC<{onLogout: () => void}> = ({onLogout}) => {
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
      className="zf-fleet-shell min-h-screen flex flex-col font-sans pb-16 lg:pb-0"
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
      <main className="zf-page zf-fleet-page flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="zf-login-toolbar"><span>FMB140 • ADMIN CONSOLE</span><button type="button" onClick={onLogout}><LogOut size={15} /> تسجيل الخروج</button></div>
        {/* Compact connection overview, shared across dashboard views */}
        <div className="zf-panel zf-soft-glow zf-fleet-overview mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
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
          <section className="zf-fleet-hero" aria-label={isAr ? 'لوحة حالة الأسطول' : 'Fleet status'}>
            <div className="zf-fleet-hero-title">
              <div>
                <p className="zf-fleet-eyebrow">FMB140 • LIVE FLEET COMMAND</p>
                <h1>{isAr ? 'مركز تتبع وتشخيص المركبات' : 'Vehicle Tracking & Diagnostics'}</h1>
                <p>{isAr ? 'مراقبة مباشرة، بيانات CAN الحقيقية، والتشخيص الوقائي' : 'Live monitoring, actual CAN telemetry & preventive diagnostics'}</p>
              </div>
              <div className="zf-fleet-status">
                <span className={`zf-fleet-led ${selectedDevice?.connected ? 'is-online' : ''}`} />
                {selectedDevice?.connected ? (isAr ? 'الجهاز متصل الآن' : 'Device connected') : (isAr ? 'بانتظار اتصال الجهاز' : 'Waiting for device')}
              </div>
            </div>
            <div className="zf-fleet-stats">
              <div className="zf-fleet-stat"><span>{isAr ? 'حالة الخادم' : 'Server'}</span><b>{serverHealthy ? (isAr ? 'يعمل' : 'Online') : (isAr ? 'متوقف' : 'Offline')}</b><small>HTTP / TCP</small></div>
              <div className="zf-fleet-stat"><span>{isAr ? 'المركبات المتصلة' : 'Connected'}</span><b>{devices.filter(d => d.connected).length}<em> / {devices.length}</em></b><small>{isAr ? 'مركبة' : 'Vehicles'}</small></div>
              <div className="zf-fleet-stat"><span>{isAr ? 'الجهاز المختار' : 'Selected vehicle'}</span><b className="zf-fleet-stat-name">{selectedDevice ? vehicleName : '—'}</b><small dir="ltr">{selectedDevice?.imei || 'FMB140'}</small></div>
              <div className="zf-fleet-stat"><span>{isAr ? 'آخر بيانات' : 'Last data'}</span><b className="zf-fleet-stat-date">{telemetry?.receivedAt ? new Date(telemetry.receivedAt).toLocaleTimeString(isAr ? 'ar-LY' : 'en-US') : '—'}</b><small>{isAr ? 'تحديث كل 4 ثوانٍ' : 'Every 4 seconds'}</small></div>
              <button className="zf-fleet-stat zf-fleet-stat-action" onClick={() => { checkHealth(); fetchDevices(); if (selectedImei) fetchTelemetry(selectedImei); }}>
                <span>{isAr ? 'تحديث البيانات' : 'Refresh telemetry'}</span><RotateCw size={25} /><small>{isAr ? 'فحص الآن' : 'Check now'}</small>
              </button>
            </div>
            <div className="zf-fleet-tools" role="navigation" aria-label={isAr ? 'أقسام النظام' : 'Dashboard sections'}>
              {[
                ['dashboard', isAr ? 'الرئيسية' : 'Overview'],
                ['map', isAr ? 'التتبع المباشر' : 'Live map'],
                ['sensors', isAr ? 'بيانات CAN' : 'CAN data'],
                ['diagnostics', isAr ? 'التشخيص' : 'Diagnostics'],
                ['alerts', isAr ? 'التنبيهات' : 'Alerts'],
              ].map(([tab, label]) => (
                <button key={tab} className={`zf-fleet-tab ${currentTab === tab ? 'active' : ''}`} onClick={() => setCurrentTab(tab)}>{label}</button>
              ))}
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
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} device={selectedDevice || devices[0] || null} lastDataAt={telemetry?.receivedAt || null} />
            )}
          </>
        )}

        {/* View 2: Trip History Log matching Screen 3 & 4 in Mockup */}
        {currentTab === 'trips' && (
          <>
            {selectedDevice ? (
              <TripsList device={selectedDevice} lang={lang} />
            ) : (
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} device={selectedDevice || devices[0] || null} lastDataAt={telemetry?.receivedAt || null} />
            )}
          </>
        )}

        {/* View 3: Live Vehicle Map matching Screen 2 in Mockup */}
        {currentTab === 'map' && (
          <>
            {selectedDevice ? (
              <>
                <TodayGpsRoute imei={selectedDevice.imei} lang={lang} />
                <TripMap
                  device={selectedDevice}
                  latestTelemetry={telemetry}
                  lang={lang}
                />
              </>
            ) : (
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} device={selectedDevice || devices[0] || null} lastDataAt={telemetry?.receivedAt || null} />
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
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} device={selectedDevice || devices[0] || null} lastDataAt={telemetry?.receivedAt || null} />
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
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} device={selectedDevice || devices[0] || null} lastDataAt={telemetry?.receivedAt || null} />
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
  device: DeviceInfo | null;
  lastDataAt: string | null;
}

const WaitingForVehicleCard: React.FC<WaitingProps> = ({ isAr, onRefresh, device, lastDataAt }) => {
  const [secondsWaiting, setSecondsWaiting] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsWaiting(s => s + 1);
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const [networkStatus, setNetworkStatus] = useState<{tcpConnectionsSinceStart:number;lastTcpConnectionAt:string|null;lastAvlPacketAt:string|null;tcpPublicHost:string|null;tcpPublicPort:number|null}|null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/health', { cache: 'no-store' });
        if (response.ok && active) {
          const json = await response.json();
          setNetworkStatus({
            tcpConnectionsSinceStart: Number(json.tcpConnectionsSinceStart ?? 0),
            lastTcpConnectionAt: json.lastTcpConnectionAt ?? null,
            lastAvlPacketAt: json.lastAvlPacketAt ?? null,
            tcpPublicHost: json.tcpPublicHost ?? null,
            tcpPublicPort: json.tcpPublicPort ?? null
          });
        }
      } catch { /* retain the last known status */ }
    };
    load();
    const timer = window.setInterval(load, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const [connectionDiagnosis, setConnectionDiagnosis] = useState<{reasonCode:string;reasonAr:string;lastTcpFailure:{code:string;message:string;at:string}|null}|null>(null);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch('/api/connection/diagnostics', { cache: 'no-store' });
        if (response.ok && active) setConnectionDiagnosis(await response.json());
      } catch { /* Network errors are shown by the existing /health state. */ }
    };
    check();
    const timer = window.setInterval(check, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const latestReceivedAt = lastDataAt || device?.lastPacketAt || null;
  const latestMs = latestReceivedAt ? Date.parse(latestReceivedAt) : NaN;
  const ageSeconds = Number.isFinite(latestMs) ? Math.max(0, Math.floor((nowMs - latestMs) / 1000)) : null;
  const duration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(x => String(x).padStart(2, '0')).join(':');
  };
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
          ? 'السيرفر يستمع لاتصالات TCP. لا تظهر البيانات إلا بعد وصول الجهاز فعلياً وإرسال حزم AVL؛ وتظهر قراءات CAN فقط إذا كان الجهاز موصولاً ومضبوطاً لإرسالها.'
          : 'The server is listening for real-time TCP connections and CAN bus packets (M-CAN & C-CAN). Turn on the vehicle ignition to begin streaming telemetry.'}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 text-center">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="text-xs font-semibold text-slate-500">{isAr ? 'مدة انتظار هذه الشاشة' : 'Waiting on this screen'}</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-blue-700" dir="ltr">{duration(secondsWaiting)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">{isAr ? 'آخر إرسال مسجّل' : 'Last known transmission'}</div>
          <div className="mt-2 font-mono text-lg font-bold text-slate-900" dir="ltr">{ageSeconds === null ? '—' : duration(ageSeconds)}</div>
          <div className="mt-1 text-[11px] text-slate-500">{ageSeconds === null ? (isAr ? 'لا توجد بيانات محفوظة' : 'No saved timestamps') : (isAr ? 'الوقت المنقضي منذ آخر إشارة' : 'Elapsed since last signal')}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold text-slate-500">{isAr ? 'حالة الجهاز' : 'Device state'}</div>
          <div className={`mt-2 text-base font-bold ${device?.connected ? 'text-emerald-700' : 'text-amber-700'}`}>
            {device?.connected ? (isAr ? 'متصل بالخادم' : 'TCP connected') : device ? (isAr ? 'غير متصل الآن' : 'Currently offline') : (isAr ? 'لم يسجل اتصال بعد' : 'Not detected yet')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{device?.totalRecords ? `${device.totalRecords} ${isAr ? 'سجل AVL مستلم' : 'AVL records received'}` : (isAr ? 'بانتظار بيانات AVL' : 'Awaiting AVL data')}</div>
        </div>
      </div>
      <p className="mt-4 text-xs leading-6 text-slate-500">
        {isAr ? 'يتم فحص الاتصال تلقائياً كل 4 ثوانٍ. العداد يقيس الانتظار، ولا يحدد موعد تشغيل الجهاز؛ يتوقف الإرسال على إعدادات الجهاز والشبكة.' : 'Connection is checked every 4 seconds. This timer shows elapsed waiting, not an exact time until the tracker reconnects.'}
      </p>
      <div className={`mt-5 rounded-2xl border p-4 text-start ${connectionDiagnosis?.reasonCode === 'DATA_RECEIVED' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="mb-2 flex items-center gap-2 font-extrabold text-slate-900">
          <span>{isAr ? 'نتيجة تشخيص الاتصال' : 'Connection diagnosis'}</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-mono" dir="ltr">{connectionDiagnosis?.reasonCode || 'CHECKING'}</span>
        </div>
        <p className="text-sm leading-7 text-slate-800">{connectionDiagnosis
          ? (isAr ? connectionDiagnosis.reasonAr : connectionDiagnosis.reasonCode.replaceAll('_', ' '))
          : (isAr ? 'جاري فحص السيرفر...' : 'Checking connection...')}</p>
        {connectionDiagnosis?.lastTcpFailure && (
          <p className="mt-2 text-xs text-slate-600">
            {isAr ? 'آخر خطأ مسجل:' : 'Last observed error:'} {connectionDiagnosis.lastTcpFailure.code} — {connectionDiagnosis.lastTcpFailure.message}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">{isAr
          ? 'التشخيص يعتمد على ما رآه السيرفر فقط. لا يستطيع كشف أعطال الشريحة أو الشبكة قبل وصول اتصال TCP.'
          : 'Diagnosis is limited to events observed by the server; a device-side cause cannot be proven without incoming traffic.'}</p>
      </div>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-start text-xs leading-7">
        <div className="mb-2 font-bold text-slate-800">{isAr ? 'تشخيص الاتصال من السيرفر' : 'Server-side connection diagnostics'}</div>
        <div>{isAr ? 'اتصالات TCP منذ تشغيل السيرفر:' : 'Inbound TCP connections since startup:'} <strong>{networkStatus?.tcpConnectionsSinceStart ?? '—'}</strong></div>
        <div>{isAr ? 'آخر اتصال TCP:' : 'Last inbound TCP:'} <strong dir="ltr">{networkStatus?.lastTcpConnectionAt ? new Date(networkStatus.lastTcpConnectionAt).toLocaleString() : '—'}</strong></div>
        <div>{isAr ? 'آخر حزمة AVL مفكوكة:' : 'Last decoded AVL packet:'} <strong dir="ltr">{networkStatus?.lastAvlPacketAt ? new Date(networkStatus.lastAvlPacketAt).toLocaleString() : '—'}</strong></div>
        <p className="mt-2 text-slate-500">{networkStatus && networkStatus.tcpConnectionsSinceStart === 0
          ? (isAr ? 'لم يصل أي اتصال TCP لهذه النسخة من السيرفر. تأكد من عنوان ومنفذ Railway TCP Proxy الخارجي.' : 'No TCP traffic has reached this server process. Check the external Railway TCP proxy address and port.')
          : networkStatus?.lastAvlPacketAt
          ? (isAr ? 'وصلت بيانات AVL إلى السيرفر. إذا لم تظهر في اللوحة فتحقق من الجهاز المحدد وسجل البيانات.' : 'AVL data has reached the server. Check selected device and history if the dashboard remains empty.')
          : (isAr ? 'وصل اتصال TCP لكن لم تُفك حزمة AVL حتى الآن. راجع سجل المصافحة وفك الحزم.' : 'TCP traffic arrived but no AVL packet has been decoded yet. Inspect handshake and parsing logs.')}</p>
      </div>
            {/* Connection Info Box */}
      <div className="mt-8 p-5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-700 text-left max-w-lg mx-auto">
        <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-600" />
          <span>{isAr ? 'بيانات اتصال جهاز الـ FMB140 في برنامج Configurator:' : 'Teltonika Configurator Settings:'}</span>
        </h3>

        <p className="mb-3 text-amber-700">{isAr ? "لا تستخدم القيم القديمة؛ يجب مطابقة العنوان والمنفذ الخارجيين من إعدادات Railway TCP Proxy." : "Always match the external endpoint shown in Railway TCP Proxy settings. The internal port 5000 is not the public port."}</p>
        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex justify-between py-1 border-b border-slate-200/60">
            <span className="text-slate-500">Server Domain / IP:</span>
            <span className="font-bold text-slate-900">{networkStatus?.tcpPublicHost || (isAr ? "غير مضبوط — راجع Railway" : "Not configured — check Railway")}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200/60">
            <span className="text-slate-500">Server Port:</span>
            <span className="font-bold text-blue-600">{networkStatus?.tcpPublicPort ? `${networkStatus.tcpPublicPort} (TCP)` : (isAr ? "غير مضبوط" : "Not configured")}</span>
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


// Login gate is mounted before the dashboard, so vehicle API polling starts only after authentication.
export const App: React.FC = () => {
  const [auth, setAuth] = useState<'checking' | 'guest' | 'logged-in'>('checking');
  const [username, setUsername] = useState('Admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => response.ok ? response.json() : {authenticated: false})
      .then(data => { if (active) setAuth(data.authenticated ? 'logged-in' : 'guest'); })
      .catch(() => { if (active) {setAuth('guest');setError('تعذر الاتصال بالخادم. تحقق من تشغيل Railway.');} });
    return () => { active = false; };
  }, []);
  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'تعذر تسجيل الدخول'); return; }
      setAuth('logged-in'); setPassword('');
    } catch { setError('تعذر الاتصال بالخادم. حاول مرة أخرى.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    try { await fetch('/api/auth/logout', {method: 'POST', credentials: 'same-origin'}); }
    finally { setAuth('guest'); setPassword(''); }
  };
  if (auth === 'checking') return <div className="zf-auth-loading" dir="rtl"><ShieldCheck size={35} /> جاري التحقق من الجلسة...</div>;
  if (auth === 'logged-in') return <DashboardApp onLogout={logout} />;
  return (
    <main className="zf-auth-root" dir="rtl">
      <div className="zf-auth-orb zf-auth-orb-one" /><div className="zf-auth-orb zf-auth-orb-two" />
      <section className="zf-auth-scene">
        <header className="zf-auth-logo"><span className="zf-auth-logo-mark"><Wifi size={29}/></span><span><strong>FMB<span>140</span></strong><small>FLEET INTELLIGENCE PLATFORM</small></span></header>
        <div className="zf-auth-intro"><div className="zf-auth-kicker"><span /> SMART VEHICLE INTELLIGENCE</div>
          <h1>القوة الكاملة<br/><em>لأسطولك الذكي.</em></h1>
          <p>منصة احترافية لتتبع المركبات، استقبال بيانات CAN الفعلية، مراقبة الأداء، والتشخيص الوقائي للأعطال.</p>
          <div className="zf-auth-highlights"><div><ShieldCheck size={20}/> لوحة تحكم محمية</div><div><Wifi size={20}/> تتبع مباشر</div><div><LockKeyhole size={20}/> وصول آمن</div></div>
        </div>
        <div className="zf-auth-decor"><span className="zf-auth-ring" /><span className="zf-auth-core"><Wifi size={65}/></span></div>
      </section>
      <section className="zf-auth-form-side">
        <form className="zf-auth-card" onSubmit={login}>
          <span className="zf-auth-icon"><LockKeyhole size={28}/></span>
          <div className="zf-auth-form-title"><span>مرحباً بعودتك</span><h2>تسجيل الدخول</h2><p>أدخل بيانات حسابك للوصول إلى مركز القيادة</p></div>
          <label htmlFor="zf-user">اسم المستخدم</label>
          <div className="zf-auth-input"><ShieldCheck size={18}/><input id="zf-user" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required placeholder="اسم المستخدم" /></div>
          <label htmlFor="zf-password">كلمة المرور</label>
          <div className="zf-auth-input"><LockKeyhole size={18}/><input id="zf-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="أدخل كلمة المرور"/><button type="button" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onClick={()=>setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
          {error && <div role="alert" className="zf-auth-error">{error}</div>}
          <button type="submit" className="zf-auth-submit" disabled={busy}>{busy ? 'جارٍ تسجيل الدخول...' : 'الدخول إلى النظام'}<LogIn size={19}/></button>
          <div className="zf-auth-note"><ShieldCheck size={15}/> الحساب الافتراضي للتجربة: Admin — كلمة المرور 123456</div>
          <p className="zf-auth-foot">ZAINFLEET © 2026 • TELTONIKA FMB140</p>
        </form>
      </section>
    </main>
  );
};
export default App;

