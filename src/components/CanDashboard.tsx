import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { DeviceInfo, TelemetrySnapshot } from '../types/fleet.js';
import { decodeCanMetrics, generateVehicleAlerts } from '../utils/canBusDecoder.js';
import {
  Car,
  Gauge,
  Fuel,
  Power,
  Route,
  Bell,
  RotateCw,
  ExternalLink,
  Edit2,
  Check,
  X,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Activity,
  Terminal,
  Download,
} from 'lucide-react';
import { formatCoordinates, getApproximateAddress } from '../utils/geoUtils.js';

interface CanDashboardProps {
  device: DeviceInfo;
  telemetry: TelemetrySnapshot | null;
  isLoading: boolean;
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
  vehicleName: string;
  onUpdateVehicleName: (name: string) => void;
  lang: 'ar' | 'en';
}

export const CanDashboard: React.FC<CanDashboardProps> = ({
  device,
  telemetry,
  isLoading,
  onRefresh,
  onNavigate,
  vehicleName,
  onUpdateVehicleName,
  lang,
}) => {
  const isAr = lang === 'ar';
  const record = telemetry?.record;
  const metrics = record ? decodeCanMetrics(record) : null;
  const alerts = metrics ? generateVehicleAlerts(metrics) : [];

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(vehicleName);
  const [locationAddress, setLocationAddress] = useState<string>('...');
  const fuelSettingsKey = 'zainfleet_fuel_' + device.imei;
  const [fuelConfig, setFuelConfig] = useState<{tankLiters:string;litersPer100Km:string}>(() => {
    try { const v = JSON.parse(localStorage.getItem('zainfleet_fuel_' + device.imei) || '{}'); return {tankLiters:String(v.tankLiters||''),litersPer100Km:String(v.litersPer100Km||'')}; }
    catch { return {tankLiters:'',litersPer100Km:''}; }
  });
  const [showFuelSettings, setShowFuelSettings] = useState(false);
  useEffect(() => {
    try { const v=JSON.parse(localStorage.getItem(fuelSettingsKey)||'{}');setFuelConfig({tankLiters:String(v.tankLiters||''),litersPer100Km:String(v.litersPer100Km||'')}); }
    catch {setFuelConfig({tankLiters:'',litersPer100Km:''});}
  },[fuelSettingsKey]);
  const tankLiters = Number(fuelConfig.tankLiters);
  const averageConsumption = Number(fuelConfig.litersPer100Km);
  const fuelLiters = metrics?.fuel.levelLiters;
  const percentFromCan = metrics?.fuel.levelPercent;
  const fuelPercentage = percentFromCan != null && Number.isFinite(percentFromCan) && percentFromCan >= 0 && percentFromCan <= 100
    ? percentFromCan : fuelLiters != null && tankLiters > 0 && tankLiters <= 1000 ? Math.max(0,Math.min(100,fuelLiters/tankLiters*100)) : null;
  const remainingRange = fuelLiters != null && fuelLiters >= 0 && averageConsumption > 0 && averageConsumption <= 100
    ? Math.round(fuelLiters / averageConsumption * 100) : null;
  const saveFuelConfig = () => {
    localStorage.setItem(fuelSettingsKey,JSON.stringify(fuelConfig));setShowFuelSettings(false);
  };

  const miniMapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Update address via reverse geocoding helper
  useEffect(() => {
    if (record && record.latitude && record.longitude) {
      getApproximateAddress(record.latitude, record.longitude, isAr).then((addr) => {
        setLocationAddress(addr);
      });
    } else {
      setLocationAddress(isAr ? 'في انتظار إشارة GPS صالحة' : 'Waiting for GPS fix');
    }
  }, [record, isAr]);

  // Mini Leaflet Map Preview
  useEffect(() => {
    if (!miniMapRef.current || !record || record.latitude === 0 || record.longitude === 0) {
      return;
    }

    if (!mapInstanceRef.current) {
      const map = L.map(miniMapRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
      }).setView([record.latitude, record.longitude], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Marker
      const carIcon = L.divIcon({
        className: 'mini-car-marker',
        html: `
          <div style="background: #2563eb; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([record.latitude, record.longitude], { icon: carIcon }).addTo(map);
      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([record.latitude, record.longitude], 15);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [record?.latitude, record?.longitude]);

  // Freshness check: measurement time vs current time
  const measurementDate = record ? new Date(record.timestamp) : null;
  const isStale = measurementDate
    ? Date.now() - measurementDate.getTime() > 5 * 60 * 1000
    : true;

  const handleSaveName = () => {
    if (editedName.trim()) {
      onUpdateVehicleName(editedName.trim());
    }
    setIsEditingName(false);
  };

  return (
    <div className="zf-cockpit space-y-4 max-w-7xl mx-auto pb-12">
      <section className="zf-cockpit-grid" aria-label={isAr ? 'لوحة قيادة حية' : 'Live vehicle cockpit'}>
        <div className="zf-cockpit-map">
          <div className="zf-cockpit-top"><span>◉ {isAr ? 'الخريطة المباشرة' : 'LIVE MAP'}</span>
            <span className="zf-cockpit-live">{device.tcpConnected ? (isAr ? 'متصل الآن' : 'LIVE') : (isAr ? 'آخر موقع محفوظ' : 'LAST KNOWN LOCATION')}</span></div>
          <div className="zf-cockpit-map-canvas" ref={miniMapRef} role="img" aria-label={isAr ? 'موقع السيارة على الخريطة' : 'Vehicle location map'}>
            {(!record || !record.latitude || !record.longitude) && <div className="zf-cockpit-no-gps">{isAr ? 'في انتظار إحداثيات GPS حقيقية' : 'Waiting for real GPS location'}</div>}
          </div>
          <div className="zf-cockpit-map-footer"><span>{locationAddress}</span><button onClick={() => onNavigate('map')}>{isAr ? 'فتح الخريطة' : 'Open full map'} ↗</button></div>
        </div>
        <div className="zf-cockpit-instruments">
          <div className="zf-cockpit-vehicle">
            <Car size={32} /><div><strong>{vehicleName}</strong><span>{device.imei} · {device.tcpConnected ? (isAr ? 'اتصال TCP نشط' : 'TCP connected') : (isAr ? 'لا يوجد اتصال TCP نشط' : 'TCP not connected')}</span></div>
          </div>
          <div className="zf-cockpit-dials">
            {[
              {label:isAr ? 'السرعة' : 'SPEED',value:record ? String(record.speed) : '—',unit:'km/h',amount:record ? Math.max(0,Math.min(100,record.speed/220*100)):0,color:'blue'},
              {label:isAr ? 'دوران المحرك' : 'ENGINE RPM',value:metrics?.engine.rpm == null ? '—' : String(Math.round(metrics.engine.rpm)),unit:'rpm',amount:metrics?.engine.rpm == null ? 0 : Math.max(0,Math.min(100,metrics.engine.rpm/8000*100)),color:'orange'},
            ].map(dial => <div className={`zf-cockpit-dial ${dial.color}`} key={dial.label} style={{'--fill': `${dial.amount}%`} as React.CSSProperties}>
              <div className="zf-cockpit-dial-ring"><div className="zf-cockpit-dial-center"><b>{dial.value}</b><small>{dial.unit}</small></div></div>
              <span>{dial.label}</span>
            </div>)}
          </div>
          <div className="zf-fuel-dashboard" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="zf-fuel-heading"><span><Fuel size={21}/> {isAr ? 'الوقود والمسافة المتبقية' : 'Fuel & Driving Range'}</span>
              <button type="button" onClick={()=>setShowFuelSettings(v=>!v)} aria-expanded={showFuelSettings}>{isAr ? 'إعدادات الخزان والاستهلاك' : 'Fuel settings'} ⚙</button>
            </div>
            <div className="zf-fuel-stats">
              <div><small>{isAr ? 'نسبة الوقود' : 'Fuel percentage'}</small><strong>{fuelPercentage==null ? '—' : `${fuelPercentage.toFixed(1)}%`}</strong></div>
              <div><small>{isAr ? 'الكمية المتبقية' : 'Fuel remaining'}</small><strong>{fuelLiters==null ? '—' : `${fuelLiters.toFixed(1)} L`}</strong></div>
              <div><small>{isAr ? 'المسافة التقديرية' : 'Estimated range'}</small><strong>{remainingRange==null ? '—' : `${remainingRange} km`}</strong></div>
            </div>
            <div className="zf-fuel-track"><span style={{width:`${fuelPercentage??0}%`}}/></div>
            <p>{isAr ? 'المسافة تقديرية حسب متوسط الاستهلاك المدخل وليست قراءة مباشرة من الجهاز.' : 'Range is estimated from configured average consumption, not direct tracker data.'}</p>
            {showFuelSettings && <div className="zf-fuel-settings">
              <label>{isAr?'سعة خزان السيارة (لتر)':'Tank capacity (L)'}<input type="number" min="1" max="1000" step="0.1" value={fuelConfig.tankLiters} onChange={e=>setFuelConfig(x=>({...x,tankLiters:e.target.value}))}/></label>
              <label>{isAr?'متوسط الاستهلاك (لتر / 100 كم)':'Consumption (L/100km)'}<input type="number" min="0.1" max="100" step="0.1" value={fuelConfig.litersPer100Km} onChange={e=>setFuelConfig(x=>({...x,litersPer100Km:e.target.value}))}/></label>
              <button type="button" onClick={saveFuelConfig}>{isAr?'حفظ':'Save'}</button>
            </div>}
          </div>
          <div className="zf-cockpit-metrics">
            <div><Fuel size={19}/><span>{isAr ? 'الوقود' : 'Fuel'}</span><b>{metrics?.fuel.levelLiters == null ? '—' : `${metrics.fuel.levelLiters} L`}</b></div>
            <div><Activity size={19}/><span>{isAr ? 'حرارة المحرك' : 'Engine temp'}</span><b>{metrics?.engine.coolantTempC == null ? '—' : `${metrics.engine.coolantTempC}°C`}</b></div>
            <div><Power size={19}/><span>{isAr ? 'حالة الإشعال' : 'Ignition'}</span><b>{metrics?.ignition.verified ? (metrics.ignition.isOn ? 'ON' : 'OFF') : '—'}</b></div>
          </div>
        </div>
      </section>

      {/* 1. Main Vehicle Card (بطاقة المركبة الرئيسية) matching Screen 1 in Mockup */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Vehicle Avatar / Illustration */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-slate-100 border border-slate-200/80 flex items-center justify-center text-blue-600 shadow-sm shrink-0 relative overflow-hidden">
              <Car className="w-10 h-10" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="font-bold text-base text-slate-900 border border-blue-400 rounded-lg px-2 py-0.5 focus:outline-hidden"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-1 rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                      {vehicleName}
                    </h1>
                    <button
                      onClick={() => {
                        setEditedName(vehicleName);
                        setIsEditingName(true);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded-md transition-colors"
                      title={isAr ? 'تعديل اسم المركبة' : 'Edit vehicle name'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Connection Status Badge matching Mockup */}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    device.connected
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      device.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {device.connected
                    ? isAr
                      ? 'متصل'
                      : 'Online'
                    : isAr
                    ? 'غير متصل'
                    : 'Offline'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1 font-mono">
                <span>FMB140 CAN &bull; IMEI: {device.imei}</span>
                {metrics && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-md text-[10px] font-sans font-bold ${
                      metrics.isMoving.state
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <Activity className="w-3 h-3" />
                    <span>{isAr ? metrics.isMoving.labelAr : metrics.isMoving.labelEn}</span>
                  </span>
                )}
              </div>

              {/* Dual Timestamps: Device Measurement Time & Server Reception Time */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 mt-2 font-mono">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                  <span>
                    {isAr ? 'وقت قياس الجهاز:' : 'Device measured:'}{' '}
                    <strong className="text-slate-700">
                      {measurementDate
                        ? `${measurementDate.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}`
                        : '---'}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-300">&bull;</span>
                  <span>
                    {isAr ? 'استلام الخادم:' : 'Server sync:'}{' '}
                    <span className="text-slate-600">
                      {telemetry?.receivedAt || device.lastPacketAt
                        ? new Date(telemetry?.receivedAt || device.lastPacketAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '---'}
                    </span>
                  </span>
                </div>

                {isStale && (
                  <span className="text-[10px] text-amber-700 font-sans font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    {isAr ? 'بيانات قديمة (> 5 د)' : 'Stale Data (> 5m)'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end sm:flex-col sm:items-end gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isAr ? 'تحديث حي' : 'Sync'}</span>
            </button>
          </div>
        </div>

        {/* 3 Vital Hero Indicator Cards matching Mockup (السرعة, حالة التشغيل, الوقود) */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-100">
          {/* 1. السرعة (Speed) */}
          <div className="bg-slate-50/80 rounded-2xl p-3 sm:p-4 text-center border border-slate-200/60">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-1.5">
              <Gauge className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 block">
              {isAr ? 'السرعة' : 'Speed'}
            </span>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900">
                {record?.speed ?? 0}
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                {isAr ? 'كم/س' : 'km/h'}
              </span>
            </div>
          </div>

          {/* 2. حالة التشغيل (Ignition / Running state) */}
          <div className="bg-slate-50/80 rounded-2xl p-3 sm:p-4 text-center border border-slate-200/60">
            <div
              className={`w-8 h-8 rounded-xl mx-auto flex items-center justify-center mb-1.5 ${
                metrics?.ignition.isOn
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              <Power className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 block">
              {isAr ? 'حالة التشغيل' : 'Ignition'}
            </span>
            <span
              className={`text-sm sm:text-base font-extrabold block mt-1 ${
                metrics?.ignition.isOn ? 'text-emerald-700' : 'text-slate-600'
              }`}
            >
              {metrics?.ignition.isOn
                ? isAr
                  ? 'يعمل'
                  : 'ON'
                : isAr
                ? 'متوقف'
                : 'OFF'}
            </span>
          </div>

          {/* 3. الوقود (Fuel) */}
          <div className="bg-slate-50/80 rounded-2xl p-3 sm:p-4 text-center border border-slate-200/60">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center mb-1.5">
              <Fuel className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 block">
              {isAr ? 'الوقود' : 'Fuel'}
            </span>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900">
                {metrics?.fuel.levelPercent !== null ? `${metrics?.fuel.levelPercent}%` : '---'}
              </span>
            </div>
          </div>
        </div>

        {/* 4. الموقع الحالي (Current Location Card with mini map preview) matching Mockup */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200/70">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                {isAr ? 'الموقع الحالي' : 'Current Location'}
              </span>
              <p className="font-bold text-xs sm:text-sm text-slate-800 truncate mt-0.5">
                {locationAddress}
              </p>
              {record && (
                <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                  {formatCoordinates(record.latitude, record.longitude)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Interactive mini-map thumbnail container */}
            <div
              onClick={() => onNavigate('map')}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-slate-200 shadow-2xs cursor-pointer hover:border-blue-500 transition-colors hidden xs:block"
            />

            <button
              onClick={() => onNavigate('map')}
              className="px-3 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
            >
              <span>{isAr ? 'فتح على الخريطة' : 'Open Map'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Three Big Action Quick Tiles matching Mockup (رحلتي, التنبيهات, بيانات السيارة) */}
      <div className="grid grid-cols-3 gap-3">
        {/* Tile 1: رحلتي (المسارات والرحلات) - Blue */}
        <div
          onClick={() => onNavigate('trips')}
          className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-3">
            <Route className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">
              {isAr ? 'رحلتي' : 'My Trips'}
            </h3>
            <p className="text-[11px] text-blue-100/80 mt-0.5 truncate">
              {isAr ? 'المسارات والرحلات' : 'Routes & logs'}
            </p>
          </div>
        </div>

        {/* Tile 2: التنبيهات (المشكلات المهمة) - Amber/Orange with Badge */}
        <div
          onClick={() => onNavigate('alerts')}
          className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative active:scale-[0.98]"
        >
          {alerts.length > 0 && (
            <span className="absolute top-3 left-3 sm:top-4 sm:left-4 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold shadow-sm">
              {alerts.length}
            </span>
          )}
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-3">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">
              {isAr ? 'التنبيهات' : 'Alerts'}
            </h3>
            <p className="text-[11px] text-amber-100/90 mt-0.5 truncate">
              {isAr ? 'المشكلات المهمة' : 'Warnings & issues'}
            </p>
          </div>
        </div>

        {/* Tile 3: بيانات السيارة (الحساسات والصيانة) - Emerald/Green */}
        <div
          onClick={() => onNavigate('vehicle')}
          className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-3">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">
              {isAr ? 'بيانات السيارة' : 'Vehicle Vitals'}
            </h3>
            <p className="text-[11px] text-emerald-100/80 mt-0.5 truncate">
              {isAr ? 'الحساسات والصيانة' : 'CAN & sensors'}
            </p>
          </div>
        </div>
      </div>

      {/* 2.5 Diagnostic & FMB140 Packet Log Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-400/30">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-white">
                {isAr ? 'فحص حزم البيانات والتشخيص (FMB140 Diagnostic)' : 'FMB140 Packet & CAN Diagnostics'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200">
                Log Ready
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              {isAr
                ? 'تشخيص أسباب غياب جهد بطارية السيارة الرئيسي (ID 66) وبيانات CAN مع رابط تنزيل ملف الـ Log لـ ChatGPT.'
                : 'Audit vehicle battery voltage (ID 66) & CAN sensors. Download diagnostic packet log for ChatGPT.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/api/diagnostics/download"
            download="fmb140_packet_diagnostic.json"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? 'تحميل الـ Log' : 'Download Log'}</span>
          </a>

          <button
            onClick={() => onNavigate('diagnostics')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <span>{isAr ? 'عرض التفاصيل' : 'Inspect'}</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 3. Key Vehicle Vitals Quick Cards (RPM, Coolant, Battery, Odometer) */}
      <div className="zf-premium-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-blue-600" />
            <span>{isAr ? 'مؤشرات الأداء السريعة (CAN Bus)' : 'Quick Vehicle Indicators'}</span>
          </h2>
          <button
            onClick={() => onNavigate('vehicle')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>{isAr ? 'عرض الكل' : 'View all'}</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. RPM */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[11px] text-slate-400 block mb-0.5">
              {isAr ? 'دورات المحرك (RPM)' : 'Engine RPM'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-blue-600">
                {metrics?.engine.rpm !== null ? metrics?.engine.rpm : '---'}
              </span>
              <span className="text-[10px] text-slate-400">rpm</span>
            </div>
          </div>

          {/* 2. Coolant Temp */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[11px] text-slate-400 block mb-0.5">
              {isAr ? 'حرارة المحرك' : 'Coolant Temp'}
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-lg font-bold font-mono ${
                  (metrics?.engine.coolantTempC ?? 0) >= 105 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {metrics?.engine.coolantTempC !== null ? `${metrics?.engine.coolantTempC}°` : '---'}
              </span>
              <span className="text-[10px] text-slate-400">C</span>
            </div>
          </div>

          {/* 3. Battery Voltage & Alternator */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[11px] text-slate-400 block mb-0.5">
              {isAr ? 'جهد بطارية السيارة' : 'Vehicle Voltage'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-slate-900">
                {metrics?.electrical.vehicleVoltageV !== null ? `${metrics?.electrical.vehicleVoltageV}` : '---'}
              </span>
              <span className="text-[10px] text-slate-400">V</span>
            </div>
            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium truncate">
              {metrics && metrics.electrical.vehicleVoltageV !== null
                ? isAr
                  ? metrics.electrical.alternatorStatusAr
                  : metrics.electrical.alternatorStatusEn
                : isAr
                ? 'ID 66 غير مفعل'
                : 'ID 66 disabled'}
            </span>
          </div>

          {/* 4. Total Odometer */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[11px] text-slate-400 block mb-0.5">
              {isAr ? 'عداد المسافات الكلي' : 'Total Odometer'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-slate-900">
                {metrics?.odometer.totalKm !== null ? metrics?.odometer.totalKm.toLocaleString() : '---'}
              </span>
              <span className="text-[10px] text-slate-400">km</span>
            </div>
          </div>

          {/* 5. Fuel Tank */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[11px] text-slate-400 block mb-0.5">
              {isAr ? 'مستوى الوقود' : 'Fuel Tank'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono text-slate-900">
                {metrics && metrics.fuel.levelPercent !== null ? `${metrics.fuel.levelPercent}%` : '---'}
              </span>
            </div>
            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">
              {metrics && metrics.fuel.levelLiters !== null ? `${metrics.fuel.levelLiters} L` : 'CAN M-Bus'}
            </span>
          </div>

          {/* 6. Diagnostics & DTCs */}
          <div
            onClick={() => onNavigate('vehicle')}
            className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
              (metrics?.diagnostic.dtcCount ?? 0) > 0 || (metrics?.diagnostic.milActive ?? false)
                ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
            }`}
            title={isAr ? 'فتح تفاصيل فحص كمبيوتر السيارة والأعطال' : 'Open Vehicle Diagnostics'}
          >
            <span className="text-[11px] opacity-70 block mb-0.5">
              {isAr ? 'كمبيوتر السيارة (DTC)' : 'Diagnostics (DTC)'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {(metrics?.diagnostic.dtcCount ?? 0) > 0 || (metrics?.diagnostic.milActive ?? false) ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-bold text-xs truncate">
                    {(metrics?.diagnostic.dtcCount ?? 0) > 0
                      ? `${metrics?.diagnostic.dtcCount} ${isAr ? 'كود عطل!' : 'Faults'}`
                      : isAr
                      ? 'لمبة عطل!'
                      : 'MIL Active!'}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-xs text-emerald-800">
                    {isAr ? 'سليم (No DTC)' : 'Normal'}
                  </span>
                </>
              )}
            </div>
            <span className="text-[9px] opacity-60 block mt-0.5 truncate">
              {metrics?.diagnostic.dtcCodes.length
                ? metrics.diagnostic.dtcCodes.map((c) => c.code).join(', ')
                : isAr
                ? 'لا توجد أعطال'
                : 'No codes'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
