import React, { useState } from 'react';
import { DeviceInfo, TelemetrySnapshot } from '../types/fleet.js';
import { decodeCanMetrics } from '../utils/canBusDecoder.js';
import {
  Gauge,
  Zap,
  ShieldCheck,
  DoorClosed,
  DoorOpen,
  Compass,
  RotateCw,
  Car,
  Layers,
  Cpu,
} from 'lucide-react';
import { formatCoordinates } from '../utils/geoUtils.js';

interface VehicleDataViewProps {
  device: DeviceInfo;
  telemetry: TelemetrySnapshot | null;
  isLoading: boolean;
  onRefresh: () => void;
  lang: 'ar' | 'en';
}

export const VehicleDataView: React.FC<VehicleDataViewProps> = ({
  device,
  telemetry,
  isLoading,
  onRefresh,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [subTab, setSubTab] = useState<'can' | 'gps' | 'device'>('can');

  const record = telemetry?.record;
  const metrics = record ? decodeCanMetrics(record) : null;

  if (!record || !metrics) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-xs space-y-3 max-w-4xl mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
          <Car className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800">
          {isAr ? 'في انتظار قراءات الحساسات المباشرة' : 'Waiting for Live Telemetry'}
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {isAr
            ? 'قم بتشغيل سويتش السيارة لنقل قراءات الـ CAN المباشرة إلى الخادم.'
            : 'Turn on vehicle ignition to stream live telemetry.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* Title & Sub-tabs Header matching Mockup */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {isAr ? 'بيانات وقراءات السيارة' : 'Vehicle Telemetry Data'}
            </h2>
            <p className="text-xs text-slate-500">
              {isAr
                ? 'قراءات ناقل الكان (M-CAN / C-CAN) وأجهزة القياس الميدانية'
                : 'CAN bus readings and hardware diagnostics'}
            </p>
          </div>
        </div>

        {/* 3 Sub-Tabs matching Screen 5 in Mockup: [CAN Bus | GPS | الجهاز] */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setSubTab('can')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                subTab === 'can'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              CAN Bus
            </button>
            <button
              onClick={() => setSubTab('gps')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                subTab === 'gps'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              GPS
            </button>
            <button
              onClick={() => setSubTab('device')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                subTab === 'device'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              {isAr ? 'الجهاز' : 'Device'}
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title={isAr ? 'تحديث' : 'Refresh'}
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* SubTab 1: CAN Bus */}
      {subTab === 'can' && (
        <div className="space-y-4">
          {/* Card 1: معلومات المحرك (Engine Core Metrics) matching mockup */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Gauge className="w-4 h-4 text-blue-600" />
              <span>{isAr ? 'معلومات المحرك ونظام الحركة (M-CAN)' : 'Engine Dynamics (M-CAN)'}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* 1. RPM */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  RPM
                </span>
                <span className="text-xl font-extrabold font-mono text-blue-600 block">
                  {metrics.engine.rpm !== null ? metrics.engine.rpm : '---'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {isAr ? 'دورة/دقيقة' : 'rpm'}
                </span>
              </div>

              {/* 2. Coolant Temperature */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'حرارة المحرك' : 'Coolant Temp'}
                </span>
                <span
                  className={`text-xl font-extrabold font-mono block ${
                    (metrics.engine.coolantTempC ?? 0) >= 105 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {metrics.engine.coolantTempC !== null ? `${metrics.engine.coolantTempC}°` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">°C</span>
              </div>

              {/* 3. Fuel Level */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'درجة الوقود' : 'Fuel Tank'}
                </span>
                <span className="text-xl font-extrabold font-mono text-slate-900 block">
                  {metrics.fuel.levelPercent !== null ? `${metrics.fuel.levelPercent}%` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {metrics.fuel.levelLiters !== null ? `${metrics.fuel.levelLiters} L` : 'CAN M-Bus'}
                </span>
              </div>

              {/* 4. Battery Voltage */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'جهد البطارية' : 'Vehicle Voltage'}
                </span>
                <span className="text-xl font-extrabold font-mono text-slate-900 block">
                  {metrics.electrical.vehicleVoltageV !== null ? `${metrics.electrical.vehicleVoltageV}V` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {metrics.electrical.alternatorStatus === 'charging'
                    ? isAr
                      ? 'يشحن'
                      : 'Charging'
                    : isAr
                    ? 'على البطارية'
                    : 'Battery'}
                </span>
              </div>

              {/* 5. Total Odometer */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center col-span-2 sm:col-span-1">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'عداد المسافات' : 'Odometer'}
                </span>
                <span className="text-xl font-extrabold font-mono text-slate-900 block">
                  {metrics.odometer.totalKm !== null ? metrics.odometer.totalKm.toLocaleString() : '---'}
                </span>
                <span className="text-[10px] text-slate-400">km</span>
              </div>
            </div>
          </div>

          {/* Card 2: بيانات أخرى (Secondary CAN Measurements) matching mockup */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>{isAr ? 'بيانات أخرى وسوائل المحرك' : 'Other Engine & Comfort Telemetry'}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'حرارة الزيت' : 'Oil Temp'}
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 block">
                  {metrics.engine.oilTempC !== null ? `${metrics.engine.oilTempC}°C` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">CAN 0x22</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'حمل المحرك' : 'Engine Load'}
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 block">
                  {metrics.engine.loadPercent !== null ? `${metrics.engine.loadPercent}%` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">OBD PID 04</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'ساعات العمل' : 'Work Hours'}
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 block">
                  {metrics.engine.workHours !== null ? `${metrics.engine.workHours} h` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">Total Run Time</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'تدفق الوقود' : 'Fuel Flow'}
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 block">
                  {metrics.fuel.instantRateLitersPerHour !== null ? `${metrics.fuel.instantRateLitersPerHour} L/h` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">Instant Flow</span>
              </div>
            </div>

            {/* Comfort & Safety (C-CAN) Checklist */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                {metrics.comfort.doors?.anyOpen ? (
                  <DoorOpen className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <DoorClosed className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div>
                  <span className="text-[10px] text-slate-400 block">{isAr ? 'الأبواب' : 'Doors'}</span>
                  <span className="font-bold text-slate-800">
                    {metrics.comfort.doors?.anyOpen ? (isAr ? 'مفتوح!' : 'Open!') : (isAr ? 'مغلقة' : 'Closed')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">{isAr ? 'حزام الأمان' : 'Seatbelt'}</span>
                  <span className="font-bold text-slate-800">
                    {metrics.comfort.seatbeltFastened !== null
                      ? metrics.comfort.seatbeltFastened
                        ? isAr
                          ? 'مربوط'
                          : 'Fastened'
                        : isAr
                        ? 'غير مربوط'
                        : 'Unfastened'
                      : 'CAN C-Bus'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                <Car className="w-4 h-4 text-slate-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">{isAr ? 'فرامل اليد' : 'Handbrake'}</span>
                  <span className="font-bold text-slate-800">
                    {metrics.comfort.handbrakeEngaged !== null
                      ? metrics.comfort.handbrakeEngaged
                        ? isAr
                          ? 'مشدود'
                          : 'Engaged'
                        : isAr
                        ? 'محرر'
                        : 'Released'
                      : 'CAN C-Bus'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block">{isAr ? 'لمبة العطل' : 'MIL Check'}</span>
                  <span
                    className={`font-bold ${
                      metrics.comfort.checkEngineLight ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {metrics.comfort.checkEngineLight ? (isAr ? 'تنبيه كود عطل!' : 'Active DTC') : (isAr ? 'سليم' : 'Normal')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 2: GPS & Navigation */}
      {subTab === 'gps' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-600" />
            <span>{isAr ? 'قراءات الملاحة والأقمار الصناعية (GNSS)' : 'GNSS Positioning'}</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'الإحداثيات' : 'Coordinates'}</span>
              <span className="font-mono font-bold text-sm text-slate-900 block mt-1">
                {formatCoordinates(record.latitude, record.longitude)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'السرعة الجغرافية' : 'GPS Speed'}</span>
              <span className="font-mono font-bold text-lg text-slate-900 block mt-1">
                {record.speed} km/h
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'الأقمار النشطة' : 'Satellites'}</span>
              <span className="font-mono font-bold text-lg text-amber-600 block mt-1">
                {record.satellites}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'الارتفاع عن البحر' : 'Altitude'}</span>
              <span className="font-mono font-bold text-lg text-slate-900 block mt-1">
                {record.altitude} m
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'زاوية الاتجاه' : 'Heading'}</span>
              <span className="font-mono font-bold text-lg text-slate-900 block mt-1">
                {record.angle}°
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'صحة الإشارة' : 'Fix Status'}</span>
              <span className="font-bold text-sm text-emerald-700 block mt-1">
                {record.satellites >= 4 ? (isAr ? 'دقة ثلاثية الأبعاد 3D' : '3D High Fix') : (isAr ? 'دقة مقبولة' : '2D Fix')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 3: Device Diagnostics */}
      {subTab === 'device' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-600" />
            <span>{isAr ? 'معلومات جهاز التتبع (Teltonika FMB140)' : 'Hardware Tracker Info'}</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'الرقم التسلسلي (IMEI)' : 'Device IMEI'}</span>
              <span className="font-mono font-bold text-xs text-slate-900 block mt-1">
                {device.imei}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'بطارية الجهاز الداخلية' : 'Internal Backup Bat'}</span>
              <span className="font-mono font-bold text-lg text-slate-900 block mt-1">
                {metrics.electrical.trackerBatteryV ? `${metrics.electrical.trackerBatteryV}V` : '---'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'إشارة شبكة GSM' : 'Cellular Signal'}</span>
              <span className="font-mono font-bold text-lg text-blue-600 block mt-1">
                {metrics.cellular.signalBars !== null ? `${metrics.cellular.signalBars}/5` : 'Connected'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'إجمالي السجلات' : 'Total Records'}</span>
              <span className="font-mono font-bold text-lg text-slate-900 block mt-1">
                {device.totalRecords || 0}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'المسافة التراكمية' : 'Accumulated Dist'}</span>
              <span className="font-mono font-bold text-lg text-slate-900 block mt-1">
                {(device.totalDistanceKm || 0).toFixed(1)} km
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">{isAr ? 'حالة المقبس' : 'TCP Socket'}</span>
              <span
                className={`font-bold text-sm block mt-1 ${
                  device.tcpConnected ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {device.tcpConnected ? (isAr ? 'متصل بنشاط' : 'Connected') : (isAr ? 'غير متصل' : 'Closed')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
