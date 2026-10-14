import React from 'react';
import { Compass, Globe, Radio } from 'lucide-react';
import { DeviceInfo } from '../types/fleet.js';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  serverHealthy: boolean;
  activeDevice: DeviceInfo | null;
  vehicleName: string;
  unreadAlertsCount: number;
  lang: 'ar' | 'en';
  setLang: (lang: 'ar' | 'en') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  serverHealthy,
  activeDevice,
  vehicleName,
  unreadAlertsCount,
  onOpenDrawer,
  lang,
  setLang,
}) => {
  const isAr = lang === 'ar';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand & Drawer Trigger on Mobile */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sm group-hover:bg-blue-700 transition-colors shrink-0">
                <Compass className="w-5 h-5" />
              </div>
              <div className="hidden xs:block">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                    ZainFleet
                  </span>
                  {activeDevice && (
                    <span className="hidden md:inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {vehicleName}
                    </span>
                  )}
                </div>
                <span className="block text-[11px] font-medium text-slate-500">
                  {isAr ? 'لوحة تحكم السيارة المباشرة' : 'Live Vehicle Telemetry'}
                </span>
              </div>
            </div>   </button>
          </div>

          {/* Right Header Controls: Alert Bell, Language Toggle, TCP Status */}
          <div className="flex items-center gap-2">
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
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span
                className={`w-2 h-2 rounded-full ${
                  serverHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <Radio className="w-3.5 h-3.5" />
              <span>{serverHealthy ? 'TCP 5000' : 'Connecting...'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
