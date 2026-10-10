import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { VehicleTrip } from '../types/fleet.js';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatCoordinates } from '../utils/geoUtils.js';

interface TripDetailsModalProps {
  trip: VehicleTrip;
  onClose: () => void;
  lang: 'ar' | 'en';
}

export const TripDetailsModal: React.FC<TripDetailsModalProps> = ({
  trip,
  onClose,
  lang,
}) => {
  const isAr = lang === 'ar';
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [showExtraDetails, setShowExtraDetails] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const points = trip.points || [];
    if (points.length === 0) return;

    const initialLat = points[0].lat;
    const initialLng = points[0].lng;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([initialLat, initialLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Build polyline from points
    const latLngs: L.LatLngExpression[] = points.map((p) => [p.lat, p.lng]);
    const polyline = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 4.5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Start Marker (Green)
    const first = points[0];
    const startIcon = L.divIcon({
      className: 'start-marker-icon',
      html: `
        <div style="background: #10b981; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
      `,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([first.lat, first.lng], { icon: startIcon })
      .bindPopup(isAr ? 'نقطة الانطلاق' : 'Start Point')
      .addTo(map);

    // End Marker (Red)
    const last = points[points.length - 1];
    const endIcon = L.divIcon({
      className: 'end-marker-icon',
      html: `
        <div style="background: #ef4444; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
      `,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([last.lat, last.lng], { icon: endIcon })
      .bindPopup(isAr ? 'نقطة الوصول' : 'Destination')
      .addTo(map);

    // Fit map bounds to polyline
    map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [trip, isAr]);

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
      ? `${minutes} دقيقة`
      : `${minutes} min`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title={isAr ? 'رجوع' : 'Back'}
            >
              {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {isAr ? 'تفاصيل الرحلة' : 'Trip Details'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  {isAr ? 'مكتملة' : 'Completed'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {startDate.toLocaleDateString(isAr ? 'ar-EG' : 'en-US')} &bull;{' '}
                {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>

        {/* 3 Main Stat Cards (Distance, Duration, Max Speed) */}
        <div className="p-4 sm:p-5 grid grid-cols-3 gap-3 bg-white border-b border-slate-100">
          <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-2xl text-center">
            <span className="text-[11px] font-bold text-blue-700 block mb-1">
              {isAr ? 'المسافة' : 'Distance'}
            </span>
            <span className="text-lg sm:text-2xl font-extrabold font-mono text-slate-900">
              {trip.distanceKm}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 block">
              {isAr ? 'كم' : 'km'}
            </span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-2xl text-center">
            <span className="text-[11px] font-bold text-emerald-700 block mb-1">
              {isAr ? 'المدة' : 'Duration'}
            </span>
            <span className="text-lg sm:text-2xl font-extrabold font-mono text-slate-900">
              {durationText}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 block">
              {isAr ? 'وقت السير' : 'Driving time'}
            </span>
          </div>

          <div className="bg-amber-50/70 border border-amber-100 p-3 rounded-2xl text-center">
            <span className="text-[11px] font-bold text-amber-700 block mb-1">
              {isAr ? 'السرعة القصوى' : 'Max Speed'}
            </span>
            <span className="text-lg sm:text-2xl font-extrabold font-mono text-slate-900">
              {trip.maxSpeedKmH}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 block">
              {isAr ? 'كم/س' : 'km/h'}
            </span>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative flex-1 min-h-[260px] sm:min-h-[320px] bg-slate-100">
          <div ref={mapContainerRef} className="absolute inset-0 z-10" />

          {/* Map Legend Footer */}
          <div className="absolute bottom-2 inset-x-2 z-20 pointer-events-none flex justify-center">
            <div className="bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-full border border-slate-200/80 shadow-md text-[11px] font-semibold text-slate-700 flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                {isAr ? 'نقطة البداية' : 'Start'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                {isAr ? 'نقطة النهاية' : 'End'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-1 bg-blue-600 rounded-full inline-block" />
                {isAr ? 'المسار' : 'Route'}
              </span>
            </div>
          </div>
        </div>

        {/* Expandable Extra Details */}
        <div className="border-t border-slate-100 p-4 bg-slate-50/70">
          <button
            onClick={() => setShowExtraDetails(!showExtraDetails)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors"
          >
            <span>{isAr ? 'تفاصيل إضافية عن الرحلة' : 'Additional Trip Details'}</span>
            {showExtraDetails ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showExtraDetails && (
            <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5">
                  {isAr ? 'متوسط السرعة' : 'Avg Speed'}
                </span>
                <span className="font-bold font-mono text-slate-800">
                  {trip.avgSpeedKmH} km/h
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5">
                  {isAr ? 'استهلاك الوقود' : 'Fuel Consumed'}
                </span>
                <span className="font-bold font-mono text-slate-800">
                  {trip.fuelConsumedPercent !== null ? `${trip.fuelConsumedPercent}%` : 'CAN M-Bus'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5">
                  {isAr ? 'إحداثيات البداية' : 'Start Coordinates'}
                </span>
                <span className="font-bold font-mono text-slate-800 text-[11px]">
                  {formatCoordinates(trip.startCoords[0], trip.startCoords[1])}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5">
                  {isAr ? 'نقاط الـ GPS' : 'Recorded Fixes'}
                </span>
                <span className="font-bold font-mono text-slate-800">
                  {trip.points.length} {isAr ? 'نقطة' : 'points'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
