import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { DeviceInfo, TelemetrySnapshot, VehicleTrip } from '../types/fleet.js';
import {
  Navigation,
  Calendar,
  Clock,
  RotateCw,
  ArrowRight,
  Route,
} from 'lucide-react';

interface TripMapProps {
  device: DeviceInfo;
  latestTelemetry: TelemetrySnapshot | null;
  lang: 'ar' | 'en';
}

export const TripMap: React.FC<TripMapProps> = ({
  device,
  latestTelemetry,
  lang,
}) => {
  const isAr = lang === 'ar';
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);

  const [trips, setTrips] = useState<VehicleTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<VehicleTrip | null>(null);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [activeMode, setActiveMode] = useState<'live' | 'history'>('live');
  const [tripFilter, setTripFilter] = useState<'all' | 'today' | 'week'>('all');

  // Fetch Trips for device
  const fetchTrips = async () => {
    setIsLoadingTrips(true);
    try {
      const res = await fetch(`/api/devices/${device.imei}/trips`);
      if (res.ok) {
        const data: VehicleTrip[] = await res.json();
        setTrips(data);
      }
    } catch {
      // Quiet fallback
    } finally {
      setIsLoadingTrips(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [device.imei]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = latestTelemetry?.record.latitude ?? 24.7136;
      const initialLng = latestTelemetry?.record.longitude ?? 46.6753;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
      }).setView([initialLat, initialLng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      routeLayerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Live Vehicle Marker on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || activeMode !== 'live') return;

    const record = latestTelemetry?.record;
    if (!record || record.latitude === 0 || record.longitude === 0) return;

    const latLng = L.latLng(record.latitude, record.longitude);

    if (routeLayerGroupRef.current) {
      routeLayerGroupRef.current.clearLayers();
    }

    // Car Icon with direction angle
    const angle = record.angle || 0;
    const carIcon = L.divIcon({
      className: 'vehicle-custom-marker',
      html: `
        <div style="transform: rotate(${angle}deg); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: #2563eb; color: white; border-radius: 50%; box-shadow: 0 4px 12px rgba(37,99,235,0.4); border: 3px solid white;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L4 20L12 16L20 20L12 2Z"/>
          </svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(latLng);
      vehicleMarkerRef.current.setIcon(carIcon);
    } else {
      const marker = L.marker(latLng, { icon: carIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
          <b>${isAr ? 'المركبة:' : 'Vehicle:'} ${device.imei}</b><br/>
          ${isAr ? 'السرعة:' : 'Speed:'} <b>${record.speed} km/h</b><br/>
          ${isAr ? 'التوقيت:' : 'Time:'} ${new Date(record.timestamp).toLocaleTimeString()}
        </div>
      `);
      vehicleMarkerRef.current = marker;
    }

    map.setView(latLng, map.getZoom() < 13 ? 15 : map.getZoom());
  }, [latestTelemetry, activeMode, device.imei, isAr]);

  // Render Selected Past Trip on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || activeMode !== 'history' || !selectedTrip) return;

    if (routeLayerGroupRef.current) {
      routeLayerGroupRef.current.clearLayers();
    }

    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.remove();
      vehicleMarkerRef.current = null;
    }

    const points = selectedTrip.points;
    if (!points || points.length === 0) return;

    const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);

    // Draw route polyline
    const polyline = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.85,
      lineJoin: 'round',
    });
    routeLayerGroupRef.current?.addLayer(polyline);

    // Start Marker (Green Point A)
    const startPoint = points[0];
    const startIcon = L.divIcon({
      className: 'trip-start-marker',
      html: `
        <div style="background: #16a34a; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
          A
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const startMarker = L.marker([startPoint.lat, startPoint.lng], { icon: startIcon });
    startMarker.bindPopup(`<b>${isAr ? 'بداية الرحلة' : 'Trip Start'}</b><br/>${new Date(startPoint.timestamp).toLocaleTimeString()}`);
    routeLayerGroupRef.current?.addLayer(startMarker);

    // End Marker (Red Point B)
    const endPoint = points[points.length - 1];
    const endIcon = L.divIcon({
      className: 'trip-end-marker',
      html: `
        <div style="background: #dc2626; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
          B
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const endMarker = L.marker([endPoint.lat, endPoint.lng], { icon: endIcon });
    endMarker.bindPopup(`<b>${isAr ? 'نهاية الرحلة' : 'Trip End'}</b><br/>${new Date(endPoint.timestamp).toLocaleTimeString()}`);
    routeLayerGroupRef.current?.addLayer(endMarker);

    // Zoom and pan map to fit whole trip path
    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  }, [selectedTrip, activeMode, isAr]);

  // Filtered trips
  const filteredTrips = trips.filter((t) => {
    if (tripFilter === 'all') return true;
    const tripDate = new Date(t.startTime);
    const now = new Date();
    if (tripFilter === 'today') {
      return tripDate.toDateString() === now.toDateString();
    }
    if (tripFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return tripDate >= weekAgo;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Map Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Segmented Control for Live Tracking vs Past Trips */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => {
                setActiveMode('live');
                setSelectedTrip(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeMode === 'live'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span>{isAr ? 'الموقع المباشر الآن' : 'Live Tracking'}</span>
            </button>

            <button
              onClick={() => {
                setActiveMode('history');
                if (!selectedTrip && trips.length > 0) {
                  setSelectedTrip(trips[0]);
                }
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeMode === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Route className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {isAr ? 'الرحلات السابقة' : 'Past Trips'} ({trips.length})
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeMode === 'live' && latestTelemetry && (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {latestTelemetry.record.latitude.toFixed(5)}°, {latestTelemetry.record.longitude.toFixed(5)}°
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-bold text-slate-900">{latestTelemetry.record.speed} km/h</span>
            </div>
          )}

          <button
            onClick={fetchTrips}
            disabled={isLoadingTrips}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title={isAr ? 'تحديث الرحلات' : 'Refresh Trips'}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoadingTrips ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Selected Trip Overview Card (when viewing history) */}
      {activeMode === 'history' && selectedTrip && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs mb-3 pb-3 border-b border-blue-200/60">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-900 text-sm">
                {isAr ? 'تفاصيل الرحلة المحددة:' : 'Selected Trip:'}
              </span>
              <span className="font-medium text-blue-700">
                {new Date(selectedTrip.startTime).toLocaleDateString()} ·{' '}
                {new Date(selectedTrip.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                - {new Date(selectedTrip.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <button
              onClick={() => {
                setActiveMode('live');
                setSelectedTrip(null);
              }}
              className="text-blue-700 hover:text-blue-900 font-bold hover:underline flex items-center gap-1"
            >
              <span>{isAr ? 'العودة للتتبع المباشر' : 'Back to Live'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-blue-600 block">{isAr ? 'المسافة المقطوعة' : 'Distance'}</span>
              <span className="text-lg font-extrabold font-mono text-slate-900">
                {selectedTrip.distanceKm} <span className="text-xs font-normal">km</span>
              </span>
            </div>

            <div>
              <span className="text-blue-600 block">{isAr ? 'مدة الرحلة' : 'Duration'}</span>
              <span className="text-lg font-extrabold font-mono text-slate-900">
                {selectedTrip.durationMinutes} <span className="text-xs font-normal">{isAr ? 'دقيقة' : 'min'}</span>
              </span>
            </div>

            <div>
              <span className="text-blue-600 block">{isAr ? 'أقصى سرعة' : 'Max Speed'}</span>
              <span className="text-lg font-extrabold font-mono text-slate-900">
                {selectedTrip.maxSpeedKmH} <span className="text-xs font-normal">km/h</span>
              </span>
            </div>

            <div>
              <span className="text-blue-600 block">{isAr ? 'متوسط السرعة' : 'Avg Speed'}</span>
              <span className="text-lg font-extrabold font-mono text-slate-900">
                {selectedTrip.avgSpeedKmH} <span className="text-xs font-normal">km/h</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Map + Trips Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Interactive Leaflet Map Container */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs h-[520px] relative">
          <div ref={mapContainerRef} className="w-full h-full z-10" />
        </div>

        {/* Trips History Sidebar (or Live status details) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>{isAr ? 'سجل الرحلات السابقة' : 'Trip History'}</span>
            </h2>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setTripFilter('all')}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  tripFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {isAr ? 'الكل' : 'All'}
              </button>
              <button
                onClick={() => setTripFilter('today')}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  tripFilter === 'today'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {isAr ? 'اليوم' : 'Today'}
              </button>
            </div>
          </div>

          {/* Trips Scroll List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredTrips.length > 0 ? (
              filteredTrips.map((trip) => {
                const isSelected = selectedTrip?.id === trip.id;
                return (
                  <div
                    key={trip.id}
                    onClick={() => {
                      setActiveMode('history');
                      setSelectedTrip(trip);
                    }}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-400 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                      <span>{new Date(trip.startTime).toLocaleDateString()}</span>
                      <span className="font-mono text-blue-700">
                        {trip.distanceKm} km
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mb-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(trip.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {new Date(trip.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>·</span>
                      <span>{trip.durationMinutes} {isAr ? 'دقيقة' : 'min'}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60 text-slate-600">
                      <span>
                        {isAr ? 'أقصى سرعة:' : 'Max Speed:'}{' '}
                        <b className="font-mono">{trip.maxSpeedKmH} km/h</b>
                      </span>
                      <span>
                        {isAr ? 'المتوسط:' : 'Avg:'}{' '}
                        <b className="font-mono">{trip.avgSpeedKmH} km/h</b>
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                <Route className="w-8 h-8 opacity-40 mb-2" />
                <p className="text-xs font-semibold text-slate-600">
                  {isAr ? 'لا توجد رحلات مسجلة بعد' : 'No Trips Recorded Yet'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                  {isAr
                    ? 'بمجرد تحرك السيارة وتشغيلها، سيتم تقسيم المسارات إلى رحلات وحفظها تلقائياً.'
                    : 'As soon as the vehicle moves, trips will be automatically tracked and saved here.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
