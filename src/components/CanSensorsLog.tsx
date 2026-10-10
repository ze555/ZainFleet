import React, { useState } from 'react';
import { TelemetrySnapshot } from '../types/fleet.js';
import { Layers, Search, Copy, Check, Info } from 'lucide-react';

interface CanSensorsLogProps {
  telemetry: TelemetrySnapshot | null;
  lang: 'ar' | 'en';
}

interface KnownCanParam {
  nameAr: string;
  nameEn: string;
  category: 'M-CAN (المحرك والحركة)' | 'C-CAN (المقصورة والأمان)' | 'GNSS & System';
  unit: string;
  format?: (raw: string) => string;
}

const KNOWN_CAN_PARAMS: Record<number, KnownCanParam> = {
  1: {
    nameAr: 'إشارة تشغيل المحرك (DIN1 / Ignition)',
    nameEn: 'Ignition / DIN1',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'State',
    format: (v) => (v === '1' ? 'تشغيل ON' : 'إطفاء OFF'),
  },
  6: {
    nameAr: 'جودة إشارة شبكة الجوال',
    nameEn: 'GSM Signal Quality',
    category: 'GNSS & System',
    unit: 'RSSI',
  },
  16: {
    nameAr: 'عداد المسافات الإجمالي من الـ CAN',
    nameEn: 'Total Odometer (CAN)',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'km',
    format: (v) => `${Math.round(Number(v) / 1000).toLocaleString()} km`,
  },
  21: {
    nameAr: 'مستوى إشارة الشبكة',
    nameEn: 'GSM Signal Level',
    category: 'GNSS & System',
    unit: 'Bars (1-5)',
  },
  24: {
    nameAr: 'سرعة المركبة من الكان',
    nameEn: 'Wheel Speed (CAN)',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'km/h',
  },
  32: {
    nameAr: 'حرارة سائل تبريد المحرك',
    nameEn: 'Coolant Temperature',
    category: 'M-CAN (المحرك والحركة)',
    unit: '°C',
    format: (v) => `${v}°C`,
  },
  33: {
    nameAr: 'سرعة دوران المحرك (RPM)',
    nameEn: 'Engine Speed (RPM)',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'RPM',
  },
  66: {
    nameAr: 'جهد بطارية السيارة الخارجي',
    nameEn: 'External Battery Voltage',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'V',
    format: (v) => `${(Number(v) / 1000).toFixed(1)} V`,
  },
  67: {
    nameAr: 'جهد بطارية جهاز التتبع الداخلية',
    nameEn: 'Internal Tracker Battery',
    category: 'GNSS & System',
    unit: 'V',
    format: (v) => `${(Number(v) / 1000).toFixed(2)} V`,
  },
  81: {
    nameAr: 'سرعة السيارة من ناقل الحركة CAN',
    nameEn: 'CAN Vehicle Speed',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'km/h',
  },
  82: {
    nameAr: 'موقع دواسة الوقود / الحمل',
    nameEn: 'Accelerator Pedal Position',
    category: 'M-CAN (المحرك والحركة)',
    unit: '%',
    format: (v) => `${v}%`,
  },
  83: {
    nameAr: 'إجمالي الوقود المستهلك',
    nameEn: 'Total Fuel Consumed',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'Liters',
    format: (v) => `${v} L`,
  },
  85: {
    nameAr: 'دورات المحرك (Engine RPM)',
    nameEn: 'Engine RPM (CAN)',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'RPM',
  },
  86: {
    nameAr: 'دورات المحرك القياسية',
    nameEn: 'Engine RPM Standard',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'RPM',
  },
  87: {
    nameAr: 'عداد المسافات الكلي من الـ CAN',
    nameEn: 'Total Odometer (CAN Bus)',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'km',
    format: (v) => {
      const n = Number(v);
      return n > 1000000 ? `${Math.round(n / 1000).toLocaleString()} km` : `${n.toLocaleString()} km`;
    },
  },
  88: {
    nameAr: 'عداد المسافات الفعلي للسيارة',
    nameEn: 'Vehicle High-Res Odometer',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'km',
    format: (v) => `${Number(v).toLocaleString()} km`,
  },
  89: {
    nameAr: 'مستوى خزان الوقود بالنسبة المئوية',
    nameEn: 'Fuel Level Percentage',
    category: 'M-CAN (المحرك والحركة)',
    unit: '%',
    format: (v) => `${v}%`,
  },
  90: {
    nameAr: 'مستوى خزان الوقود باللترات',
    nameEn: 'Fuel Level Liters',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'Liters',
    format: (v) => `${v} L`,
  },
  100: {
    nameAr: 'حالة أبواب السيارة والكبوت والشنطة',
    nameEn: 'Door / Hood / Trunk Status',
    category: 'C-CAN (المقصورة والأمان)',
    unit: 'Bitmask',
  },
  102: {
    nameAr: 'إجمالي ساعات عمل المحرك',
    nameEn: 'Total Engine Work Hours',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'Hours',
    format: (v) => `${Math.round(Number(v) / 3600)} Hours`,
  },
  115: {
    nameAr: 'درجة حرارة سائل تبريد المحرك (Coolant)',
    nameEn: 'Engine Coolant Temperature',
    category: 'M-CAN (المحرك والحركة)',
    unit: '°C',
    format: (v) => `${v}°C`,
  },
  132: {
    nameAr: 'مؤشرات الأمان (الجلنط، الحزام، فحص المحرك)',
    nameEn: 'Security & Safety Status (MIL, Belt, Brake)',
    category: 'C-CAN (المقصورة والأمان)',
    unit: 'Flags',
  },
  162: {
    nameAr: 'درجة حرارة زيت المحرك',
    nameEn: 'Engine Oil Temperature',
    category: 'M-CAN (المحرك والحركة)',
    unit: '°C',
    format: (v) => `${v}°C`,
  },
  179: {
    nameAr: 'معدل استهلاك الوقود اللحظي',
    nameEn: 'Instant Fuel Rate',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'L/h',
    format: (v) => `${v} L/h`,
  },
  239: {
    nameAr: 'حالة السويتش / مفتاح التشغيل (Ignition)',
    nameEn: 'Ignition Status',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'State',
    format: (v) => (v === '1' ? 'شغال ON' : 'متوقف OFF'),
  },
  240: {
    nameAr: 'مستشعر حركة السيارة',
    nameEn: 'Movement Sensor',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'State',
    format: (v) => (v === '1' ? 'تسير Moving' : 'متوقفة Stationary'),
  },
  241: {
    nameAr: 'كود مشغل شبكة الجوال (MCC/MNC)',
    nameEn: 'Active GSM Operator Code',
    category: 'GNSS & System',
    unit: 'Code',
  },
  250: {
    nameAr: 'عداد مسافة الرحلة الحالية',
    nameEn: 'Trip Distance',
    category: 'M-CAN (المحرك والحركة)',
    unit: 'km',
    format: (v) => `${(Number(v) / 1000).toFixed(1)} km`,
  },
};

export const CanSensorsLog: React.FC<CanSensorsLogProps> = ({ telemetry, lang }) => {
  const isAr = lang === 'ar';
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const record = telemetry?.record;
  const elements = record?.ioElements || [];

  const handleCopyJson = () => {
    if (!telemetry) return;
    navigator.clipboard.writeText(JSON.stringify(telemetry, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredElements = elements.filter((el) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const info = KNOWN_CAN_PARAMS[el.id];
    const idMatch = String(el.id).includes(term);
    const valMatch = el.value.toLowerCase().includes(term);
    const nameMatch = info ? (info.nameAr.toLowerCase().includes(term) || info.nameEn.toLowerCase().includes(term)) : false;
    return idMatch || valMatch || nameMatch;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <span>{isAr ? 'سجل تشخيصات وحساسات الكان (CAN Bus Log)' : 'CAN Bus Sensor Diagnostic Log'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAr
              ? `قراءة حية لجميع معلمات ناقل بيانات السيارة CAN Bus المستقبلة من جهاز FMB140 (${elements.length} بارامتر)`
              : `Live decoded parameters received directly from vehicle CAN bus (${elements.length} parameters)`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isAr ? 'بحث برقم الحساس أو الاسم...' : 'Search ID or name...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
            />
          </div>

          <button
            onClick={handleCopyJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ JSON' : 'Copy JSON')}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      {elements.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">{isAr ? 'معرف الحساس (CAN ID)' : 'Parameter ID'}</th>
                <th className="py-2.5 px-4">{isAr ? 'اسم البارامتر والوظيفة' : 'CAN Parameter & Meaning'}</th>
                <th className="py-2.5 px-4">{isAr ? 'الناقل (Bus)' : 'Bus'}</th>
                <th className="py-2.5 px-4">{isAr ? 'القيمة الحالية' : 'Decoded Value'}</th>
                <th className="py-2.5 px-4">{isAr ? 'القيمة الخام' : 'Raw Value'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredElements.map((el) => {
                const info = KNOWN_CAN_PARAMS[el.id];
                const decodedText = info?.format ? info.format(el.value) : el.value;

                return (
                  <tr key={el.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      ID #{el.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {isAr ? info?.nameAr || `حساس CAN برقم ${el.id}` : info?.nameEn || `CAN Parameter #${el.id}`}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {info?.unit ? `Unit: ${info.unit}` : `${el.byteLength} byte(s)`}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-medium text-slate-600">
                        {info?.category || 'M-CAN / C-CAN'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {decodedText} {info?.unit && !info?.format ? info.unit : ''}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {el.value}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
          <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium text-slate-600">
            {isAr ? 'في انتظار وصول حزم بيانات الـ CAN من جهاز FMB140' : 'Waiting for live CAN bus packets from FMB140'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {isAr
              ? 'بمجرد تشغيل السيارة واتصال الجهاز بالخادم، ستظهر جميع مستشعرات المحرك والوقود والأبواب هنا تلقائياً.'
              : 'As soon as the device transmits AVL packets over TCP, all parameters will be listed here in real-time.'}
          </p>
        </div>
      )}
    </div>
  );
};
