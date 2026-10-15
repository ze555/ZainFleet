import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { TelemetrySnapshot } from '../types/fleet.js';

interface Props { imei: string; lang: 'ar' | 'en'; }
const TRIP_TIMEZONE = 'Africa/Tripoli';
const dayFormatter = new Intl.DateTimeFormat('en-CA', {timeZone: TRIP_TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit'});
const todayKey = (date: Date) => dayFormatter.format(date);
type Sample = { t: number; lat: number; lng: number; speed: number; odometer: number | null };
function getPoints(history: TelemetrySnapshot[]): Sample[] {
  const today = todayKey(new Date());
  const records = history.filter(h => h?.record?.timestamp && todayKey(new Date(h.record.timestamp)) === today)
    .map(h => {
      const r = h.record;
      const rawOdo = r.ioElements?.find(io => io.id === 16)?.value;
      const n = rawOdo === undefined ? NaN : Number(rawOdo);
      return {t: new Date(r.timestamp).getTime(),lat:r.latitude,lng:r.longitude,
        speed:r.speed, odometer:Number.isFinite(n)?n/1000:null};
    }).filter(p => Number.isFinite(p.t) && Number.isFinite(p.lat) && Number.isFinite(p.lng)
       && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && (p.lat !== 0 || p.lng !== 0));
  records.sort((a,b) => a.t - b.t);
  return records.filter((p,i) => i===0 || p.t !== records[i-1].t || p.lat !== records[i-1].lat || p.lng !== records[i-1].lng);
}
export const TodayGpsRoute: React.FC<Props> = ({imei,lang}) => {
  const ar = lang === 'ar';
  const canvas = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const route = useRef<L.LayerGroup | null>(null);
  const [history,setHistory] = useState<TelemetrySnapshot[]>([]);
  const [error,setError] = useState('');
  const [updated,setUpdated] = useState('');
  useEffect(() => {
    let active=true;
    const refresh=async()=>{
      try {
        const response=await fetch('/api/devices/'+encodeURIComponent(imei)+'/history?limit=5000',{cache:'no-store'});
        if(!response.ok) throw new Error('HTTP '+response.status);
        const data=await response.json();
        if(active){setHistory(Array.isArray(data)?data:[]);setError('');setUpdated(new Date().toLocaleTimeString(ar?'ar-LY':'en-US'));}
      }catch(e){if(active)setError(ar?'تعذر تحميل سجل GPS من الخادم':'Could not fetch GPS history');}
    };
    refresh();const interval=setInterval(refresh,15000);
    return()=>{active=false;clearInterval(interval)};
  },[imei,ar]);
  const points=useMemo(()=>getPoints(history),[history]);
  const summary=useMemo(()=>{
    const valid=points.filter(p=>p.speed>0);
    const from=points.find(p=>p.odometer !== null)?.odometer;
    const to=[...points].reverse().find(p=>p.odometer !== null)?.odometer;
    const distance=from !== undefined && to !== undefined && to>=from ? to-from : null;
    return {maxSpeed:Math.max(0,...points.map(p=>p.speed)),moving:valid.length, distance};
  },[points]);
  useEffect(()=>{
    if(!canvas.current) return;
    const m=L.map(canvas.current,{zoomControl:true}).setView([32.8872,13.2084],12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(m);
    map.current=m;route.current=L.layerGroup().addTo(m);
    setTimeout(()=>m.invalidateSize(),50);
    return()=>{m.remove();map.current=null;route.current=null};
  },[]);
  useEffect(()=>{
    const m=map.current,g=route.current;if(!m||!g)return;g.clearLayers();
    if(!points.length)return;
    const chunks:Sample[][]=[];let current:Sample[]=[];
    for(const p of points){
      if(current.length && p.t-current[current.length-1].t>15*60*1000){chunks.push(current);current=[];}
      current.push(p);
    }
    if(current.length)chunks.push(current);
    for(const segment of chunks){
      if(segment.length>1)L.polyline(segment.map(p=>[p.lat,p.lng] as L.LatLngTuple),{color:'#00bfff',weight:5,opacity:.9}).addTo(g);
    }
    L.circleMarker([points[0].lat,points[0].lng],{radius:8,color:'#10b981',fillColor:'#10b981',fillOpacity:1}).bindPopup(ar?'بداية المسار':'Route start').addTo(g);
    const last=points[points.length-1];
    L.circleMarker([last.lat,last.lng],{radius:8,color:'#ef4444',fillColor:'#ef4444',fillOpacity:1}).bindPopup(ar?'آخر موقع مسجل':'Latest recorded position').addTo(g);
    const latlngs=points.map(p=>[p.lat,p.lng] as L.LatLngTuple);
    if(latlngs.length>1)m.fitBounds(L.latLngBounds(latlngs),{padding:[25,25],maxZoom:16});
    else m.setView(latlngs[0],16);
  },[points,ar]);
  return <section dir={ar?'rtl':'ltr'} className="mb-5 overflow-hidden rounded-3xl border border-cyan-400/30 bg-[#09233d] p-4 text-white shadow-lg">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-black">{ar?'مسار تنقل المركبة اليوم':'Today’s vehicle GPS route'}</h2>
        <p className="text-xs text-cyan-200">{ar?'المسار من نقاط GPS المستلمة فعلياً • بتوقيت ليبيا':'Actual recorded GPS fixes • Libya time'}</p></div>
      <span className="rounded-xl bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">{ar?'آخر تحديث':'Updated'}: {updated||'—'}</span>
    </div>
    <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
      <div className="rounded-xl bg-white/10 p-3"><b className="block text-lg">{points.length}</b>{ar?'نقطة GPS':'GPS fixes'}</div>
      <div className="rounded-xl bg-white/10 p-3"><b className="block text-lg">{summary.maxSpeed}</b>{ar?'أقصى سرعة كم/س':'Max km/h'}</div>
      <div className="rounded-xl bg-white/10 p-3"><b className="block text-lg">{summary.distance === null?'—':summary.distance.toFixed(2)}</b>{ar?'فرق عداد الجهاز كم':'Tracker odometer Δ km'}</div>
    </div>
    <div ref={canvas} style={{height:390,width:'100%'}} className="z-0 overflow-hidden rounded-xl bg-slate-900" />
    {error&&<p className="mt-3 text-sm text-amber-300">{error}</p>}
    {!points.length&&!error&&<p className="mt-3 text-sm text-amber-200">{ar?'لا توجد نقاط مسجلة لليوم في سجل هذا السيرفر. قد تضيع سجلات Railway عند إعادة النشر دون Volume.':'No stored fixes today. Railway storage may reset without a volume.'}</p>}
    <p className="mt-2 text-[11px] text-slate-400">{ar?'الخط يُوصل النقاط المسجلة فقط؛ ولا يخمّن الطريق عند وجود فجوة تتجاوز 15 دقيقة.':'Connects recorded positions only; gaps longer than 15 minutes are not interpolated.'}</p>
  </section>;
};
