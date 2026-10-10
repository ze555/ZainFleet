import React from 'react';
import { DeviceInfo, TelemetrySnapshot } from '../types/fleet.js';
import { decodeCanMetrics, generateVehicleAlerts } from '../utils/canBusDecoder.js';
import {
  Gauge,
  Fuel,
  Thermometer,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Car,
  Signal,
  CheckCircle2,
  XCircle,
  RotateCw,
  Compass,
  Milestone,
  Radio,
  DoorClosed,
  DoorOpen
} from 'lucide-react';

interface CanDashboardProps {
  device: DeviceInfo;
  telemetry: TelemetrySnapshot | null;
  isLoading: boolean;
  onRefresh: () => void;
  lang: 'ar' | 'en';
}

export const CanDashboard: React.FC<CanDashboardProps> = ({
  device,
  telemetry,
  isLoading,
  onRefresh,
  lang,
}) => {
  const isAr = lang === 'ar';
  const record = telemetry?.record;
  const metrics = record ? decodeCanMetrics(record) : null;

  if (!record || !metrics) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-xs space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
          <Car className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">
          {isAr ? `جهاز المركبة ${device.imei}` : `Vehicle ${device.imei}`}
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {isAr
            ? 'الجهاز مسجل بالخادم ولكن لم تصل حزم بيانات بعد. قم بتشغيل السيارة وتحريكها لبدء استقبال قراءات الـ CAN المباشرة.'
            : 'Device is registered. Turn on vehicle ignition to stream live CAN bus parameters.'}
        </p>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          <RotateCw className="w-4 h-4" />
          <span>{isAr ? 'تحديث' : 'Refresh'}</span>
        </button>
      </div>
    );
  }

  const alerts = generateVehicleAlerts(metrics);

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm transition-colors ${
                metrics.ignition.isOn
                  ? 'bg-emerald-600'
                  : device.connected
                  ? 'bg-blue-600'
                  : 'bg-slate-400'
              }`}
            >
              <Car className="w-8 h-8" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {isAr ? 'جهاز تتبع السيارة (FMB140 CAN)' : 'Vehicle Tracker (FMB140 CAN)'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    device.connected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {device.connected ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  {device.connected
                    ? isAr
                      ? 'متصل بالخادم الآن'
                      : 'TCP Active'
                    : isAr
                    ? 'غير متصل حالياً'
                    : 'Disconnected'}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mt-0.5">
                <h1 className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                  {device.imei}
                </h1>
                {metrics.ignition.isOn ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {isAr ? 'المحرك شغال (Ignition ON)' : 'Engine Running'}
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    {isAr ? 'المحرك متوقف (Ignition OFF)' : 'Engine Stopped'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title={isAr ? 'تحديث البيانات' : 'Refresh Telemetry'}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isAr ? 'تحديث' : 'Refresh'}</span>
            </button>

            <div className="text-right text-xs text-slate-500">
              <span className="block font-medium text-slate-400">
                {isAr ? 'آخر قراءة مسجلة' : 'Last Received'}
              </span>
              <span className="font-semibold text-slate-700">
                {new Date(record.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Connection Details Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block">{isAr ? 'حالة الحركة' : 'Motion State'}</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  metrics.isMoving.state ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              {metrics.isMoving.state
                ? isAr
                  ? 'المركبة تسير'
                  : 'In Motion'
                : isAr
                ? 'متوقفة'
                : 'Stationary'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block">{isAr ? 'شبكة الجوال' : 'Cellular Signal'}</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
              <Signal className="w-3.5 h-3.5 text-blue-600" />
              {metrics.cellular.signalBars !== null ? `${metrics.cellular.signalBars}/5 bars` : 'Connected'}
              {metrics.cellular.operatorCode ? ` (${metrics.cellular.operatorCode})` : ''}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block">{isAr ? 'أقمار الـ GPS' : 'GNSS Satellites'}</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
              <Radio className="w-3.5 h-3.5 text-amber-600" />
              {`${metrics.gnss.satellites} Satellites`}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block">{isAr ? 'بيانات الكان المفكوكة' : 'CAN Elements'}</span>
            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5 font-mono">
              {`${metrics.rawIoCount} Parameters`}
            </span>
          </div>
        </div>
      </div>

      {/* Alerts Notification Banner (if any active alerts) */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border flex items-start gap-3 shadow-2xs ${
                alert.type === 'danger'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  alert.type === 'danger' ? 'text-rose-600' : 'text-amber-600'
                }`}
              />
              <div className="flex-1">
                <h2 className="text-sm font-bold">
                  {isAr ? alert.titleAr : alert.titleEn}
                </h2>
                <p className="text-xs mt-0.5 text-slate-700">
                  {isAr ? alert.messageAr : alert.messageEn}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4 Main Driver Vital Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Fuel Level (مستوى الوقود) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isAr ? 'مستوى الوقود' : 'Fuel Tank'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Fuel className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold font-mono text-slate-900">
              {metrics.fuel.levelPercent !== null ? `${metrics.fuel.levelPercent}%` : '---'}
            </span>
            {metrics.fuel.levelLiters !== null && (
              <span className="text-xs text-slate-500 font-medium">
                ({metrics.fuel.levelLiters} L)
              </span>
            )}
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (metrics.fuel.levelPercent ?? 50) <= 15
                  ? 'bg-rose-500'
                  : (metrics.fuel.levelPercent ?? 50) <= 30
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, metrics.fuel.levelPercent ?? 0)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100">
            <span>{isAr ? 'الوقود المستهلك الكلي:' : 'Total Fuel Used:'}</span>
            <span className="font-semibold font-mono text-slate-700">
              {metrics.fuel.totalConsumedLiters ? `${metrics.fuel.totalConsumedLiters} L` : 'CAN M-Bus'}
            </span>
          </div>
        </div>

        {/* 2. Total Odometer (العداد الكلي للسيارة) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isAr ? 'عداد المسافات الكلي' : 'Total Odometer'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Milestone className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold font-mono text-slate-900">
              {metrics.odometer.totalKm !== null ? metrics.odometer.totalKm.toLocaleString() : '---'}
            </span>
            <span className="text-xs font-semibold text-slate-500">km</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-5 pt-2 border-t border-slate-100">
            <span>{isAr ? 'مسافة الرحلة الحالية:' : 'Current Trip Dist:'}</span>
            <span className="font-semibold font-mono text-slate-700">
              {metrics.odometer.tripKm !== null ? `${metrics.odometer.tripKm} km` : '---'}
            </span>
          </div>
        </div>

        {/* 3. Coolant Temperature (حرارة المحرك) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isAr ? 'حرارة المحرك' : 'Coolant Temp'}
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                (metrics.engine.coolantTempC ?? 0) >= 105
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              <Thermometer className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-3xl font-extrabold font-mono ${
                (metrics.engine.coolantTempC ?? 0) >= 105 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {metrics.engine.coolantTempC !== null ? `${metrics.engine.coolantTempC}°` : '---'}
            </span>
            <span className="text-xs font-semibold text-slate-500">C</span>
            {metrics.engine.coolantTempC !== null && (
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded-sm ml-auto ${
                  metrics.engine.coolantTempC >= 105
                    ? 'bg-rose-100 text-rose-800'
                    : metrics.engine.coolantTempC >= 95
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {metrics.engine.coolantTempC >= 105
                  ? isAr
                    ? 'مرتفعة!'
                    : 'Hot'
                  : isAr
                  ? 'طبيعية'
                  : 'Normal'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-5 pt-2 border-t border-slate-100">
            <span>{isAr ? 'حرارة زيت المحرك:' : 'Engine Oil Temp:'}</span>
            <span className="font-semibold font-mono text-slate-700">
              {metrics.engine.oilTempC !== null ? `${metrics.engine.oilTempC}°C` : 'N/A'}
            </span>
          </div>
        </div>

        {/* 4. Vehicle Battery & Alternator (بطارية السيارة والكهرباء) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isAr ? 'كهرباء وبطارية السيارة' : 'Battery & Alternator'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold font-mono text-slate-900">
              {metrics.electrical.vehicleVoltageV !== null ? `${metrics.electrical.vehicleVoltageV}` : '---'}
            </span>
            <span className="text-xs font-semibold text-slate-500">V</span>
            {metrics.electrical.vehicleVoltageV !== null && (
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded-sm ml-auto ${
                  metrics.electrical.alternatorStatus === 'charging'
                    ? 'bg-emerald-100 text-emerald-800'
                    : metrics.electrical.vehicleVoltageV >= 12.0
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {metrics.electrical.alternatorStatus === 'charging'
                  ? isAr
                    ? 'الدينامو يشحن'
                    : 'Charging'
                  : isAr
                  ? 'على البطارية'
                  : 'On Battery'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-5 pt-2 border-t border-slate-100">
            <span>{isAr ? 'بطارية الجهاز الداخلية:' : 'Internal Tracker Bat:'}</span>
            <span className="font-semibold font-mono text-slate-700">
              {metrics.electrical.trackerBatteryV ? `${metrics.electrical.trackerBatteryV}V` : '---'}
            </span>
          </div>
        </div>
      </div>

      {/* Engine & Performance Panel (M-CAN) and Comfort & Security Panel (C-CAN) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engine Dynamics (M-CAN) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Gauge className="w-5 h-5 text-blue-600" />
            <span>{isAr ? 'أداء المحرك والسرعة (M-CAN Bus)' : 'Engine & Speed Dynamics (M-CAN)'}</span>
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Speed Gauge Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-500 block mb-1">
                {isAr ? 'سرعة السيارة الحالية' : 'Current Speed'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold font-mono text-slate-900">
                  {metrics.speed.displaySpeedKmH}
                </span>
                <span className="text-xs text-slate-500 font-medium">km/h</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                {isAr ? 'سرعة الـ CAN:' : 'CAN Wheel Speed:'}{' '}
                <span className="font-semibold text-slate-700">
                  {metrics.speed.canKmH !== null ? `${metrics.speed.canKmH} km/h` : 'Synced with GPS'}
                </span>
              </div>
            </div>

            {/* Engine RPM Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-500 block mb-1">
                {isAr ? 'دورات المحرك (RPM)' : 'Engine Speed (RPM)'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold font-mono text-blue-600">
                  {metrics.engine.rpm !== null ? metrics.engine.rpm : '---'}
                </span>
                <span className="text-xs text-slate-500 font-medium">rpm</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                {isAr ? 'حالة التشغيل:' : 'Running State:'}{' '}
                <span className="font-semibold text-slate-700">
                  {(metrics.engine.rpm ?? 0) > 0 ? (isAr ? 'دوران نشط' : 'Active') : (isAr ? 'المحرك ساكن' : 'Idle / Off')}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">
                {isAr ? 'ساعات عمل المحرك الكلية' : 'Total Engine Hours'}
              </span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {metrics.engine.workHours !== null ? `${metrics.engine.workHours} Hours` : 'CAN M-Bus'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">
                {isAr ? 'معدل استهلاك الوقود اللحظي' : 'Instant Fuel Flow'}
              </span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5 text-slate-400" />
                {metrics.fuel.instantRateLitersPerHour !== null ? `${metrics.fuel.instantRateLitersPerHour} L/h` : 'Direct CAN'}
              </span>
            </div>
          </div>
        </div>

        {/* Comfort, Doors & Security (C-CAN) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>{isAr ? 'أمان وأبواب السيارة (C-CAN Comfort)' : 'Comfort & Vehicle Security (C-CAN)'}</span>
          </h2>

          {/* Doors Visual Grid */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 mb-4">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                {metrics.comfort.doors?.anyOpen ? (
                  <DoorOpen className="w-4 h-4 text-rose-600" />
                ) : (
                  <DoorClosed className="w-4 h-4 text-emerald-600" />
                )}
                {isAr ? 'مستشعرات الأبواب والصندوق' : 'Doors & Latch Monitoring'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  metrics.comfort.doors?.anyOpen
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {metrics.comfort.doors?.anyOpen
                  ? isAr
                    ? 'تنبيه: باب مفتوح!'
                    : 'Door Open!'
                  : isAr
                  ? 'جميع الأبواب مغلقة'
                  : 'All Closed'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div
                className={`p-2 rounded-lg border transition-colors ${
                  metrics.comfort.doors?.driverOpen
                    ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-400">
                  {isAr ? 'باب السائق' : 'Driver Door'}
                </span>
                <span>{metrics.comfort.doors?.driverOpen ? (isAr ? 'مفتوح' : 'Open') : (isAr ? 'مغلق' : 'Closed')}</span>
              </div>

              <div
                className={`p-2 rounded-lg border transition-colors ${
                  metrics.comfort.doors?.passengerOpen
                    ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-400">
                  {isAr ? 'باب الراكب' : 'Passenger'}
                </span>
                <span>{metrics.comfort.doors?.passengerOpen ? (isAr ? 'مفتوح' : 'Open') : (isAr ? 'مغلق' : 'Closed')}</span>
              </div>

              <div
                className={`p-2 rounded-lg border transition-colors ${
                  metrics.comfort.doors?.hoodOpen
                    ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-400">
                  {isAr ? 'الكبوت' : 'Hood'}
                </span>
                <span>{metrics.comfort.doors?.hoodOpen ? (isAr ? 'مفتوح' : 'Open') : (isAr ? 'مغلق' : 'Closed')}</span>
              </div>

              <div
                className={`p-2 rounded-lg border transition-colors ${
                  metrics.comfort.doors?.rearLeftOpen
                    ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-400">
                  {isAr ? 'خلفي يسار' : 'Rear Left'}
                </span>
                <span>{metrics.comfort.doors?.rearLeftOpen ? (isAr ? 'مفتوح' : 'Open') : (isAr ? 'مغلق' : 'Closed')}</span>
              </div>

              <div
                className={`p-2 rounded-lg border transition-colors ${
                  metrics.comfort.doors?.rearRightOpen
                    ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-400">
                  {isAr ? 'خلفي يمين' : 'Rear Right'}
                </span>
                <span>{metrics.comfort.doors?.rearRightOpen ? (isAr ? 'مفتوح' : 'Open') : (isAr ? 'مغلق' : 'Closed')}</span>
              </div>

              <div
                className={`p-2 rounded-lg border transition-colors ${
                  metrics.comfort.doors?.trunkOpen
                    ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-400">
                  {isAr ? 'الشنطة' : 'Trunk'}
                </span>
                <span>{metrics.comfort.doors?.trunkOpen ? (isAr ? 'مفتوح' : 'Open') : (isAr ? 'مغلق' : 'Closed')}</span>
              </div>
            </div>
          </div>

          {/* Safety Checklist */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-slate-400 block mb-0.5">{isAr ? 'حزام الأمان' : 'Seatbelt'}</span>
              <span className="font-bold text-slate-800">
                {metrics.comfort.seatbeltFastened !== null
                  ? metrics.comfort.seatbeltFastened
                    ? isAr
                      ? 'مربوط ✓'
                      : 'Fastened'
                    : isAr
                    ? 'غير مربوط'
                    : 'Unfastened'
                  : 'CAN C-Bus'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-slate-400 block mb-0.5">{isAr ? 'فرامل اليد (الجلنط)' : 'Handbrake'}</span>
              <span className="font-bold text-slate-800">
                {metrics.comfort.handbrakeEngaged !== null
                  ? metrics.comfort.handbrakeEngaged
                    ? isAr
                      ? 'مشدود (مفعل)'
                      : 'Engaged'
                    : isAr
                    ? 'محرر (حر)'
                    : 'Released'
                  : 'CAN C-Bus'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-slate-400 block mb-0.5">{isAr ? 'لمبة المحرك' : 'Check Engine'}</span>
              <span
                className={`font-bold ${
                  metrics.comfort.checkEngineLight ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {metrics.comfort.checkEngineLight ? (isAr ? 'تنبيه عطل!' : 'Active MIL') : (isAr ? 'سليم ✓' : 'Clear')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* GPS Coordinate & Navigation Footer */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-400 block">{isAr ? 'الموقع الجغرافي الدقيق' : 'Exact GPS Position'}</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {record.latitude.toFixed(6)}°, {record.longitude.toFixed(6)}°
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-slate-600 font-medium">
          <div>
            <span className="text-slate-400 block">{isAr ? 'الارتفاع' : 'Altitude'}</span>
            <span className="font-mono font-bold text-slate-800">{record.altitude} m</span>
          </div>
          <div>
            <span className="text-slate-400 block">{isAr ? 'زاوية الاتجاه' : 'Heading Angle'}</span>
            <span className="font-mono font-bold text-slate-800">{record.angle}°</span>
          </div>
          <div>
            <span className="text-slate-400 block">{isAr ? 'وقت الإرسال' : 'GPS Fix Time'}</span>
            <span className="font-semibold text-slate-800">
              {new Date(record.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
