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
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* 1. Main Vehicle Card (بطاقة المركبة الرئيسية) matching Screen 1 in Mockup */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Vehicle Avatar / Illustration */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-slate-100 border border-slate-200/80 flex items-center justify-center text-blue-600 shadow-xs shrink-0 relative overflow-hidden">
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

              <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">
                FMB140 CAN &bull; IMEI: {device.imei}
              </p>

              <div className="flex items-center gap-2 text-xs text-slate-400 mt-2 font-mono">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isAr ? 'آخر تحديث:' : 'Last update:'}{' '}
                  {measurementDate
                    ? `${measurementDate.toLocaleDateString(
                        isAr ? 'ar-EG' : 'en-US'
                      )} ${measurementDate.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : '---'}
                </span>
                {isStale && (
                  <span className="text-[10px] text-amber-600 font-sans font-bold bg-amber-50 px-1.5 py-0.2 rounded-sm border border-amber-200">
                    {isAr ? 'قراءة متوقفة' : 'Stale'}
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
              ref={miniMapRef}
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
            <span className="absolute top-3 left-3 sm:top-4 sm:left-4 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold shadow-xs">
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

      {/* 3. Key Vehicle Vitals Quick Cards (RPM, Coolant, Battery, Odometer) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* RPM */}
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

          {/* Coolant Temp */}
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

          {/* Battery Voltage */}
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
          </div>

          {/* Total Odometer */}
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
        </div>
      </div>
    </div>
  );
};
