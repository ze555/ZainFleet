import React from 'react';
import {
  Gauge,
  MapPin,
  Layers,
  ShieldCheck,
  Compass,
  Globe,
  Radio,
  Car
} from 'lucide-react';
import { DeviceInfo } from '../types/fleet.js';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  serverHealthy: boolean;
  activeDevice: DeviceInfo | null;
  lang: 'ar' | 'en';
  setLang: (lang: 'ar' | 'en') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  serverHealthy,
  activeDevice,
  lang,
  setLang,
}) => {
  const isAr = lang === 'ar';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm group-hover:bg-blue-700 transition-colors">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                  ZainFleet CAN
                </span>
                <span className="block text-xs font-medium text-slate-500">
                  {isAr ? 'تتبع وقراءات CAN Bus الحية' : 'Live Vehicle Telemetry'}
                </span>
              </div>
            </button>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                currentTab === 'dashboard'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Gauge className="w-4 h-4 text-blue-600" />
              <span>{isAr ? 'لوحة القيادة' : 'Dashboard'}</span>
            </button>

            <button
              onClick={() => setCurrentTab('map')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                currentTab === 'map'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>{isAr ? 'الخريطة والرحلات' : 'Map & Trips'}</span>
            </button>

            <button
              onClick={() => setCurrentTab('sensors')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                currentTab === 'sensors'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4 text-violet-600" />
              <span>{isAr ? 'حساسات الكان' : 'CAN Sensors'}</span>
            </button>

            <button
              onClick={() => setCurrentTab('privacy')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                currentTab === 'privacy'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <span>{isAr ? 'الخصوصية' : 'Privacy'}</span>
            </button>
          </nav>

          {/* Right Header Controls: Language Toggle & TCP Status */}
          <div className="flex items-center gap-2">
            {activeDevice && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-mono font-semibold">
                <Car className="w-3.5 h-3.5 text-blue-600" />
                <span>{activeDevice.imei.slice(-6)}</span>
              </div>
            )}

            {/* Language toggle */}
            <button
              onClick={() => setLang(isAr ? 'en' : 'ar')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              title={isAr ? 'Switch to English' : 'التحويل للعربية'}
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{isAr ? 'EN' : 'عربي'}</span>
            </button>

            {/* Server Status Indicator */}
            <div className="hidden lg:flex items-center gap-2">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  serverHealthy
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    serverHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <Radio className="w-3.5 h-3.5" />
                <span>{serverHealthy ? 'TCP 5000 Active' : 'Connecting...'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
