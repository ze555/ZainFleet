import React, { useState } from 'react';
import { TelemetrySnapshot } from '../types/fleet.js';
import { decodeCanMetrics } from '../utils/canBusDecoder.js';
import {
  Gauge,
  Zap,
  DoorClosed,
  DoorOpen,
  RotateCw,
  Car,
  Layers,
  Fuel,
  ShieldAlert,
  CheckCircle2,
  FileText,
  Info,
  Download,
  AlertTriangle,
} from 'lucide-react';

interface VehicleDataViewProps {
  telemetry: TelemetrySnapshot | null;
  isLoading: boolean;
  onRefresh: () => void;
  lang: 'ar' | 'en';
}

export const VehicleDataView: React.FC<VehicleDataViewProps> = ({
  telemetry,
  isLoading,
  onRefresh,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [subTab, setSubTab] = useState<'can' | 'dtc'>('can');
  const [showRawDtcDebug, setShowRawDtcDebug] = useState(false);

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

  const dtcCount = metrics.diagnostic.dtcCount;
  const hasDtcFaults = dtcCount > 0 || metrics.diagnostic.milActive;
  const hasDtcData = metrics.diagnostic.dtcDataReported;

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* Title & Sub-tabs Header */}
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
                ? 'قراءات ناقل الكان (M-CAN / C-CAN) وفحص كمبيوتر السيارة OBD'
                : 'CAN bus readings and vehicle OBD-II diagnostics'}
            </p>
          </div>
        </div>

        {/* Sub-Tabs: [CAN Bus | تشخيص الأعطال DTC | GPS | الجهاز] */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 overflow-x-auto">
            <button
              onClick={() => setSubTab('can')}
              className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                subTab === 'can'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              {isAr ? 'بيانات السيارة' : 'Vitals & CAN'}
            </button>
            <button
              onClick={() => setSubTab('dtc')}
              className={`relative px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                subTab === 'dtc'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              <span>{isAr ? 'الأعطال (DTC)' : 'Diagnostics (DTC)'}</span>
              {hasDtcFaults && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0"
            title={isAr ? 'تحديث' : 'Refresh'}
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* SUBTAB 1: CAN Bus & Owner-Friendly Vitals */}
      {subTab === 'can' && (
        <div className="space-y-4">
          {/* Section 1: المحرك ونظام الحركة (Engine & Transmission) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Gauge className="w-4 h-4 text-blue-600" />
              <span>{isAr ? '1. المحرك ونظام الحركة (M-CAN / Powertrain)' : '1. Engine & Powertrain (M-CAN)'}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* RPM */}
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

              {/* Coolant Temperature */}
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

              {/* Engine Load */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'حمل المحرك' : 'Engine Load'}
                </span>
                <span className="text-xl font-extrabold font-mono text-slate-900 block">
                  {metrics.engine.loadPercent !== null ? `${metrics.engine.loadPercent}%` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">OBD PID 04</span>
              </div>

              {/* Oil Temperature */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'حرارة الزيت' : 'Oil Temp'}
                </span>
                <span className="text-xl font-extrabold font-mono text-slate-900 block">
                  {metrics.engine.oilTempC !== null ? `${metrics.engine.oilTempC}°` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">°C</span>
              </div>

              {/* Work Hours */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center col-span-2 sm:col-span-1">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'ساعات التشغيل' : 'Work Hours'}
                </span>
                <span className="text-xl font-extrabold font-mono text-slate-900 block">
                  {metrics.engine.workHours !== null ? `${metrics.engine.workHours} h` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">Total Run Time</span>
              </div>
            </div>
          </div>

          {/* Section 2: خزان الوقود وكفاءة الاستهلاك (Fuel & Efficiency) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Fuel className="w-4 h-4 text-emerald-600" />
              <span>{isAr ? '2. الوقود واستهلاك الطاقة (Fuel & Efficiency)' : '2. Fuel & Consumption (CAN)'}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Fuel Level % */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'مستوى الخزان' : 'Fuel Level %'}
                </span>
                <span className="text-2xl font-extrabold font-mono text-slate-900 block">
                  {metrics.fuel.levelPercent !== null ? `${metrics.fuel.levelPercent}%` : '---'}
                </span>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${metrics.fuel.levelPercent || 0}%` }}
                  />
                </div>
              </div>

              {/* Fuel Level Liters */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'الوقود المتبقي' : 'Fuel Remaining'}
                </span>
                <span className="text-2xl font-extrabold font-mono text-slate-900 block">
                  {metrics.fuel.levelLiters !== null ? `${metrics.fuel.levelLiters} L` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">CAN 0x54</span>
              </div>

              {/* Instant Fuel Rate */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'التدفق اللحظي' : 'Instant Flow'}
                </span>
                <span className="text-2xl font-extrabold font-mono text-slate-900 block">
                  {metrics.fuel.instantRateLitersPerHour !== null ? `${metrics.fuel.instantRateLitersPerHour} L/h` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">Flow Rate</span>
              </div>

              {/* Total Fuel Consumed */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'إجمالي المستهلك' : 'Total Fuel Burned'}
                </span>
                <span className="text-2xl font-extrabold font-mono text-slate-900 block">
                  {metrics.fuel.totalConsumedLiters !== null ? `${metrics.fuel.totalConsumedLiters} L` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">Lifetime Fuel</span>
              </div>
            </div>
          </div>

          {/* Section 3: البطارية والمنظومة الكهربائية (Battery & Electrical) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>{isAr ? '3. البطارية والمنظومة الكهربائية (Battery & Electrical)' : '3. Battery & Electrical System'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'جهد بطارية السيارة الرئيسي' : 'Vehicle Main Battery'}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold font-mono text-slate-900">
                    {metrics.electrical.vehicleVoltageV !== null ? `${metrics.electrical.vehicleVoltageV}` : '---'}
                  </span>
                  <span className="text-xs text-slate-500">V</span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1 font-medium">
                  {isAr ? metrics.electrical.alternatorStatusAr : metrics.electrical.alternatorStatusEn}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'بطارية جهاز التتبع الاحتياطية' : 'Tracker Backup Battery'}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold font-mono text-slate-900">
                    {metrics.electrical.trackerBatteryV !== null ? `${metrics.electrical.trackerBatteryV}` : '---'}
                  </span>
                  <span className="text-xs text-slate-500">V</span>
                </div>
                <span className="text-[11px] text-emerald-600 block mt-1 font-medium">
                  {isAr ? 'بطارية ليثيوم داخلية سليمة' : 'Internal Li-Ion Nominal'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'حالة دينامو الشحن' : 'Alternator Status'}
                </span>
                <span
                  className={`text-base font-extrabold block mt-1 ${
                    metrics.electrical.alternatorStatus === 'charging'
                      ? 'text-emerald-700'
                      : metrics.electrical.alternatorStatus === 'low_voltage'
                      ? 'text-rose-600'
                      : 'text-slate-700'
                  }`}
                >
                  {metrics.electrical.alternatorStatus === 'charging'
                    ? isAr
                      ? 'يشحن بنشاط (13.5V - 14.5V)'
                      : 'Active Charging'
                    : metrics.electrical.alternatorStatus === 'battery_only'
                    ? isAr
                      ? 'على جهد البطارية (المحرك مطفأ)'
                      : 'Resting on Battery'
                    : isAr
                    ? 'جهد ضعيف'
                    : 'Low Voltage'}
                </span>
              </div>
            </div>

            {/* Diagnostic Alert if ID 66 is Missing */}
            {metrics.electrical.vehicleVoltageV === null && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {isAr
                        ? 'تنبيه تشخيصي: قراءة جهد بطارية السيارة الرئيسي (ID 66) غير مرسلة من جهاز FMB140!'
                        : 'Diagnostic Alert: Main Vehicle Battery Voltage (ID 66) is missing from packet stream!'}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {isAr
                      ? 'الجهاز يرسل فقط بطارية الليثيوم الداخلية (ID 67). لتفعيل قراءة بطارية السيارة 12V: في Teltonika Configurator، ادخل تبويب I/O وفعّل ID 66 (External Voltage) واضبط أولويته على Low أو High.'
                      : 'The device is transmitting internal Li-Ion battery (ID 67). To enable vehicle 12V voltage: In Teltonika Configurator I/O tab, enable ID 66 (External Voltage) with Priority Low/High.'}
                  </p>
                </div>

                <a
                  href="/api/diagnostics/download"
                  download="fmb140_packet_diagnostic.json"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تحميل الـ Log' : 'Download Log'}</span>
                </a>
              </div>
            )}
          </div>

          {/* Section 4: عداد المسافات والراحة (Odometer & Comfort / C-CAN) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-violet-600" />
              <span>{isAr ? '4. عداد المسافات والمقصورة (Odometer & Comfort C-CAN)' : '4. Odometer & Body Controls'}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'عداد المسافات الكلي' : 'Total Odometer'}
                </span>
                <span className="text-xl font-extrabold font-mono text-slate-900 block">
                  {metrics.odometer.totalKm !== null ? metrics.odometer.totalKm.toLocaleString() : '---'}
                </span>
                <span className="text-[10px] text-slate-400">km</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'عداد الرحلة' : 'Trip Distance'}
                </span>
                <span className="text-xl font-extrabold font-mono text-slate-900 block">
                  {metrics.odometer.tripKm !== null ? `${metrics.odometer.tripKm} km` : '---'}
                </span>
                <span className="text-[10px] text-slate-400">Eventual</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'حزام الأمان' : 'Seatbelt'}
                </span>
                <span
                  className={`text-base font-extrabold block mt-1 ${
                    metrics.comfort.seatbeltFastened ? 'text-emerald-700' : 'text-slate-700'
                  }`}
                >
                  {metrics.comfort.seatbeltFastened !== null
                    ? metrics.comfort.seatbeltFastened
                      ? isAr
                        ? 'مربوط'
                        : 'Fastened'
                      : isAr
                      ? 'غير مربوط'
                      : 'Unfastened'
                    : 'C-CAN'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  {isAr ? 'فرامل اليد (الجلنط)' : 'Handbrake'}
                </span>
                <span className="text-base font-extrabold block mt-1 text-slate-700">
                  {metrics.comfort.handbrakeEngaged !== null
                    ? metrics.comfort.handbrakeEngaged
                      ? isAr
                        ? 'مشدود'
                        : 'Engaged'
                      : isAr
                      ? 'محرر'
                      : 'Released'
                    : 'C-CAN'}
                </span>
              </div>
            </div>

            {/* 6 Doors / Latches Bitmask */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                {isAr ? 'حالة أبواب السيارة والشنطة والكبوت (C-CAN 0x64):' : 'Vehicle Doors & Latches:'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 flex items-center gap-1.5">
                  {metrics.comfort.doors?.driverOpen ? (
                    <DoorOpen className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <DoorClosed className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>{isAr ? 'باب السائق' : 'Driver'}</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 flex items-center gap-1.5">
                  {metrics.comfort.doors?.passengerOpen ? (
                    <DoorOpen className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <DoorClosed className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>{isAr ? 'باب الراكب' : 'Passenger'}</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 flex items-center gap-1.5">
                  {metrics.comfort.doors?.rearLeftOpen ? (
                    <DoorOpen className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <DoorClosed className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>{isAr ? 'خلفي يسار' : 'Rear L'}</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 flex items-center gap-1.5">
                  {metrics.comfort.doors?.rearRightOpen ? (
                    <DoorOpen className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <DoorClosed className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>{isAr ? 'خلفي يمين' : 'Rear R'}</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 flex items-center gap-1.5">
                  {metrics.comfort.doors?.hoodOpen ? (
                    <DoorOpen className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <DoorClosed className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>{isAr ? 'الكبوت' : 'Hood'}</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 flex items-center gap-1.5">
                  {metrics.comfort.doors?.trunkOpen ? (
                    <DoorOpen className="w-3.5 h-3.5 text-rose-600" />
                  ) : (
                    <DoorClosed className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>{isAr ? 'الشنطة' : 'Trunk'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: فحص كمبيوتر السيارة وأكواد الأعطال (Diagnostics & DTC) */}
      {subTab === 'dtc' && (
        <div className="space-y-4">
          {/* Header Card with Check Engine Lamp & Active DTC Count */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    hasDtcFaults
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : hasDtcData
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {hasDtcFaults ? (
                    <ShieldAlert className="w-6 h-6 animate-bounce" />
                  ) : hasDtcData ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <Info className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isAr ? 'فحص كمبيوتر السيارة وأكواد الأعطال (OBD / DTC)' : 'Vehicle Computer Diagnostics & DTCs'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isAr ? metrics.diagnostic.statusAr : metrics.diagnostic.statusEn}
                  </p>
                </div>
              </div>

              {/* Actions & MIL Lamp Status Badge */}
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/api/diagnostics/download"
                  download="fmb140_packet_diagnostic.json"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تحميل سجل التشخيص' : 'Download Diagnostic Log'}</span>
                </a>

                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                    metrics.diagnostic.milActive
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : metrics.comfort.checkEngineLight === false
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-50 text-slate-600 border border-slate-200'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>
                    {isAr ? 'لمبة فحص المحرك (MIL):' : 'Check Engine Light:'}{' '}
                    {metrics.diagnostic.milActive
                      ? isAr
                        ? 'مضاءة (تنبيه عطل!)'
                        : 'Active / ON'
                      : metrics.comfort.checkEngineLight === false
                      ? isAr
                        ? 'مطفأة'
                        : 'OFF'
                      : isAr
                      ? 'لم تصل بيانات'
                      : 'Not reported'}
                  </span>
                </span>
              </div>
            </div>

            {/* VIN Banner if available */}
            {metrics.diagnostic.vin && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-slate-500">{isAr ? 'رقم الشاصي والهيكل (VIN):' : 'Vehicle VIN:'}</span>
                <span className="font-mono font-bold text-slate-900 tracking-wider">
                  {metrics.diagnostic.vin}
                </span>
              </div>
            )}
          </div>

          {/* List of Detected Trouble Codes OR All Clear Banner */}
          {metrics.diagnostic.dtcCodes.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {isAr ? 'أكواد الأعطال المرصودة في الـ ECU:' : 'Detected Trouble Codes (ECU):'}
                </h4>
                <span className="text-xs font-mono font-bold text-rose-600">
                  {metrics.diagnostic.dtcCodes.length} {isAr ? 'كود مسجل' : 'codes'}
                </span>
              </div>

              {metrics.diagnostic.dtcCodes.map((dtc) => (
                <div
                  key={dtc.code}
                  className="bg-white rounded-2xl border border-rose-200 p-4 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-mono font-black text-sm tracking-wide">
                        {dtc.code}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {isAr ? dtc.subsystemAr : dtc.subsystemEn}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                      {isAr ? 'درجة الخطورة: مهم' : 'Severity: High'}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-slate-900">
                    {isAr ? dtc.descriptionAr : dtc.descriptionEn}
                  </p>

                  <p className="text-xs text-slate-500">
                    {isAr
                      ? `معيار الكود: ${dtc.standard} &bull; مستخرج من ناقل الـ CAN عبر قراءة AVL ID 282.`
                      : `Standard: ${dtc.standard} &bull; Sourced from ECU memory via AVL ID 282.`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900">
                {dtcCount > 0
                  ? isAr
                    ? `تم الإبلاغ عن ${dtcCount} أعطال، لكن تفاصيل الأكواد غير متاحة`
                    : `${dtcCount} DTC(s) reported; code details are unavailable`
                  : hasDtcData
                  ? isAr
                    ? 'لم يتم الإبلاغ عن أكواد أعطال'
                    : 'No DTC codes reported'
                  : isAr
                  ? 'بيانات الأعطال غير متاحة بعد'
                  : 'DTC data has not been reported'}
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                {dtcCount > 0
                  ? isAr
                    ? 'تحقق من إعداد إرسال تفاصيل الأكواد في الجهاز لعرض رموز الأعطال.'
                    : 'Enable fault-code I/O reporting on the tracker to view the individual codes.'
                  : hasDtcData
                  ? isAr
                    ? 'أبلغ كمبيوتر السيارة عن عدم وجود أكواد أعطال نشطة.'
                    : 'The vehicle ECU reported no active fault codes.'
                  : isAr
                  ? 'فعّل إرسال عدد الأعطال وأكواد DTC في إعدادات جهاز Teltonika لعرض حالة السيارة هنا.'
                  : 'Enable DTC count and fault-code I/O reporting in the Teltonika device configuration to see ECU status here.'}
              </p>
            </div>
          )}

          {/* Raw Diagnostic Debug Toggle */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4">
            <button
              onClick={() => setShowRawDtcDebug(!showRawDtcDebug)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400" />
                <span>{isAr ? 'البيانات التشخيصية الخام للمهندسين (Raw Packet Debug)' : 'Raw Diagnostic Packet Data'}</span>
              </div>
              <span className="text-[11px] text-blue-600">
                {showRawDtcDebug ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'عرض' : 'Show')}
              </span>
            </button>

            {showRawDtcDebug && (
              <div className="mt-3 pt-3 border-t border-slate-200 text-xs font-mono space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">AVL ID 282 (Fault Codes):</span>
                  <span className="font-bold">{metrics.diagnostic.rawDtcString || 'None (0x00)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">AVL ID 160 / 30 (DTC Count):</span>
                  <span className="font-bold">{metrics.diagnostic.dtcCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">AVL ID 132 bit 3 (Check Engine MIL):</span>
                  <span className="font-bold">{metrics.diagnostic.milActive ? '1 (Active)' : '0 (Off)'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
