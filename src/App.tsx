import { AccessControl } from './components/AccessControl.tsx';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { UsersManagement } from './components/UsersManagement.tsx';
import { VehicleProfiles } from './components/VehicleProfiles.tsx';
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
import { InstrumentCluster } from './components/InstrumentCluster.tsx';
import { MobileDrawer } from './components/MobileDrawer.tsx';
import { DeviceInfo, TelemetrySnapshot } from './types/fleet.ts';
import { decodeCanMetrics, generateVehicleAlerts } from './utils/canBusDecoder.ts';
import {
  Car,
  Users,
  Bell,
  RotateCw,
  Server,
  ChevronDown,
  Trash2,
  Radio,
  Settings,
  LockKeyhole, Eye, EyeOff, LogIn, ShieldCheck, Wifi, LogOut,
} from 'lucide-react';

const DashboardApp: React.FC<{onLogout: () => void; role: 'admin'|'company_admin'|'employee'|'user'; displayName: string}> = ({onLogout,role,displayName}) => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [profileOpen,setProfileOpen]=useState(false);
  const roleLabel = role==='admin'?'المدير العام':role==='company_admin'?'مدير الشركة':role==='employee'?'موظف الشركة':'مستخدم عادي';
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

  // Refresh active telemetry every two seconds; independent of the tracker TCP
  // upload cadence. Do not issue overlapping HTTP polls to a slow Railway instance.
  useEffect(() => {
    let polling = false;
    let disposed = false;
    const refresh = async () => {
      if (polling || disposed || document.visibilityState === 'hidden') return;
      polling = true;
      try {
        await Promise.all([
          fetchDevices(),
          selectedImei ? fetchTelemetry(selectedImei) : Promise.resolve(),
          checkHealth(),
        ]);
      } finally {
        polling = false;
      }
    };
    const interval = window.setInterval(() => { void refresh(); }, 2000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onOnline = () => { void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [fetchDevices, fetchTelemetry, selectedImei, checkHealth]);

  const selectedDevice = devices.find((d) => d.imei === selectedImei) || null;
  const hasRecentAvl = Boolean(selectedDevice?.lastPacketAt && Date.now() - new Date(selectedDevice.lastPacketAt).getTime() < 15 * 60 * 1000);
  const deviceStatusLabel = selectedDevice?.connected ? (isAr ? 'TCP متصل الآن' : 'TCP connected') : hasRecentAvl ? (isAr ? 'بيانات حديثة — TCP مغلق' : 'Recent AVL — TCP closed') : (isAr ? 'لا يوجد اتصال TCP حالياً' : 'No active TCP connection');

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

  const liveMetrics = useMemo(() => telemetry?.record ? decodeCanMetrics(telemetry.record) : null, [telemetry]);
  const gaugeSpeed = liveMetrics?.speed.displaySpeedKmH ?? null;
  const gaugeRpm = liveMetrics?.engine.rpm ?? null;
  const gaugeFuel = liveMetrics?.fuel.levelPercent ?? null;
  const fuelLiters = liveMetrics?.fuel.levelLiters ?? null;
  const speedSweep = gaugeSpeed === null ? 0 : Math.max(0, Math.min(100, gaugeSpeed / 220 * 100));
  const rpmSweep = gaugeRpm === null ? 0 : Math.max(0, Math.min(100, gaugeRpm / 8000 * 100));
  const fuelSweep = gaugeFuel === null ? 0 : Math.max(0, Math.min(100, gaugeFuel));

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
      className="zf-fleet-shell zf-reference-shell min-h-screen flex flex-col font-sans pb-16 lg:pb-0"
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
      <main className="zf-page zf-fleet-page zf-reference-page flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Compact mobile top navigation, separate from the desktop toolbar. */}
        <header className="zf-mobile-topnav" dir={isAr ? 'rtl' : 'ltr'}>
          <button type="button" className="zf-mobile-brand" onClick={() => setCurrentTab('dashboard')} aria-label={isAr ? 'الرئيسية' : 'Home'}>
            <Car size={22} />
            <span><strong>ZainFleet</strong><small>{isAr ? 'تتبع المركبات' : 'Fleet tracking'}</small></span>
          </button>
          <div className="zf-mobile-top-actions">{(role==='admin'||role==='company_admin')&&<button type="button" onClick={()=>setCurrentTab('access-control')} aria-label="إدارة المستخدمين" title="إدارة المستخدمين"><Users size={19}/></button>}
            <button type="button" className={currentTab === 'map' ? 'active' : ''} onClick={() => setCurrentTab('map')} aria-label={isAr ? 'التتبع المباشر' : 'Live map'} title={isAr ? 'التتبع المباشر' : 'Live map'}><Radio size={19} /></button>
            <button type="button" className={currentTab === 'alerts' ? 'active zf-mobile-alert-btn' : 'zf-mobile-alert-btn'} onClick={() => setCurrentTab('alerts')} aria-label={isAr ? 'التنبيهات' : 'Alerts'} title={isAr ? 'التنبيهات' : 'Alerts'}><Bell size={19} />{unreadAlertsCount > 0 && <i>{unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}</i>}</button>
            <button type="button" onClick={() => setProfileOpen(true)} aria-label="الملف الشخصي" title="الملف الشخصي"><Settings size={19} /></button>
            <button type="button" className="zf-mobile-logout" onClick={onLogout} title={isAr ? 'تسجيل الخروج' : 'Log out'}><LogOut size={17} /><span>{isAr ? 'خروج' : 'Logout'}</span></button>
          </div>
        </header>
        <div className="zf-login-toolbar"><span>FMB140 • ADMIN CONSOLE</span><button type="button" onClick={onLogout}><LogOut size={15} /> تسجيل الخروج</button></div>

        <div className="zf-pixel-topbar">
          <div className="zf-pixel-brand"><Car size={46}/><strong>نظام تتبع المركبات</strong><small>Vehicle Tracking System</small></div>
          <nav aria-label="التنقل الرئيسي">{([['dashboard','الرئيسية','⌂'],['map','التتبع المباشر','◎'],['vehicle-profiles','المركبات','▣'],['alerts','التنبيهات','♧'],['diagnostics','الأعطال','⚒'],['trips','التقارير','▤'],['users','المستخدمون','♙'],['sensors','الإعدادات','⚙']] as const).filter(([tab])=>(tab!=='users'&&tab!=='vehicle-profiles')||role!=='user').map(([tab,label,icon])=><button type="button" key={tab} className={currentTab===tab?'active':''} onClick={()=>setCurrentTab(tab)}><b>{icon}</b><span>{label}</span>{tab==='alerts'&&unreadAlertsCount>0&&<i>{unreadAlertsCount}</i>}</button>)}</nav>
          <div className="zf-pixel-account"><button type="button" onClick={()=>setProfileOpen(true)} title="الملف الشخصي">{displayName||roleLabel}</button><button type="button" onClick={onLogout} title="تسجيل الخروج"><LogOut size={18}/></button></div>
        </div>
        <div className="zf-ref-shell">
          <aside className="zf-ref-menu zf-pixel-sidebar" aria-label="لوحات التحكم">
            <h3>لوحات التحكم حسب الصلاحيات</h3>
            <button type="button" className={role==='admin'?'zf-pixel-role selected':'zf-pixel-role'} onClick={()=>setCurrentTab('dashboard')}><span>♛</span><strong>المدير العام<small>لوحة شاملة لجميع الشركات والمركبات</small></strong></button>
            <button type="button" className={role==='company_admin'?'zf-pixel-role selected':'zf-pixel-role'} onClick={()=>setCurrentTab(role==='user'?'dashboard':'vehicle-profiles')}><span>▥</span><strong>مدير شركة<small>إدارة مركبات الشركة والتقارير</small></strong></button>
            <button type="button" className={role==='user'?'zf-pixel-role selected':'zf-pixel-role'} onClick={()=>setCurrentTab('map')}><span>♟</span><strong>مستخدم عادي<small>تتبع المركبات المصرح بها</small></strong></button>
            <div className="zf-pixel-side-bottom"><Radio size={48}/><strong>ZAINFLEET</strong><small>GPS • CAN • FLEET</small></div>
          </aside>
          <div className="zf-ref-workspace">
            <div className="zf-ref-title"><span>♛</span> لوحة التحكم - {roleLabel}</div>
            {currentTab==='dashboard' && <>
              <div className="zf-pixel-dashboard">
                <section className="zf-pixel-panel zf-pixel-map">
                  <header><span>التتبع المباشر</span><b className={selectedDevice?.connected?'zf-pixel-live':'zf-pixel-muted'}>{selectedDevice?.connected?'● مباشر':'○ غير متصل'}</b></header>
                  <div className="zf-pixel-map-content">{selectedDevice?<TripMap device={selectedDevice} latestTelemetry={telemetry} lang={lang}/>:<div className="zf-pixel-empty">لا توجد مركبات مرتبطة بهذا الحساب</div>}</div>
                  <div className="zf-pixel-map-overlay"><span>{vehicleName}</span><strong>{gaugeSpeed===null?'—':Math.round(gaugeSpeed)+' كم/س'}</strong></div>
                </section>
                <section className="zf-pixel-panel zf-pixel-gauges">
                  <header><span>العداد الرسمي للسيارة</span><Car size={19}/></header>
                  <InstrumentCluster speed={gaugeSpeed} rpm={gaugeRpm} fuel={gaugeFuel} temperature={liveMetrics?.engine.coolantTempC ?? null} odometer={liveMetrics?.odometer.totalKm ?? null} trip={liveMetrics?.odometer.tripKm ?? null} connected={Boolean(selectedDevice?.connected)} />
                </section>
                <section className="zf-pixel-panel zf-pixel-car">
                  <header><span>{vehicleName}</span><b className={selectedDevice?.connected?'zf-pixel-live':'zf-pixel-muted'}>{selectedDevice?.connected?'متصلة':'غير متصلة'}</b></header>
                  <div className="zf-pixel-car-graphic"><Car size={110} strokeWidth={1.15}/></div>
                  <div className="zf-pixel-car-facts"><span>رقم الجهاز<strong>{selectedDevice?.imei||'—'}</strong></span><span>حالة GPS<strong>{liveMetrics?.gnss.isFixValid?'متاح':'غير متاح'}</strong></span><span>السرعة<strong>{gaugeSpeed===null?'—':Math.round(gaugeSpeed)+' كم/س'}</strong></span></div>
                </section>
                <section className="zf-pixel-panel zf-pixel-doors">
                  <header><span>حالة الأبواب والشبابيك</span><LockKeyhole size={18}/></header>
                  <div className="zf-pixel-doors-body">
                    <div className="zf-pixel-door-list">{[['الباب الأمامي الأيسر',liveMetrics?.comfort.doors.driverOpen],['الباب الأمامي الأيمن',liveMetrics?.comfort.doors.passengerOpen],['الباب الخلفي الأيسر',liveMetrics?.comfort.doors.rearLeftOpen],['الباب الخلفي الأيمن',liveMetrics?.comfort.doors.rearRightOpen],['غطاء المحرك',liveMetrics?.comfort.doors.hoodOpen],['صندوق الأمتعة',liveMetrics?.comfort.doors.trunkOpen]].map(([name,open],i)=><div key={i}><span>{name}</span><b className={!liveMetrics?.comfort.hasDoorData?'unknown':open?'open':'closed'}>{!liveMetrics?.comfort.hasDoorData?'غير متاح':open?'مفتوح':'مغلق'}</b></div>)}</div>
                    <div className="zf-pixel-topcar"><Car size={90} strokeWidth={1.1}/><small>قراءات CAN</small></div>
                    <div className="zf-pixel-window-list"><span>النافذة الأمامية اليسرى <b>غير متاح</b></span><span>النافذة الأمامية اليمنى <b>غير متاح</b></span><span>النافذة الخلفية اليسرى <b>غير متاح</b></span><span>النافذة الخلفية اليمنى <b>غير متاح</b></span></div>
                  </div>
                </section>
                <section className="zf-pixel-panel zf-pixel-faults">
                  <header><span>أخطاء السيارة (OBD)</span><b className="zf-pixel-warn">⚠</b></header>
                  <div className="zf-pixel-fault-list">{liveMetrics?.diagnostic.dtcCodes?.length?liveMetrics.diagnostic.dtcCodes.slice(0,3).map((fault,i)=><button type="button" key={i} onClick={()=>setCurrentTab('diagnostics')}><b>{fault.code}</b><span>{fault.descriptionAr}</span></button>):<p>لا توجد رموز أعطال مؤكدة من الجهاز</p>}</div>
                  <button className="zf-pixel-action" type="button" onClick={()=>setCurrentTab('diagnostics')}>⚒ تفاصيل الأخطاء والصيانة</button>
                </section>
                <section className="zf-pixel-panel zf-pixel-trip">
                  <header>معلومات الرحلة الحالية</header>
                  <div className="zf-pixel-metrics"><article><span>◷</span><small>آخر استقبال</small><b>{telemetry?.receivedAt?new Date(telemetry.receivedAt).toLocaleTimeString('ar-LY'):'—'}</b></article><article><span>⌁</span><small>المسافة</small><b>{liveMetrics?.odometer.tripKm==null?'—':liveMetrics.odometer.tripKm.toFixed(1)+' كم'}</b></article><article><span>◉</span><small>السرعة الحالية</small><b>{gaugeSpeed===null?'—':Math.round(gaugeSpeed)+' كم/س'}</b></article></div>
                </section>
                <section className="zf-pixel-panel zf-pixel-health">
                  <header><span>حالة السيارة العامة</span><b className={selectedDevice?.connected?'zf-pixel-live':'zf-pixel-muted'}>{selectedDevice?.connected?'● متصلة':'○ غير متصلة'}</b></header>
                  <div className="zf-pixel-metrics"><article><span>⚡</span><small>البطارية</small><b>{liveMetrics?.electrical.vehicleVoltageV==null?'—':liveMetrics.electrical.vehicleVoltageV.toFixed(1)+' V'}</b></article><article><span>♨</span><small>حرارة المحرك</small><b>{liveMetrics?.engine.coolantTempC==null?'—':liveMetrics.engine.coolantTempC+'°C'}</b></article><article><span>⛽</span><small>الوقود</small><b>{gaugeFuel!==null?Math.round(gaugeFuel)+'%':fuelLiters!==null?fuelLiters.toFixed(1)+' لتر':'غير متاح'}</b></article><article><span>⚙</span><small>المحرك</small><b>{liveMetrics?.ignition.verified?(liveMetrics.ignition.isOn?'يعمل':'متوقف'):'غير متاح'}</b></article></div>
                </section>
                <section className="zf-pixel-panel zf-pixel-alerts">
                  <header><span>أحدث التنبيهات</span><b className="zf-pixel-warn">♟</b></header>
                  <button type="button" onClick={()=>setCurrentTab('alerts')}>{unreadAlertsCount?unreadAlertsCount+' تنبيهات للمركبة المحددة':'لا توجد تنبيهات حالياً'} <span>‹</span></button>
                  <button type="button" onClick={()=>setCurrentTab('alerts')}>عرض سجل التنبيهات <span>‹</span></button>
                </section>
              </div>
            </>}
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

        {currentTab === 'profile' && <AccountProfile onPasswordChanged={onLogout} />}

        {/* View 8: Privacy Policy */}
        {currentTab === 'privacy' && <PrivacyPolicy />}
        {currentTab === 'access-control' && <AccessControl role={role} />}
          </div>
        </div>
      </main>

      {profileOpen && <div className="zf-profile-backdrop" role="presentation" onClick={()=>setProfileOpen(false)}><div className="zf-profile-dialog" role="dialog" aria-modal="true" aria-label="الملف الشخصي" onClick={e=>e.stopPropagation()}><button type="button" className="zf-profile-close" onClick={()=>setProfileOpen(false)}>✕ إغلاق</button><AccountProfile onPasswordChanged={onLogout}/></div></div>}

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
                  {deviceStatusLabel}
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

const AccountProfile: React.FC<{onPasswordChanged:()=>void}> = ({onPasswordChanged}) => {
  const [profile,setProfile]=useState<{username:string;displayName:string;role:string;companyName?:string|null;email?:string;phone?:string}|null>(null);
  const [current,setCurrent]=useState('');
  const [next,setNext]=useState('');
  const [confirm,setConfirm]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;fetch('/api/auth/profile',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('تعذر تحميل الملف الشخصي');return r.json()}).then(d=>{if(active)setProfile(d)}).catch(()=>{if(active)setMessage('تعذر تحميل بيانات الحساب')});return()=>{active=false}},[]);
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();setMessage('');
    if(next.length<10){setMessage('كلمة المرور يجب أن تحتوي على 10 أحرف على الأقل');return;}
    if(next!==confirm){setMessage('تأكيد كلمة المرور غير مطابق');return;}
    setBusy(true);
    try{
      const r=await fetch('/api/auth/change-password',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:current,newPassword:next})});
      const d=await r.json();
      if(!r.ok){setMessage(d.error||'فشل تغيير كلمة المرور');return;}
      setCurrent('');setNext('');setConfirm('');setMessage('تم الحفظ. يرجى تسجيل الدخول مجدداً.');
      onPasswordChanged();
    }catch{setMessage('تعذر الاتصال بالخادم');}finally{setBusy(false);}
  };
  return <section className="zf-account-profile" dir="rtl">
    <div className="zf-profile-heading"><div className="zf-profile-avatar"><Users size={30}/></div><div><h2>الملف الشخصي</h2><p>بيانات الحساب وأمان تسجيل الدخول</p></div></div>
    <div className="zf-profile-details">
      <div><small>الاسم</small><strong>{profile?.displayName||'جارٍ التحميل...'}</strong></div>
      <div><small>اسم المستخدم</small><strong dir="auto">{profile?.username||'—'}</strong></div>
      <div><small>الصلاحية</small><strong>{profile?.role==='admin'?'مدير النظام':profile?.role==='company_admin'?'مدير شركة':profile?.role==='employee'?'موظف':'مستخدم'}</strong></div>
      {profile?.companyName&&<div><small>الشركة</small><strong>{profile.companyName}</strong></div>}
      {profile?.email&&<div><small>البريد الإلكتروني</small><strong dir="auto">{profile.email}</strong></div>}
      {profile?.phone&&<div><small>الهاتف</small><strong dir="auto">{profile.phone}</strong></div>}
    </div>
    <form className="zf-profile-form" onSubmit={submit}>
      <h3><LockKeyhole size={19}/> تغيير كلمة المرور</h3>
      <label>كلمة المرور الحالية<input type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)}/></label>
      <label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={next} onChange={e=>setNext(e.target.value)}/></label>
      <label>تأكيد كلمة المرور<input type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
      {message&&<p role="status" className="zf-profile-message">{message}</p>}
      <button type="submit" disabled={busy}>{busy?'جارٍ الحفظ...':'حفظ كلمة المرور'}</button>
    </form>
  </section>;
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
  const [account, setAccount] = useState<{role:'admin'|'company_admin'|'employee'|'user';displayName:string}>({role:'admin',displayName:'محمد زين'});
  const [username, setUsername] = useState('Admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => response.ok ? response.json() : {authenticated: false})
      .then(data => { if (active) {setAuth(data.authenticated ? 'logged-in' : 'guest'); if (data.authenticated) setAccount({role:data.role === 'company_admin' ? 'company_admin' : data.role === 'employee' ? 'employee' : data.role === 'user' ? 'user':'admin',displayName:data.displayName||'محمد زين'}); } })
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
      setAccount({role:data.role === 'company_admin'?'company_admin':data.role === 'employee'?'employee':data.role === 'user'?'user':'admin',displayName:data.displayName||'محمد زين'});setAuth('logged-in'); setPassword('');
    } catch { setError('تعذر الاتصال بالخادم. حاول مرة أخرى.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    try { await fetch('/api/auth/logout', {method: 'POST', credentials: 'same-origin'}); }
    finally { setAuth('guest'); setPassword(''); }
  };
  if (auth === 'checking') return <div className="zf-auth-loading" dir="rtl"><ShieldCheck size={35} /> جاري التحقق من الجلسة...</div>;
  if (auth === 'logged-in') return <DashboardApp onLogout={logout} role={account.role} displayName={account.displayName} />;
  return (
    <main className="zf-mobile-login zf-zain-login" dir="rtl">
      <div className="zf-zain-scene" aria-hidden="true">
        <div className="zf-zain-worldmap" />
        <div className="zf-zain-route"><span className="zf-zain-pin zf-zain-pin-a">●</span><span className="zf-zain-pin zf-zain-pin-b">●</span></div>
        <div className="zf-zain-skyline" />
        <div className="zf-zain-road" />
        <div className="zf-zain-car"><Car size={126} strokeWidth={1.1}/></div>
        <div className="zf-zain-satellite">✦</div>
      </div>
      <div className="zf-zain-login-layout">
        <header className="zf-zain-brand">
          <div className="zf-zain-brand-line"><span className="zf-zain-brand-pin"><Car size={36}/></span><strong>زين</strong></div>
          <p>نظام تتبع وإدارة المركبات</p>
        </header>
        <section className="zf-zain-login-panel">
          <div className="zf-zain-user-icon"><ShieldCheck size={30}/></div>
          <h1>تسجيل الدخول</h1>
          <form onSubmit={login} className="zf-zain-form">
            <div className="zf-zain-field"><input aria-label="البريد الإلكتروني أو اسم المستخدم" id="zf-user" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required placeholder="البريد الإلكتروني" /><span><Bell size={23}/></span></div>
            <div className="zf-zain-field"><input aria-label="كلمة المرور" id="zf-password" type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="كلمة المرور" /><button type="button" aria-label={showPassword?'إخفاء كلمة المرور':'إظهار كلمة المرور'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={24}/>:<Eye size={24}/>}</button><span><LockKeyhole size={23}/></span></div>
            <div className="zf-zain-options"><label><input type="checkbox" defaultChecked /> تذكرني</label><span title="تواصل مع مدير النظام لإعادة تعيين كلمة المرور">نسيت كلمة المرور؟</span></div>
            {error && <p role="alert" className="zf-mobile-login-error">{error}</p>}
            <button type="submit" className="zf-zain-submit" disabled={busy}><LogIn size={23}/>{busy?'جارٍ تسجيل الدخول...':'دخول'}</button>
          </form>
          <div className="zf-zain-features"><span><Radio size={24}/> تتبع مباشر</span><span><Settings size={24}/> تقارير وإحصائيات</span><span><Car size={24}/> إدارة الأسطول</span></div>
        </section>
      </div>
    </main>
  );};
export default App;

