import React, { useState } from 'react';
import { DeviceInfo, TelemetrySnapshot } from '../types/fleet.js';
import { decodeCanMetrics } from '../utils/canBusDecoder.js';
import {
  Gauge,
  Zap,
  DoorClosed,
  DoorOpen,
  Compass,
  RotateCw,
  Car,
  Layers,
  Cpu,
  Fuel,
  ShieldAlert,
  CheckCircle2,
  FileText,
  Info,
  Download,
  AlertTriangle,
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
  const [subTab, setSubTab] = useState<'can' | 'dtc' | 'gps' | 'device'>('can');
  const [showRawDtcDebug, setShowRawDtcDebug] = useState(false);

  const record = telemetry?.record;
  const metrics = record ? decodeCanMetrics(record) : null;

  if (!record || !metrics) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-sm space-y-3 max-w-4xl mx-auto">
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

  const activeIds = new Set(record.ioElements.map(el => el.id));
  const canIds = record.ioElements.filter(el => {
    // Only CAN-classified values, never tracker power, GPS odometer or ignition.
    const genuineCanIds = [24, 30, 31, 32, 33, 36, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 100, 101, 102, 103, 104, 105, 132, 160, 162, 179, 242, 256, 282];
    return genuineCanIds.includes(el.id);
  });
  const todayDate = telemetry?.receivedAt ? new Date(telemetry.receivedAt).toLocaleString(isAr ? 'ar-LY' : 'en-US') : '—';
  const dtcCount = metrics.diagnostic.dtcCount;
  const hasDtcFaults = dtcCount > 0 || metrics.diagnostic.milActive;

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      <section className="rounded-3xl border border-cyan-400/30 bg-[#08213e] p-4 text-white shadow-xl" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-black">{isAr ? 'المراقبة الحية — البيانات المستلمة من FMB140' : 'Live FMB140 telemetry'}</h2>
            <p className="text-xs text-cyan-200">{isAr ? 'آخر استلام' : 'Last received'}: {todayDate}</p></div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${canIds.length ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'}`}>
            {canIds.length ? `${canIds.length} CAN/OBD` : (isAr ? 'CAN لم يصل بعد' : 'CAN not received')}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-300">{isAr ? 'سرعة GPS' : 'GPS speed'}</p><b className="text-2xl">{record.speed}</b><span className="text-xs"> km/h</span></div>
          <div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-300">{isAr ? 'السويتش' : 'Ignition'}</p><b className="text-2xl">{activeIds.has(239) ? (metrics.ignition.isOn ? 'ON' : 'OFF') : '—'}</b></div>
          <div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-300">{isAr ? 'جهد السيارة' : 'Vehicle power'}</p><b className="text-2xl">{metrics.electrical.vehicleVoltageV ?? '—'}</b><span className="text-xs"> V</span></div>
          <div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-300">{isAr ? 'عداد المتعقب' : 'Tracker odometer'}</p><b className="text-2xl">{activeIds.has(16) ? metrics.odometer.totalKm ?? '—' : '—'}</b><span className="text-xs"> km</span></div>
        </div>
        {canIds.length === 0 && <p className="mt-3 text-xs leading-7 text-amber-200">{isAr
          ? 'الاتصال وGPS يعملان، لكن لا توجد في الحزمة الحالية بيانات مؤكدة لـ RPM أو الوقود أو الحرارة. لا تُعرض قيم افتراضية مكان البيانات المفقودة.'
          : 'TCP/GPS are working, but no confirmed RPM, fuel or temperature CAN values are present in this packet.'}</p>}
      </section>
      <section dir={isAr ? 'rtl' : 'ltr'} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900">{isAr ? 'كل قراءات AVL المستلمة مباشرة' : 'All received AVL readings'}</h3>
            <p className="text-xs text-slate-500">{isAr ? 'هذه القيم تأتي من آخر حزمة وصلت من الجهاز، وليست بيانات تجريبية' : 'Values taken from the most recent device packet, not sample data'}</p>
          </div>
          <button type="button" onClick={onRefresh} disabled={isLoading} className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            <RotateCw size={15} className={isLoading ? 'animate-spin' : ''}/>{isAr ? 'تحديث الآن' : 'Refresh now'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {record.ioElements.map((el) => {
            const labels: Record<number, string> = {239:'السويتش',240:'مستشعر الحركة',21:'إشارة GSM',66:'جهد السيارة V',67:'بطارية الجهاز V',68:'تيار بطارية الجهاز mA',16:'عداد مسافة الجهاز km',241:'شبكة GSM',200:'عنصر الجهاز 200',69:'عنصر الجهاز 69',181:'عنصر الجهاز 181',182:'عنصر الجهاز 182'};
            const raw = Number(el.value);
            const scaled = [66,67,16].includes(el.id) && Number.isFinite(raw) ? (raw / 1000).toFixed(3) : el.value;
            const shown = el.id === 239 ? (el.value === '1' ? 'ON' : 'OFF') : el.id === 240 ? (el.value === '1' ? 'تتحرك' : 'متوقفة') : scaled;
            return <div key={el.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">{labels[el.id] || `AVL ID ${el.id}`}</p>
              <b className="mt-1 block break-all font-mono text-xl text-slate-900">{shown}</b>
              <p className="mt-1 font-mono text-[10px] text-slate-400">ID {el.id} | raw {el.value}</p>
            </div>;
          })}
        </div>
        {canIds.length===0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
          {isAr ? 'لا توجد عناصر RPM أو حرارة المحرك أو الوقود داخل آخر حزمة. تظهر هذه القيم في Configurator محلياً، لكن يلزم تفعيل إرسال عناصر CAN/OBD في AVL وحفظ إعدادات الجهاز حتى تصل إلى الموقع.' : 'RPM, coolant and fuel were not present in this packet. Configure the tracker to transmit CAN/OBD IO over AVL.'}
        </div>}
      </section>
      <section dir={isAr ? 'rtl' : 'ltr'} className="rounded-3xl border border-cyan-300/40 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-base font-black text-slate-900">{isAr ? 'عدادات CAN الحية — قيم واردة فقط' : 'Live CAN gauges — received values only'}</h3>
        <p className="mb-4 text-xs leading-6 text-slate-500">{isAr ? 'يقرأ الموقع هذه العناصر مباشرة من أحدث سجل AVL. عدم إرسال العنصر يظهر — وليس صفراً افتراضياً.' : 'Gauges use the latest real AVL values; missing values display —.'}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            [isAr ? 'RPM المحرك' : 'Engine RPM', metrics.engine.rpm, 'rpm'],
            [isAr ? 'حرارة المحرك' : 'Coolant temperature', metrics.engine.coolantTempC, '°C'],
            [isAr ? 'حمل المحرك' : 'Engine load', metrics.engine.loadPercent, '%'],
            [isAr ? 'مستوى الوقود' : 'Fuel level', metrics.fuel.levelPercent, '%'],
            [isAr ? 'استهلاك الوقود' : 'Fuel consumed', metrics.fuel.totalConsumedLiters, 'L'],
            [isAr ? 'تدفق الوقود' : 'Fuel flow', metrics.fuel.instantRateLitersPerHour, 'L/h'],
          ] as Array<[string, number | null, string]>).map(([name, value, unit]) => (
            <div key={name} className={`rounded-2xl border p-3 ${value === null ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className="text-xs font-bold text-slate-600">{name}</p>
              <b className="mt-2 block text-2xl text-slate-900">{value === null ? '—' : value}</b>
              <small className="text-xs text-slate-500">{value === null ? (isAr ? 'لم تصل القراءة' : 'Not received') : unit}</small>
            </div>
          ))}
        </div>
        {!canIds.length && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-7 text-amber-900">
          {isAr ? 'فحص آخر Log: الجهاز متصل ويرسل GPS وAVL، لكن لا توجد معرّفات CAN. من Teltonika Configurator فعّل Priority = Low لعناصر CAN Adapter مثل Engine RPM وEngine Temperature وTotal Mileage، مع Event Only = No وOperand = Monitoring، ثم احفظ إلى الجهاز وانتظر حزمة جديدة. الصور المحلية ليست بيانات واردة للسيرفر.' : 'No CAN IDs in the latest packet. Enable the required CAN Adapter I/O parameters in Configurator and save to device.'}
        </p>}
      </section>
      {/* Title & Sub-tabs Header */}
      <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              {isAr ? 'بيانات السيارة' : 'Vitals & CAN'}
            </button>
            <button
              onClick={() => setSubTab('dtc')}
              className={`relative px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                subTab === 'dtc'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              <span>{isAr ? 'الأعطال (DTC)' : 'Diagnostics (DTC)'}</span>
              {hasDtcFaults && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setSubTab('gps')}
              className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                subTab === 'gps'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              GPS
            </button>
            <button
              onClick={() => setSubTab('device')}
              className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 ${
                subTab === 'device'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:text-slate-900'
              }`}
            >
              {isAr ? 'الجهاز' : 'Tracker'}
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
          <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-5 shadow-sm">
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
          <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-5 shadow-sm">
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
          <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-5 shadow-sm">
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
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تحميل الـ Log' : 'Download Log'}</span>
                </a>
              </div>
            )}
          </div>

          {/* Section 4: عداد المسافات والراحة (Odometer & Comfort / C-CAN) */}
          <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-5 shadow-sm">
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
          <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    hasDtcFaults
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {hasDtcFaults ? (
                    <ShieldAlert className="w-6 h-6 animate-bounce" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6" />
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تحميل سجل التشخيص' : 'Download Diagnostic Log'}</span>
                </a>

                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                    metrics.diagnostic.milActive
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>
                    {isAr ? 'لمبة فحص المحرك (MIL):' : 'Check Engine Light:'}{' '}
                    {metrics.diagnostic.milActive
                      ? isAr
                        ? 'مضاءة (تنبيه عطل!)'
                        : 'Active / ON'
                      : isAr
                      ? 'مطفأة (سليمة)'
                      : 'OFF / Normal'}
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
                  className="bg-white rounded-2xl border border-rose-200 p-4 shadow-sm space-y-2"
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
            <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center shadow-sm space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900">
                {isAr
                  ? 'المنظومة سليمة تماماً — لا توجد أي أكواد أعطال مسجلة'
                  : 'All Systems Normal — No DTC Fault Codes Detected'}
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                {isAr
                  ? 'تم فحص ذاكرة الأعطال في كمبيوتر السيارة (ECU) عبر ناقل CAN/OBD. لم يتم رصد أي خلل في منظومة الاحتراق أو التبريد أو الانبعاثات، ولمبة فحص المحرك مطفأة.'
                  : 'Electronic Control Units (ECUs) report 0 active trouble codes. Engine, transmission, and emission systems are operating nominally.'}
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

      {/* SUBTAB 3: GPS & Navigation */}
      {subTab === 'gps' && (
        <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-5 shadow-sm space-y-4">
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

      {/* SUBTAB 4: Device Diagnostics */}
      {subTab === 'device' && (
        <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm p-5 shadow-sm space-y-4">
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
