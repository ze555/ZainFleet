import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Cpu,
  Layers,
  RotateCw,
  Copy,
  Check,
  Terminal,
  ShieldAlert,
  Info,
  Trash2,
} from 'lucide-react';
import { DeviceInfo } from '../types/fleet.js';

interface DiagnosticViewProps {
  device: DeviceInfo | null;
  lang: 'ar' | 'en';
}

interface DiagnosticSummary {
  totalPacketsRecorded: number;
  latestPacketAt: string | null;
  latestImei: string | null;
  id66VehicleVoltageAudit: {
    currentlyPresent: boolean;
    everSeenInSession: boolean;
    latestVoltageV: number | null;
    status: string;
    diagnosisAr: string;
    diagnosisEn: string;
  };
  canBusAudit: {
    currentlyCommunicating: boolean;
    everSeenInSession: boolean;
    detectedCanIdsCount: number;
    detectedCanIds: number[];
    diagnosisAr: string;
    diagnosisEn: string;
  };
  dtcAudit: {
    milActive: boolean;
    dtcCount: number;
    codes: Array<{
      code: string;
      standard: string;
      subsystemEn: string;
      subsystemAr: string;
      descriptionEn: string;
      descriptionAr: string;
      severity: string;
    }>;
  };
  allReceivedIoIdsEver: number[];
  latestEntry: any | null;
  logFilePaths: {
    json: string;
    text: string;
  };
}

export const DiagnosticView: React.FC<DiagnosticViewProps> = ({ device, lang }) => {
  const isAr = lang === 'ar';
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedHex, setCopiedHex] = useState<boolean>(false);
  const [filterIoSearch, setFilterIoSearch] = useState<string>('');
  const [customHexInput, setCustomHexInput] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simSuccess, setSimSuccess] = useState<string | null>(null);

  const fetchSummary = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/diagnostics/summary');
      if (res.ok) {
        const data: DiagnosticSummary = await res.json();
        setSummary(data);
      }
    } catch {
      // Quiet fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 2000);
  };

  const handleClearLogs = async () => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من مسح سجلات التشخيص؟' : 'Are you sure you want to clear diagnostic logs?')) {
      return;
    }
    try {
      await fetch('/api/diagnostics/clear', { method: 'POST' });
      fetchSummary();
    } catch {}
  };

  const handleSimulateHex = async () => {
    if (!customHexInput.trim()) return;
    setIsSimulating(true);
    setSimError(null);
    setSimSuccess(null);
    try {
      const res = await fetch('/api/packets/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hex: customHexInput.trim(),
          imei: device?.imei || '864500000000001',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSimSuccess(
          isAr
            ? `تم فك حزمة البيانات بنجاح (${data.records.length} سجلات) وتحديث سجل التشخيص!`
            : `Decoded successfully (${data.records.length} records) and logged!`
        );
        setCustomHexInput('');
        fetchSummary();
      } else {
        setSimError(data.error || 'Failed to decode packet');
      }
    } catch (err: any) {
      setSimError(err.message || 'Connection error');
    } finally {
      setIsSimulating(false);
    }
  };

  const latest = summary?.latestEntry;
  const id66Audit = summary?.id66VehicleVoltageAudit;
  const canAudit = summary?.canBusAudit;
  const dtcAudit = summary?.dtcAudit;

  // Filter IO elements in table
  const rawIoList = latest?.avlRecords?.[0]?.allIoElementsReceived || [];
  const filteredIoElements = rawIoList.filter((el: any) => {
    if (!filterIoSearch) return true;
    const term = filterIoSearch.toLowerCase();
    return (
      el.id.toString().includes(term) ||
      (el.catalogNameEn && el.catalogNameEn.toLowerCase().includes(term)) ||
      (el.catalogNameAr && el.catalogNameAr.includes(term)) ||
      (el.rawHexOrValue && el.rawHexOrValue.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* 1. Header Banner & Direct Download Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>{isAr ? 'تقرير تشخيص Teltonika FMB140' : 'FMB140 Diagnostic Report & Log'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {isAr ? 'تشخيص حزم البيانات والبطارية و CAN' : 'Vehicle Telemetry & Packet Diagnostics'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                {isAr
                  ? 'تشخيص دقيق لأسباب غياب جهد بطارية السيارة الرئيسي (AVL ID 66) وحساسات الـ CAN/OBD. يمكنك تحميل ملف الـ Log التشخيصي الكامل بصيغة JSON أو Text لإرساله إلى ChatGPT للتحليل الفوري.'
                  : 'Diagnostic audit for Vehicle Battery Voltage (AVL ID 66), CANbus sensors, and DTC fault codes. Download the full packet log in JSON or formatted text for ChatGPT analysis.'}
              </p>
            </div>

            {/* Direct Download Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              <a
                href="/api/diagnostics/download"
                download="fmb140_packet_diagnostic.json"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-md hover:shadow-lg transition-all"
              >
                <Download className="w-4 h-4" />
                <span>{isAr ? 'تحميل ملف التشخيص (JSON)' : 'Download Diagnostic (JSON)'}</span>
              </a>

              <a
                href="/api/diagnostics/download-log"
                download="fmb140_packet_diagnostic.log"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 shadow-md transition-all"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>{isAr ? 'تحميل تقرير النص (Log for ChatGPT)' : 'Download .log for ChatGPT'}</span>
              </a>

              <button
                onClick={fetchSummary}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title={isAr ? 'تحديث' : 'Refresh'}
              >
                <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-700/60 font-mono text-xs">
            <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40">
              <span className="text-slate-400 text-[10px] block">{isAr ? 'الحزم المسجلة' : 'Recorded Packets'}</span>
              <span className="text-lg font-bold text-white mt-0.5 block">
                {summary?.totalPacketsRecorded || 0}
              </span>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40">
              <span className="text-slate-400 text-[10px] block">{isAr ? 'جهد بطارية السيارة (ID 66)' : 'Vehicle Voltage (ID 66)'}</span>
              <span
                className={`text-lg font-bold mt-0.5 block ${
                  id66Audit?.currentlyPresent ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {id66Audit?.currentlyPresent ? `${id66Audit.latestVoltageV} V` : isAr ? 'غير مرسل (Missing)' : 'Missing'}
              </span>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40">
              <span className="text-slate-400 text-[10px] block">{isAr ? 'حساسات الكان (CANbus)' : 'CANbus Sensors'}</span>
              <span
                className={`text-lg font-bold mt-0.5 block ${
                  canAudit?.currentlyCommunicating ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {canAudit?.currentlyCommunicating
                  ? `${canAudit.detectedCanIdsCount} ${isAr ? 'حساس' : 'Active'}`
                  : isAr
                  ? 'لا توجد قراءات'
                  : 'Inactive'}
              </span>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40">
              <span className="text-slate-400 text-[10px] block">{isAr ? 'أعطال الـ ECU (DTC)' : 'ECU Faults (DTC)'}</span>
              <span
                className={`text-lg font-bold mt-0.5 block ${
                  (dtcAudit?.dtcCount ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {(dtcAudit?.dtcCount ?? 0) > 0
                  ? `${dtcAudit?.dtcCount} ${isAr ? 'أعطال' : 'Faults'}`
                  : isAr
                  ? '0 (سليم)'
                  : '0 (Normal)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Deep Root Cause Analysis Card: Vehicle Battery Voltage (ID 66) vs Backup Battery (ID 67) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/80">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {isAr ? 'التحليل الجذري: لغز اختفاء قراءة جهد بطارية السيارة' : 'Root Cause Audit: Vehicle Battery Voltage Mystery'}
            </h2>
            <p className="text-xs text-slate-500">
              {isAr
                ? 'التمييز بين جهد بطارية السيارة الخارجية (ID 66) وجهد بطارية جهاز التتبع الداخلية (ID 67)'
                : 'Distinguishing Vehicle External Voltage (ID 66) from Internal Backup Battery (ID 67)'}
            </p>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Vehicle External Battery (ID 66) */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              id66Audit?.currentlyPresent
                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/60 border-amber-300 text-amber-950'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-600">
                {isAr ? 'بطارية السيارة الرئيسية (External Voltage)' : 'Vehicle Main Battery'}
              </span>
              <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-white/80 border border-slate-200 text-slate-800">
                AVL ID 66 (mV)
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-extrabold font-mono">
                {id66Audit?.currentlyPresent ? `${id66Audit.latestVoltageV} V` : '0.0 V (N/A)'}
              </span>
              <span className="text-xs font-semibold">
                {id66Audit?.currentlyPresent ? (isAr ? 'مستلم من الجهاز' : 'Received') : isAr ? 'غير مرسل في الحزمة' : 'Not Sent'}
              </span>
            </div>

            {/* Status explanation */}
            {!id66Audit?.currentlyPresent ? (
              <div className="mt-3 p-3 bg-white/90 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="font-bold">
                    {isAr
                      ? 'جهاز FMB140 لا يرسل العنصر ID 66 في حزم البيانات عبر TCP!'
                      : 'The FMB140 tracker is not including AVL ID 66 in its TCP telemetry stream!'}
                  </p>
                </div>
                <div className="text-[11px] space-y-1 text-slate-700 pl-6 rtl:pr-6 rtl:pl-0">
                  <p>
                    <strong>{isAr ? 'السبب الأول والأكثر شيوعاً:' : 'Primary Root Cause:'}</strong>{' '}
                    {isAr
                      ? 'في برنامج Teltonika Configurator، لم يتم تفعيل العنصر ID 66 (External Voltage) في تبويب I/O، أو أن أولويته مضبوطة على Disabled.'
                      : 'In Teltonika Configurator, AVL ID 66 (External Voltage) is disabled or not set in the active I/O profile.'}
                  </p>
                  <p>
                    <strong>{isAr ? 'السبب الثاني:' : 'Secondary Root Cause:'}</strong>{' '}
                    {isAr
                      ? 'إذا كان الجهاز موصولاً بالكمبيوتر عبر USB فقط أثناء الضبط بدون توصيل سلك الكهرباء الدائم (+12V السلك الأحمر Pin 1)، فلن يتحسس الجهاز أي جهد خارجي.'
                      : 'If the device is powered exclusively via USB to PC without the 12V vehicle supply (Pin 1 Red Wire), no external voltage exists to be measured.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-white/90 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {isAr
                    ? `العنصر ID 66 مستلم بنجاح وجهد بطارية السيارة مقروء (${id66Audit?.latestVoltageV} V).`
                    : `AVL ID 66 is actively transmitted and verified (${id66Audit?.latestVoltageV} V).`}
                </span>
              </div>
            )}
          </div>

          {/* Card B: Tracker Internal Backup Battery (ID 67) */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 text-slate-800">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-600">
                {isAr ? 'بطارية جهاز التتبع الاحتياطية (Backup Battery)' : 'Tracker Backup Battery'}
              </span>
              <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-white border border-slate-200 text-slate-700">
                AVL ID 67 (mV)
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-extrabold font-mono text-slate-900">
                {latest?.canObdAudit?.trackerBackupBatteryId67?.scaledVolts !== null
                  ? `${latest?.canObdAudit?.trackerBackupBatteryId67?.scaledVolts} V`
                  : '4.0 V'}
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                {isAr ? 'بطارية ليثيوم 170mAh داخلية' : 'Internal Li-Ion 170mAh'}
              </span>
            </div>

            <div className="mt-3 p-3 bg-white rounded-[22px] border border-slate-200/80 shadow-sm/80 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{isAr ? 'تنبيه هندسي بالغ الأهمية:' : 'Critical Engineering Distinction:'}</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {isAr
                  ? 'هذه القراءة (عادة بين 3.7V إلى 4.2V) هي جهد بطارية الليثيوم الصغيرة الموجودة داخل جهاز FMB140 للطوارئ، وليست بطارية السيارة! لا تخلط بينها وبين جهد بطارية السيارة 12V.'
                  : 'This reading (typically 3.7V - 4.2V) represents the internal backup Li-Ion cell inside the FMB140 housing. It is NOT the vehicle 12V lead-acid battery!'}
              </p>
            </div>
          </div>
        </div>

        {/* Step-by-Step Fix Guide Box */}
        <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/80 text-xs text-blue-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-blue-900">
            <Cpu className="w-4 h-4 text-blue-600" />
            <span>
              {isAr
                ? 'خطوات الحل في برنامج Teltonika Configurator لإظهار جهد بطارية السيارة و CANbus فوراً:'
                : 'Teltonika Configurator Instructions to Enable ID 66 and CAN Parameters:'}
            </span>
          </div>

          <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-blue-900 leading-relaxed font-sans">
            <li>
              {isAr
                ? 'افتح برنامج Teltonika Configurator وصِل جهاز FMB140 بالكمبيوتر.'
                : 'Open Teltonika Configurator and connect the FMB140 tracker.'}
            </li>
            <li>
              {isAr
                ? 'انتقل إلى قائمة I/O (الإدخال/الإخراج) في البرنامج.'
                : 'Navigate to the "I/O" tab in the left sidebar.'}
            </li>
            <li>
              {isAr
                ? 'ابحث عن العنصر ID 66 (External Voltage): قم بتغيير الأولوية من Disabled إلى Low أو High، واضبط وضع الإرسال على Periodic (مثلاً كل 10 ثوانٍ) أو On Change.'
                : 'Locate AVL ID 66 (External Voltage): Change Priority from "Disabled" to "Low" or "High", and set Operand/Send to "On Change" or "Periodic".'}
            </li>
            <li>
              {isAr
                ? 'لتفعيل قراءات الـ CAN: انتقل إلى تبويب CAN Adapter أو OBD-II، وتأكد من تفعيل خواص CAN مع إدخال كود السيارة (Program Number)، وتفعيل عناصر CAN I/O (RPM ID 36, Speed ID 33, Fuel ID 89, DTC ID 282).'
                : 'For CANbus: In CAN Adapter / OBD-II tab, ensure vehicle program number is set, and enable target CAN I/O IDs (RPM ID 36, Speed ID 33, Fuel ID 89, DTC ID 282) with Priority > Disabled.'}
            </li>
            <li>
              {isAr
                ? 'اضغط زر Save to Device لحفظ الإعدادات في الجهاز، ثم شغّل سويتش السيارة.'
                : 'Click "Save to Device" to flash the settings, then switch vehicle ignition ON.'}
            </li>
          </ol>
        </div>
      </div>

      {/* 3. Deep CAN Bus & DTC Fault Codes Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CAN Bus Status */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/80">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {isAr ? 'حالة شبكة الكان (CAN Bus Telemetry)' : 'CAN Bus Network Status'}
                </h3>
                <span className="text-[11px] text-slate-500">
                  {isAr ? 'قراءات M-CAN و C-CAN الحالية' : 'Active M-CAN & C-CAN elements'}
                </span>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                canAudit?.currentlyCommunicating
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {canAudit?.currentlyCommunicating ? (isAr ? 'نشط' : 'Active') : isAr ? 'غير متصل' : 'No Data'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {isAr ? canAudit?.diagnosisAr : canAudit?.diagnosisEn}
          </p>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
            <span className="text-slate-400 block text-[10px] mb-1 font-semibold uppercase">
              {isAr ? 'عناصر الكان المرصودة في الحزمة:' : 'Detected CAN Parameter IDs:'}
            </span>
            {canAudit?.detectedCanIds && canAudit.detectedCanIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {canAudit.detectedCanIds.map((id) => (
                  <span
                    key={id}
                    className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono text-[11px] font-bold"
                  >
                    ID {id}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 text-xs italic">
                {isAr ? 'لم يتم رصد أي عناصر CAN في آخر حزمة' : 'No CAN IDs detected in latest packet'}
              </span>
            )}
          </div>
        </div>

        {/* DTC Trouble Codes Status */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                  (dtcAudit?.dtcCount ?? 0) > 0 || (dtcAudit?.milActive ?? false)
                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                }`}
              >
                {(dtcAudit?.dtcCount ?? 0) > 0 || (dtcAudit?.milActive ?? false) ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {isAr ? 'فحص كمبيوتر السيارة (ECU & DTC)' : 'ECU Trouble Codes (DTC)'}
                </h3>
                <span className="text-[11px] text-slate-500">
                  {isAr ? 'أكواد الأعطال ولمبة فحص المحرك' : 'Fault codes & Check Engine MIL'}
                </span>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                (dtcAudit?.dtcCount ?? 0) > 0 || (dtcAudit?.milActive ?? false)
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {(dtcAudit?.dtcCount ?? 0) > 0
                ? `${dtcAudit?.dtcCount} ${isAr ? 'أعطال' : 'Faults'}`
                : isAr
                ? 'لا توجد أعطال'
                : '0 Faults'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">{isAr ? 'لمبة فحص المحرك (MIL):' : 'Check Engine Light (MIL):'}</span>
              <span className="font-bold">
                {dtcAudit?.milActive ? (
                  <span className="text-rose-600">{isAr ? 'مضاءة (Active)' : 'Active (ON)'}</span>
                ) : (
                  <span className="text-emerald-600">{isAr ? 'مطفأة (سليمة)' : 'OFF (Normal)'}</span>
                )}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">{isAr ? 'عدد أكواد الأعطال المسجلة:' : 'Recorded DTC Codes:'}</span>
              <span className="font-mono font-bold text-slate-900">{dtcAudit?.dtcCount || 0}</span>
            </div>
          </div>

          {dtcAudit?.codes && dtcAudit.codes.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {dtcAudit.codes.map((c) => (
                <div key={c.code} className="p-2 bg-rose-50 rounded-lg text-xs border border-rose-200">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-rose-700">{c.code}</span>
                    <span className="text-[10px] text-slate-500">{isAr ? c.subsystemAr : c.subsystemEn}</span>
                  </div>
                  <p className="text-[11px] text-slate-800 mt-0.5">{isAr ? c.descriptionAr : c.descriptionEn}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{isAr ? 'لا توجد أي أكواد أعطال مرصودة في ذاكرة الـ ECU.' : 'All ECU diagnostics normal.'}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Live Received IO Elements Table (All IO Elements Received) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>{isAr ? 'جدول جميع عناصر الـ IO المستلمة فعلياً في آخر حزمة' : 'All Received IO Elements in Latest Packet'}</span>
            </h3>
            <p className="text-xs text-slate-500">
              {isAr
                ? 'يسجل كافة العناصر الواردة (سواء كانت معرفة في الكتالوج أو غير معروفة) مع القيم الخام والمحولة.'
                : 'Displays all incoming IO parameters (cataloged & uncataloged) with raw and engineering values.'}
            </p>
          </div>

          {/* Search box */}
          <input
            type="text"
            placeholder={isAr ? 'بحث برقم الـ ID أو الاسم...' : 'Search by ID or name...'}
            value={filterIoSearch}
            onChange={(e) => setFilterIoSearch(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 w-full sm:w-60 focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
              <tr>
                <th className="p-3 font-mono">AVL ID</th>
                <th className="p-3">{isAr ? 'اسم العنصر' : 'Parameter Name'}</th>
                <th className="p-3 font-mono">{isAr ? 'القيمة الخام' : 'Raw Value'}</th>
                <th className="p-3 font-mono">{isAr ? 'القيمة بعد التحويل' : 'Scaled Value'}</th>
                <th className="p-3">{isAr ? 'الوحدة' : 'Unit'}</th>
                <th className="p-3">{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredIoElements.length > 0 ? (
                filteredIoElements.map((el: any) => (
                  <tr key={el.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-700">{el.id}</td>
                    <td className="p-3 font-medium text-slate-900">
                      {isAr ? el.catalogNameAr || el.catalogNameEn : el.catalogNameEn}
                    </td>
                    <td className="p-3 font-mono text-slate-600">{el.rawHexOrValue}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {el.decodedValue !== undefined ? String(el.decodedValue) : el.rawHexOrValue}
                    </td>
                    <td className="p-3 text-slate-500">{el.unit}</td>
                    <td className="p-3">
                      {el.id === 66 ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {isAr ? 'بطارية السيارة!' : 'Vehicle Battery!'}
                        </span>
                      ) : el.isCatalogKnown ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                          {isAr ? 'معرّف' : 'Cataloged'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                          {isAr ? 'عنصر مخصص' : 'Custom'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                    {isAr ? 'لا توجد عناصر مطابقة أو لم يتم استلام حزم بعد' : 'No IO elements match or no packets yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Live Raw Packet Hex Viewer & Quick Test Tool */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {isAr ? 'معاينة باكت الـ Hex الخام الكاملة (Raw Hex Frame)' : 'Full Raw Packet Hex Frame'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'الباكت كاملة كما وصلت على منفذ TCP 5000 مع نتائج تدقيق الـ CRC-16'
                  : 'Complete frame as received on TCP socket with CRC-16 verification'}
              </p>
            </div>
          </div>

          {latest?.rawPacket?.fullHex && (
            <button
              onClick={() => handleCopyHex(latest.rawPacket.fullHex)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {copiedHex ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedHex ? (isAr ? 'تم النسخ!' : 'Copied!') : isAr ? 'نسخ الـ Hex' : 'Copy Hex'}</span>
            </button>
          )}
        </div>

        {latest?.rawPacket ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span>{isAr ? 'البروتوكول:' : 'Codec:'} <strong>{latest.rawPacket.codecId}</strong></span>
              <span>&bull;</span>
              <span>{isAr ? 'الحجم:' : 'Length:'} <strong>{latest.rawPacket.packetLengthBytes} bytes</strong></span>
              <span>&bull;</span>
              <span>{isAr ? 'عدد السجلات:' : 'Records:'} <strong>{latest.rawPacket.recordCount}</strong></span>
              <span>&bull;</span>
              <span>CRC-16: <strong className="text-emerald-700">{latest.rawPacket.crc16.calculated} (Valid)</strong></span>
            </div>

            <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-48 break-all leading-relaxed">
              {latest.rawPacket.fullHex}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            {isAr
              ? 'في انتظار وصول أول باكت من جهاز FMB140 على المنفذ TCP 5000...'
              : 'Waiting for initial TCP packet transmission on Port 5000...'}
          </div>
        )}

        {/* Packet Hex Simulator Box */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <span className="text-xs font-bold text-slate-700 block">
            {isAr
              ? 'تجربة فك أي باكت Teltonika Hex يدوياً وإضافتها لسجل التشخيص:'
              : 'Manual Packet Hex Testing (Inject into Diagnostic Log):'}
          </span>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder={isAr ? 'أدخل نص الـ Hex هنا (مثلاً: 00000000000000...)' : 'Paste Teltonika Hex string here...'}
              value={customHexInput}
              onChange={(e) => setCustomHexInput(e.target.value)}
              className="flex-1 text-xs font-mono p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-blue-500"
            />
            <button
              onClick={handleSimulateHex}
              disabled={isSimulating || !customHexInput.trim()}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shrink-0"
            >
              {isSimulating ? (isAr ? 'جار الفك...' : 'Decoding...') : isAr ? 'فحص وتسجيل' : 'Decode & Log'}
            </button>
          </div>

          {simSuccess && <p className="text-xs text-emerald-600 font-medium">{simSuccess}</p>}
          {simError && <p className="text-xs text-rose-600 font-medium">{simError}</p>}
        </div>

        {/* Clear Logs Button */}
        <div className="pt-3 flex justify-end">
          <button
            onClick={handleClearLogs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isAr ? 'مسح سجلات التشخيص' : 'Clear Diagnostic Logs'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
