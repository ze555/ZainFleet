import React from 'react';
import { Home, Route, MapPin, MoreHorizontal, Bell } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  unreadAlertsCount: number;
  onOpenDrawer: () => void;
  lang: 'ar' | 'en';
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  setCurrentTab,
  unreadAlertsCount,
  onOpenDrawer,
  lang,
}) => {
  const isAr = lang === 'ar';

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 lg:hidden px-2 py-1.5 shadow-lg">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* 1. الرئيسية */}
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
            currentTab === 'dashboard'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <Home className={`w-5 h-5 ${currentTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5">{isAr ? 'الرئيسية' : 'Home'}</span>
        </button>

        {/* 2. الرحلات */}
        <button
          onClick={() => setCurrentTab('trips')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
            currentTab === 'trips'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <Route className={`w-5 h-5 ${currentTab === 'trips' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5">{isAr ? 'الرحلات' : 'Trips'}</span>
        </button>

        {/* 3. الخرائط */}
        <button
          onClick={() => setCurrentTab('map')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
            currentTab === 'map'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <MapPin className={`w-5 h-5 ${currentTab === 'map' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-0.5">{isAr ? 'الخرائط' : 'Map'}</span>
        </button>

        {/* 4. التنبيهات (مع شارة التنبيه) */}
        <button
          onClick={() => setCurrentTab('alerts')}
          className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
            currentTab === 'alerts'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <Bell className={`w-5 h-5 ${currentTab === 'alerts' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          {unreadAlertsCount > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
              {unreadAlertsCount}
            </span>
          )}
          <span className="text-[10px] mt-0.5">{isAr ? 'التنبيهات' : 'Alerts'}</span>
        </button>

        {/* 5. المزيد (يفتح القائمة الجانبية) */}
        <button
          onClick={onOpenDrawer}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-500 hover:text-slate-800 font-medium transition-colors"
        >
          <MoreHorizontal className="w-5 h-5 stroke-2" />
          <span className="text-[10px] mt-0.5">{isAr ? 'المزيد' : 'More'}</span>
        </button>
      </div>
    </nav>
  );
};
