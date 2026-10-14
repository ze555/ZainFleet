import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { DeviceInfo, TelemetrySnapshot, VehicleTrip } from '../types/fleet.js';
import { decodeCanMetrics } from '../utils/canBusDecoder.js';
import {
  MapPin,
  Clock,
  Gauge,
  Crosshair,
  Route,
  Layers,
  Power,
  Activity,
} from 'lucide-react';
import { formatCoordinates, getApproximateAddress } from '../utils/geoUtils.js';

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
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const breadcrumbLayerRef = useRef<L.Polyline | null>(null);
  const tripsLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [locationAddress, setLocationAddress] = useState<string>('...');
  const [showPastTrips, setShowPastTrips] = useState<boolean>(false);
  const [trips, setTrips] = useState<VehicleTrip[]>([]);

  const record = latestTelemetry?.record;
  const metrics = record ? decodeCanMetrics(record) : null;
  const hasValidGps = record && record.latitude !== 0 && record.longitude !== 0;

  // Address lookup
  useEffect(() => {
    if (hasValidGps) {
      getApproximateAddress(record.latitude, record.longitude, isAr).then((addr) => {
        setLocationAddress(addr);
      });
    } else {
      setLocationAddress(isAr ? 'في انتظار إشارة GPS صالحة' : 'Waiting for GPS fix');
    }
  }, [record?.latitude, record?.longitude, hasValidGps, isAr]);

  // Fetch past trips for breadcrumbs & toggle
  const fetchTrips = async () => {
    try {
      const res = await fetch(`/api/devices/${device.imei}/trips`);
      if (res.ok) {
        const data: VehicleTrip[] = await res.json();
        setTrips(data);
      }
    } catch {
      // Quiet fallback
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [device.imei]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = hasValidGps ? record.latitude : 32.8872;
      const initialLng = hasValidGps ? record.longitude : 13.2084;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([initialLat, initialLng], 15);

      // Default street layer (OpenStreetMap)
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      tileLayerRef.current = streetLayer;

      // Custom Zoom Control top-right
      L.control.zoom({ position: isAr ? 'topleft' : 'topright' }).addTo(map);

      tripsLayerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle Map Tile Switching (Street vs Satellite)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (mapType === 'satellite') {
      // Esri World Imagery (Standard free public satellite tiles)
      const satLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye',
          maxZoom: 19,
        }
      ).addTo(map);
      tileLayerRef.current = satLayer;
    } else {
      // Street Map
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      tileLayerRef.current = streetLayer;
    }
  }, [mapType]);

  // Update Live Car Marker & Breadcrumbs
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !hasValidGps) return;

    const latLng = L.latLng(record.latitude, record.longitude);
    const angle = record.angle || 0;

    // Car Icon with rotation heading
    const carIcon = L.divIcon({
      className: 'live-vehicle-marker',
      html: `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; inset: 0; background: rgba(37,99,235,0.25); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="transform: rotate(${angle}deg); width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; background: #2563eb; color: white; border-radius: 50%; box-shadow: 0 4px 14px rgba(37,99,235,0.5); border: 3px solid white; z-index: 10;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(latLng);
      vehicleMarkerRef.current.setIcon(carIcon);
    } else {
      const marker = L.marker(latLng, { icon: carIcon }).addTo(map);
      vehicleMarkerRef.current = marker;
    }

    map.panTo(latLng);

    // Draw breadcrumb trail of latest trip points if available
    if (trips.length > 0 && trips[0].points.length >= 2) {
      const latestPoints = trips[0].points.map((p) => [p.lat, p.lng] as [number, number]);
      // Append current live position to breadcrumb
      latestPoints.push([record.latitude, record.longitude]);

      if (breadcrumbLayerRef.current) {
        breadcrumbLayerRef.current.setLatLngs(latestPoints);
      } else {
        const polyline = L.polyline(latestPoints, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        breadcrumbLayerRef.current = polyline;
      }
    }
  }, [record?.latitude, record?.longitude, record?.angle, hasValidGps, trips]);

  // Render Past Trips Overlays if toggled
  useEffect(() => {
    const layerGroup = tripsLayerGroupRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();

    if (showPastTrips && trips.length > 0) {
      // Draw previous trips polylines (skipping 0 which is current)
      trips.slice(1, 6).forEach((trip) => {
        const points = trip.points.map((p) => [p.lat, p.lng] as [number, number]);
        if (points.length >= 2) {
          L.polyline(points, {
            color: '#64748b',
            weight: 3,
            opacity: 0.5,
            dashArray: '5, 8',
          }).addTo(layerGroup);
        }
      });
    }
  }, [showPastTrips, trips]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && hasValidGps) {
      mapInstanceRef.current.setView([record.latitude, record.longitude], 16, { animate: true });
    }
  };

  const measurementDate = record ? new Date(record.timestamp) : null;
  const isStale = measurementDate
    ? Date.now() - measurementDate.getTime() > 5 * 60 * 1000
    : true;

  return (
    <div className="relative w-full h-[calc(100vh-140px)] sm:h-[calc(100vh-160px)] min-h-[500px] rounded-3xl overflow-hidden border border-slate-200 shadow-sm flex flex-col">
      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Top Floating Telemetry & Freshness Bar */}
      {hasValidGps && (
        <div className="absolute top-4 inset-x-4 z-20 pointer-events-none flex justify-center">
          <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-slate-200/80 pointer-events-auto flex flex-wrap items-center gap-3 text-xs">
            {/* Speed */}
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Gauge className="w-4 h-4 text-blue-600" />
              <span>
                {isAr ? 'السرعة:' : 'Speed:'}{' '}
                <span className="font-mono text-sm">{record.speed}</span> {isAr ? 'كم/س' : 'km/h'}
              </span>
            </div>

            <span className="w-1 h-3.5 bg-slate-200 rounded-full" />

            {/* Ignition */}
            <div className="flex items-center gap-1.5 font-bold">
              <Power
                className={`w-3.5 h-3.5 ${
                  metrics?.ignition.isOn ? 'text-emerald-600' : 'text-slate-400'
                }`}
              />
              <span
                className={metrics?.ignition.isOn ? 'text-emerald-700' : 'text-slate-500'}
              >
                {metrics?.ignition.isOn
                  ? isAr
                    ? 'السويتش: شغال'
                    : 'Ignition: ON'
                  : isAr
                  ? 'السويتش: مطفأ'
                  : 'Ignition: OFF'}
              </span>
            </div>

            <span className="w-1 h-3.5 bg-slate-200 rounded-full" />

            {/* Movement */}
            <div className="flex items-center gap-1.5 text-slate-600">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {metrics?.isMoving.state
                  ? isAr
                    ? 'تسير'
                    : 'Moving'
                  : isAr
                  ? 'متوقفة'
                  : 'Parked'}
              </span>
            </div>

            <span className="w-1 h-3.5 bg-slate-200 rounded-full" />

            {/* Freshness Timestamp */}
            <div className="flex items-center gap-1.5 text-slate-500 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {measurementDate
                  ? measurementDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '---'}
              </span>
              {isStale && (
                <span className="text-[10px] font-sans font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-md border border-amber-200">
                  {isAr ? 'متوقفة' : 'Stale'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Controls (Map Switcher & Recenter) */}
      <div className={`absolute bottom-32 ${isAr ? 'left-4' : 'right-4'} z-20 flex flex-col gap-2`}>
        {/* Layer Switcher: Street vs Satellite */}
        <button
          onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')}
          className="p-3 bg-white text-slate-700 hover:text-blue-600 rounded-2xl shadow-lg border border-slate-200 transition-colors hover:bg-slate-50 flex items-center justify-center group"
          title={
            mapType === 'street'
              ? isAr
                ? 'التحويل للأقمار الصناعية'
                : 'Switch to Satellite'
              : isAr
              ? 'التحويل لخريطة الشوارع'
              : 'Switch to Street Map'
          }
        >
          <Layers className="w-5 h-5" />
        </button>

        {/* Recenter on vehicle */}
        <button
          onClick={handleRecenter}
          disabled={!hasValidGps}
          className="p-3 bg-white text-slate-700 hover:text-blue-600 rounded-2xl shadow-lg border border-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-50"
          title={isAr ? 'إعادة التمركز على المركبة' : 'Recenter on vehicle'}
        >
          <Crosshair className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Floating Info Card */}
      <div className="absolute bottom-4 inset-x-4 z-20 flex justify-center">
        <div className="bg-white/95 backdrop-blur-md max-w-xl w-full p-4 rounded-3xl shadow-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                hasValidGps ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <MapPin className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isAr ? 'الموقع الحالي' : 'Live Location'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    device.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
              </div>

              <h4 className="font-bold text-sm text-slate-900 truncate mt-0.5">
                {locationAddress}
              </h4>

              {hasValidGps && (
                <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                  {formatCoordinates(record.latitude, record.longitude)} &bull;{' '}
                  {measurementDate?.toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                </p>
              )}
            </div>
          </div>

          {/* Toggle Past Trips overlay */}
          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
            <button
              onClick={() => setShowPastTrips(!showPastTrips)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                showPastTrips
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Route className="w-3.5 h-3.5" />
              <span>{isAr ? 'الرحلات السابقة' : 'Past Trips'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
