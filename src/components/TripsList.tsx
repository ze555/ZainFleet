import React, { useState, useEffect } from 'react';
import { DeviceInfo, VehicleTrip } from '../types/fleet.js';
import { TripDetailsModal } from './TripDetailsModal.tsx';
import {
  Route,
  Clock,
  Gauge,
  Milestone,
  RotateCw,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Fuel,
} from 'lucide-react';
import { formatCoordinates } from '../utils/geoUtils.js';

interface TripsListProps {
  device: DeviceInfo;
  lang: 'ar' | 'en';
}

export const TripsList: React.FC<TripsListProps> = ({ device, lang }) => {
  const isAr = lang === 'ar';
  const [trips, setTrips] = useState<VehicleTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<VehicleTrip | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const fetchTrips = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/devices/${device.imei}/trips`);
      if (res.ok) {
        const data: VehicleTrip[] = await res.json();
        setTrips(data);
      }
    } catch {
      // Quiet fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [device.imei]);

  // Filter trips based on selection
  const now = Date.now();
  const filteredTrips = trips.filter((trip) => {
    if (filter === 'all') return true;
    const tripTime = new Date(trip.startTime).getTime();
    if (filter === 'today') {
      return new Date(trip.startTime).toDateString() === new Date().toDateString();
    }
    if (filter === 'week') {
      return now - tripTime <= 7 * 24 * 60 * 60 * 1000;
    }
    if (filter === 'month') {
      return now - tripTime <= 30 * 24 * 60 * 60 * 1000;
    }
    return true;
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* Title & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Route className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {isAr ? 'سجل الرحلات السابقة' : 'Trip History Log'}
            </h2>
            <p className="text-xs text-slate-500">
              {isAr
                ? `الرحلات المستخلصة من إحداثيات ومستشعرات المركبة (${filteredTrips.length} رحلة)`
                : `Trips generated from real vehicle movements (${filteredTrips.length} trips)`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Filter Pills matching Mockup */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              {isAr ? 'كل الرحلات' : 'All'}
            </button>
            <button
              onClick={() => setFilter('today')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filter === 'today'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              {isAr ? 'اليوم' : 'Today'}
            </button>
            <button
              onClick={() => setFilter('week')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filter === 'week'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              {isAr ? 'الأسبوع' : 'Week'}
            </button>
            <button
              onClick={() => setFilter('month')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filter === 'month'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              {isAr ? 'الشهر' : 'Month'}
            </button>
          </div>

          <button
            onClick={fetchTrips}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title={isAr ? 'تحديث' : 'Refresh'}
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Trips List */}
      {filteredTrips.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-xs space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center">
            <Route className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {isAr ? 'لا توجد رحلات مسجلة في هذه الفترة' : 'No Trips Recorded in this period'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {isAr
              ? 'تبدأ الرحلة تلقائياً عند تشغيل سويتش السيارة والتحرك لمسافة تزيد عن 150 متراً، وتنتهي بعد توقف المحرك لمدة تزيد عن 5 دقائق.'
              : 'Trips are registered automatically when the vehicle starts moving (>150m) and conclude after parking.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrips.map((trip) => {
            const startDate = new Date(trip.startTime);
            const endDate = new Date(trip.endTime);
            const hours = Math.floor(trip.durationMinutes / 60);
            const minutes = trip.durationMinutes % 60;
            const durationText =
              hours > 0
                ? isAr
                  ? `${hours} س ${minutes} د`
                  : `${hours}h ${minutes}m`
                : isAr
                ? `${minutes} د`
                : `${minutes}m`;

            return (
              <div
                key={trip.id}
                onClick={() => setSelectedTrip(trip)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400/80 p-4 shadow-xs transition-all cursor-pointer group hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">
                        {startDate.toLocaleDateString(isAr ? 'ar-EG' : 'en-US')} &bull;{' '}
                        {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {isAr ? 'مكتملة' : 'Completed'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">
                        {formatCoordinates(trip.startCoords[0], trip.startCoords[1])}
                        {' ➔ '}
                        {formatCoordinates(trip.endCoords[0], trip.endCoords[1])}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors shrink-0">
                    {isAr ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                </div>

                {/* Metrics Badges Row matching Mockup */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Milestone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isAr ? 'المسافة' : 'Distance'}</span>
                      <span className="font-bold font-mono text-slate-900">{trip.distanceKm} km</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isAr ? 'المدة' : 'Duration'}</span>
                      <span className="font-bold font-mono text-slate-900">{durationText}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Gauge className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block">{isAr ? 'السرعة القصوى' : 'Max Speed'}</span>
                      <span className="font-bold font-mono text-slate-900">{trip.maxSpeedKmH} km/h</span>
                    </div>
                  </div>

                  {trip.fuelConsumedPercent !== null && (
                    <div className="hidden sm:flex items-center gap-1.5 text-slate-700">
                      <Fuel className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isAr ? 'الوقود' : 'Fuel'}</span>
                        <span className="font-bold font-mono text-slate-900">{trip.fuelConsumedPercent}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Trip Details Modal */}
      {selectedTrip && (
        <TripDetailsModal
          trip={selectedTrip}
          onClose={() => setSelectedTrip(null)}
          lang={lang}
        />
      )}
    </div>
  );
};
