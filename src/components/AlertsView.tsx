import React, { useState } from 'react';
import { DeviceInfo, TelemetrySnapshot, VehicleAlert } from '../types/fleet.js';
import { decodeCanMetrics, generateVehicleAlerts } from '../utils/canBusDecoder.js';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface AlertsViewProps {
  device: DeviceInfo;
  telemetry: TelemetrySnapshot | null;
  lang: 'ar' | 'en';
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  device,
  telemetry,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [filter, setFilter] = useState<'all' | 'danger' | 'warning' | 'info'>('all');

  const record = telemetry?.record;
  const metrics = record ? decodeCanMetrics(record) : null;
  const canAlerts = metrics ? generateVehicleAlerts(metrics) : [];

  // Connectivity alerts
  const connectionAlerts: VehicleAlert[] = [];
  const now = new Date().toISOString();

  if (!device.connected) {
    connectionAlerts.push({
      id: 'conn-offline',
      type: 'warning',
      titleAr: 'انقطاع اتصال جهاز التتبع بالخادم',
      titleEn: 'Vehicle Tracker Disconnected',
      messageAr: `لم يستقبل الخادم حزم بيانات من الجهاز منذ ${new Date(device.lastPacketAt || device.lastSeen).toLocaleTimeString()}. تأكد من تشغيل السيارة وتغطية شبكة الجوال.`,
      messageEn: `No TCP packets received since ${new Date(device.lastPacketAt || device.lastSeen).toLocaleTimeString()}.`,
      timestamp: device.lastPacketAt || device.lastSeen || now,
    });
  } else {
    connectionAlerts.push({
      id: 'conn-online',
      type: 'info',
      titleAr: 'الاتصال بالمركبة مستقر وحي',
      titleEn: 'Live Vehicle Connection Active',
      messageAr: `قناة الـ TCP مفتوحة ويتم استقبال قراءات الـ FMB140 CAN المباشرة بشكل منتظم.`,
      messageEn: 'TCP socket is active and live telemetry is syncing smoothly.',
      timestamp: device.lastPacketAt || now,
    });
  }

  const allAlerts: VehicleAlert[] = [...canAlerts, ...connectionAlerts];

  const filteredAlerts = allAlerts.filter((a) => {
    if (filter === 'all') return true;
    return a.type === filter;
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* Title & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {isAr ? 'مركز التنبيهات وحالة المركبة' : 'Vehicle Alerts & Health Center'}
            </h2>
            <p className="text-xs text-slate-500">
              {isAr
                ? `تنبيهات فورية مبنية حصراً على بيانات الـ CAN الحية والاتصال (${allAlerts.length} إشعار)`
                : `Active alerts based strictly on verified CAN Bus and connection telemetry`}
            </p>
          </div>
        </div>

        {/* Filter Pills matching Mockup */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            {isAr ? 'الكل' : 'All'}
          </button>
          <button
            onClick={() => setFilter('danger')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'danger'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            {isAr ? 'مهمة' : 'Critical'}
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'warning'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            {isAr ? 'تحذيرات' : 'Warnings'}
          </button>
          <button
            onClick={() => setFilter('info')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === 'info'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            {isAr ? 'معلومات' : 'Info'}
          </button>
        </div>
      </div>

      {/* Alerts Cards List */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-xs space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {isAr ? 'لا توجد تنبيهات نشطة' : 'No Active Alerts'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {isAr
              ? 'حالة المنظومة سليمة؛ جميع قراءات المحرك وسوائل التبريد والجهد الكهربائي ضمن المعدلات الطبيعية الآمنة.'
              : 'All vehicle telemetry metrics are within nominal ranges.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const isDanger = alert.type === 'danger';
            const isWarning = alert.type === 'warning';

            return (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border transition-all shadow-xs flex items-start gap-3.5 ${
                  isDanger
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : isWarning
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-blue-50/60 border-blue-200 text-blue-950'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isDanger
                      ? 'bg-rose-100 text-rose-600'
                      : isWarning
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {isDanger ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : isWarning ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-bold truncate">
                      {isAr ? alert.titleAr : alert.titleEn}
                    </h3>
                    <span className="text-[11px] font-mono opacity-60 shrink-0">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs mt-1 leading-relaxed opacity-85">
                    {isAr ? alert.messageAr : alert.messageEn}
                  </p>

                  {alert.parameterId && (
                    <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/80 border border-slate-200/60">
                      AVL ID: {alert.parameterId}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
