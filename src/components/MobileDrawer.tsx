import React from 'react';
import {
  X,
  Home,
  Route,
  MapPin,
  Car,
  Bell,
  Layers,
  ShieldCheck,
  Globe,
  Radio,
} from 'lucide-react';
import { DeviceInfo } from '../types/fleet.js';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  device: DeviceInfo | null;
  vehicleName: string;
  unreadAlertsCount: number;
  serverHealthy: boolean;
  lang: 'ar' | 'en';
  setLang: (lang: 'ar' | 'en') => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  currentTab,
  setCurrentTab,
  device,
  vehicleName,
  unreadAlertsCount,
  serverHealthy,
  lang,
  setLang,
}) => {
  const isAr = lang === 'ar';

  if (!isOpen) return null;

  const navigate = (tab: string) => {
    setCurrentTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden lg:hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Container */}
      <div
        className={`fixed inset-y-0 ${
          isAr ? 'right-0' : 'left-0'
        } max-w-xs w-full bg-slate-900 text-white shadow-2xl flex flex-col z-50 transition-transform`}
      >
        {/* Header / Vehicle Profile Card */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isAr ? 'قائمة زين فليت' : 'ZainFleet Menu'}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Car className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-white truncate">
                {vehicleName}
              </h3>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                {device ? `IMEI: ${device.imei}` : 'FMB140 CAN'}
              </p>

              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    device?.connected
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      device?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {device?.connected ? (isAr ? 'متصل' : 'Online') : (isAr ? 'غير متصل' : 'Offline')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <button
            onClick={() => navigate('dashboard')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Home className="w-4 h-4" />
              <span>{isAr ? 'الرئيسية (داشبورد)' : 'Main Dashboard'}</span>
            </div>
          </button>

          <button
            onClick={() => navigate('trips')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentTab === 'trips'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Route className="w-4 h-4" />
              <span>{isAr ? 'سجل الرحلات' : 'Trip History'}</span>
            </div>
          </button>

          <button
            onClick={() => navigate('map')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentTab === 'map'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4" />
              <span>{isAr ? 'الخريطة الحية' : 'Live Map'}</span>
            </div>
          </button>

          <button
            onClick={() => navigate('vehicle')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentTab === 'vehicle'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Car className="w-4 h-4" />
              <span>{isAr ? 'بيانات السيارة (CAN Bus)' : 'Vehicle CAN Data'}</span>
            </div>
          </button>

          <button
            onClick={() => navigate('alerts')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentTab === 'alerts'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4" />
              <span>{isAr ? 'التنبيهات والمشكلات' : 'Alerts & Warnings'}</span>
            </div>
            {unreadAlertsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('sensors')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentTab === 'sensors'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4" />
              <span>{isAr ? 'جميع الحساسات (تشخيصي)' : 'Diagnostics & Sensors'}</span>
            </div>
          </button>

          <button
            onClick={() => navigate('privacy')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              currentTab === 'privacy'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4" />
              <span>{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</span>
            </div>
          </button>
        </div>

        {/* Footer info & Language Toggle */}
        <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{isAr ? 'اللغة' : 'Language'}</span>
            <button
              onClick={() => setLang(isAr ? 'en' : 'ar')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors font-bold text-xs"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>{isAr ? 'English' : 'العربية'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
            <span>{isAr ? 'حالة السيرفر' : 'Server'}</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <Radio className="w-3 h-3" />
              {serverHealthy ? 'Active TCP 5000' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
