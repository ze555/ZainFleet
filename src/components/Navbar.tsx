import React from 'react';
import { Activity, Radio, Gauge, ShieldCheck, Compass } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  serverHealthy: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, serverHealthy }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentTab('fleet')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm group-hover:bg-blue-700 transition-colors">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                  ZainFleet
                </span>
                <span className="block text-xs font-medium text-slate-500">
                  Teltonika Protocol Server
                </span>
              </div>
            </button>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setCurrentTab('fleet')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'fleet'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Fleet & Devices</span>
            </button>

            <button
              onClick={() => setCurrentTab('canbus')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'canbus'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Gauge className="w-4 h-4" />
              <span>CAN Bus Live Telemetry</span>
            </button>

            <button
              onClick={() => setCurrentTab('privacy')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'privacy'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Privacy</span>
            </button>
          </nav>

          <div className="hidden md:flex items-center gap-2">
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
              <Activity className="w-3.5 h-3.5" />
              <span>{serverHealthy ? 'Server Healthy (Port 3000)' : 'Connecting...'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
