import L from 'leaflet';
import { SmartFleet } from './components/SmartFleet.tsx';
import { AccessControl } from './components/AccessControl.tsx';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { UsersManagement } from './components/UsersManagement.tsx';
import { VehicleProfiles } from './components/VehicleProfiles.tsx';
import { CanDashboard } from './components/CanDashboard.tsx';
import { TripMap } from './components/TripMap.tsx';
import { TodayGpsRoute } from './components/TodayGpsRoute.tsx';
import { TripsList } from './components/TripsList.tsx';
import { VehicleDataView } from './components/VehicleDataView.tsx';
import { AlertsView } from './components/AlertsView.tsx';
import { CanSensorsLog } from './components/CanSensorsLog.tsx';
import { DiagnosticView } from './components/DiagnosticView.tsx';
import { PrivacyPolicy } from './components/PrivacyPolicy.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { InstrumentCluster } from './components/InstrumentCluster.tsx';
import { MobileDrawer } from './components/MobileDrawer.tsx';
import { DeviceInfo, TelemetrySnapshot } from './types/fleet.ts';
import { decodeCanMetrics, generateVehicleAlerts } from './utils/canBusDecoder.ts';
import {
  Car,
  Users,
  Bell,
  RotateCw,
  Server,
  ChevronDown,
  Trash2,
  Radio,
  Settings,
  LockKeyhole, Eye, EyeOff, LogIn, ShieldCheck, Wifi, LogOut,
} from 'lucide-react';

function CompanyFleetOverview({devices,onSelect}:{devices:DeviceInfo[];onSelect:(id:string)=>void}){
 const el=React.useRef<HTMLDivElement>(null),map=React.useRef<L.Map|null>(null),layer=React.useRef<L.LayerGroup|null>(null),fitted=React.useRef(false);
 const [rows,setRows]=useState<{imei:string;t:TelemetrySnapshot|null;events:{code:string;description:string;severity:string}[];failed:boolean}[]>([]);
 const [drivers,setDrivers]=useState<{devices:string[];driverName?:string;displayName:string;vehicleType?:string}[]>([]);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/admin/users',{cache:'no-store'});if(!r.ok)return;const a=await r.json();if(active)setDrivers(Array.isArray(a.users)?a.users:[])}catch{}};void load();const timer=setInterval(load,10000);return()=>{active=false;clearInterval(timer)}},[]);
 const vehicleLabel=(imei:string,fallback?:string)=>{const u=drivers.find(x=>x.devices?.includes(imei));return {car:u?.vehicleType||fallback||imei,driver:u?.driverName||u?.displayName||'سائق غير مسجل'}};
 const [group,setGroup]=useState('الكل');
 const groupNames=['الإدارة','النقل','الخدمات الميدانية','التوزيع','غير مصنفة'];
 const groupOf=(imei:string)=>({'000000000000901':'الإدارة','000000000000902':'النقل','000000000000903':'الخدمات الميدانية','000000000000904':'التوزيع'} as Record<string,string>)[imei]||'غير مصنفة';
 const visible=devices.filter(d=>group==='الكل'||groupOf(d.imei)===group);
 const ids=devices.map(d=>d.imei).join(',');
 useEffect(()=>{let active=true,busy=false;const load=async()=>{if(busy)return;busy=true;try{const data=await Promise.all(ids.split(',').filter(Boolean).map(async imei=>{try{const [t,e]=await Promise.all([fetch('/api/devices/'+imei+'/latest'),fetch('/api/smart-fleet/'+imei)]);return {imei,t:t.ok?await t.json():null,events:e.ok?(await e.json()).events||[]:[],failed:!t.ok||!e.ok};}catch{return {imei,t:null,events:[],failed:true};}}));if(active)setRows(data);}finally{busy=false;}};void load();const timer=setInterval(load,10000);return()=>{active=false;clearInterval(timer)};},[ids]);
 useEffect(()=>{if(!el.current)return;const m=L.map(el.current).setView([32.8872,13.2084],11);map.current=m;L.control.layers({'التضاريس':L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxNativeZoom:17,maxZoom:19,attribution:'© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)'}),'الشوارع':L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(m)},{},{position:'topright'}).addTo(m);layer.current=L.layerGroup().addTo(m);const ro=new ResizeObserver(()=>m.invalidateSize());ro.observe(el.current);return()=>{ro.disconnect();m.remove();map.current=null;layer.current=null;fitted.current=false};},[]);
 const items=visible.map(d=>{const r=rows.find(x=>x.imei===d.imei);const rec=r?.t?.record;let m=null;try{m=rec?decodeCanMetrics(rec):null}catch{}return {imei:d.imei,d,t:r?.t??null,events:Array.isArray(r?.events)?r.events:[],failed:r?.failed??true,m};});
 useEffect(()=>{fitted.current=false},[group]);
 const faults=items.flatMap(r=>[...r.events,...(r.m?.diagnostic.dtcCodes||[]).map(c=>({code:c.code,description:c.descriptionAr,severity:'warning'}))].map(f=>({...f,d:r.d})));
 useEffect(()=>{const g=layer.current,m=map.current;if(!g||!m)return;g.clearLayers();const bounds:L.LatLngTuple[]=[];for(const r of items){const p=r.t?.record;if(!p||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||(!p.latitude&&!p.longitude))continue;const point:L.LatLngTuple=[p.latitude,p.longitude];bounds.push(point);const color=r.events.some(e=>e.severity==='critical')||(r.m?.engine.coolantTempC??0)>=105?'#ef4444':r.events.length?'#f59e0b':r.d.connected?'#16a34a':'#64748b';const marker=L.circleMarker(point,{radius:11,color:'#fff',weight:2,fillColor:color,fillOpacity:1}).addTo(g);const label=document.createElement('div');const names=vehicleLabel(r.imei,r.d.name);label.dir='rtl';label.style.cssText='text-align:center;font: bold 12px Arial;line-height:1.5;white-space:nowrap;cursor:pointer';const car=document.createElement('div');car.textContent='🚘 '+names.car;const driver=document.createElement('div');driver.textContent=names.driver;driver.style.color='#334155';const speed=document.createElement('div');const km=r.m?.speed.displaySpeedKmH??null;speed.textContent='السرعة: '+(km===null?'—':Math.round(km)+' كم/س')+(r.d.connected&&!r.t?.isStale?'':' (آخر قراءة)');speed.style.color='#0891b2';label.append(car,driver,speed);label.addEventListener('click',()=>onSelect(r.imei));marker.bindTooltip(label,{permanent:true,direction:'top',offset:[0,-10],opacity:1,interactive:true});marker.on('click',()=>onSelect(r.imei));}if(bounds.length&&!fitted.current){m.fitBounds(L.latLngBounds(bounds),{padding:[30,30],maxZoom:14});fitted.current=true}},[rows,devices,onSelect,drivers,group]);
 return <section dir="rtl" className="rounded-2xl border border-slate-700 bg-[#0b1628] p-4 mb-5 text-white space-y-4"><div className="flex items-center gap-3"><Car size={32} className="text-cyan-300"/><div><h2 className="text-2xl font-bold text-cyan-300">ZainFleet AI</h2><p className="text-slate-300">مركز القيادة والتحكم بالأسطول</p></div></div><p className="text-xs text-slate-400">آخر المواقع المتاحة · تحديث كل 10 ثوانٍ · البيانات التجريبية ليست اتصالاً حياً</p><div className="space-y-2"><h3 className="font-bold text-cyan-300">مجموعات الأسطول</h3><p className="text-xs text-slate-400">تصنيف أولي للمركبات المخصصة للعرض؛ بقية المركبات غير مصنفة</p><div className="grid grid-cols-2 gap-2">{['الكل',...groupNames].map(g=><button key={g} onClick={()=>setGroup(g)} className={'rounded-xl border p-3 text-right '+(group===g?'border-cyan-400 bg-cyan-950':'border-slate-700 bg-slate-800')}><b>{g}</b><p>{devices.filter(d=>g==='الكل'||groupOf(d.imei)===g).length} مركبة</p></button>)}</div></div><div className="zf-command-metrics">{[['المركبات',visible.length],['متصلة',visible.filter(d=>d.connected).length],['سجلات الأعطال',faults.length],['بيانات ناقصة',items.filter(r=>r.failed).length],['مركبات بسجلات حرجة',items.filter(r=>r.events.some(e=>e.severity==='critical')).length],['مركبات بلا سجلات حرجة',items.filter(r=>!r.failed&&!r.events.some(e=>e.severity==='critical')).length]].map(([k,v])=><div key={k} className="zf-command-metric"><small>{k}</small><b style={{color:String(k).includes("حرجة")&&!String(k).includes("بلا")?"#f87171":String(k)==="متصلة"?"#4ade80":String(k)==="بيانات ناقصة"?"#fbbf24":"#67e8f9"}}>{v}</b></div>)}</div><div className="grid gap-4 xl:grid-cols-[2fr_1fr]"><div ref={el} style={{height:380,zIndex:0,borderRadius:12}}/><div className="rounded-xl bg-slate-900 p-3 max-h-[380px] overflow-auto"><h3 className="font-bold mb-3">سجل أعطال الأسطول</h3>{faults.length?faults.map((f,i)=><button key={i} className="block w-full text-right p-3 mb-2 rounded-lg bg-slate-800" onClick={()=>onSelect(f.d.imei)}><b className="text-amber-300">{f.code}</b><p>{f.description}</p><small>{vehicleLabel(f.d.imei,f.d.name).car} · {vehicleLabel(f.d.imei,f.d.name).driver}</small></button>):<p>لا توجد أعطال في السجلات المستلمة</p>}</div></div><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">{items.map(r=><button key={r.imei} onClick={()=>onSelect(r.imei)} className="text-right rounded-xl border border-slate-700 p-3 bg-slate-800"><b>{vehicleLabel(r.imei,r.d.name).car}</b><p className="text-sm text-cyan-300">السائق: {vehicleLabel(r.imei,r.d.name).driver}</p><small dir="ltr">{r.imei}</small><div className="text-xs text-slate-300 mt-2">السرعة {r.m?.speed.displaySpeedKmH??'—'} كم/س · الحرارة {r.m?.engine.coolantTempC??'—'}° · الوقود {r.m?.fuel.levelPercent??'—'}%</div><div className="mt-2 text-amber-300">سجلات الأعطال: {r.events.length+(r.m?.diagnostic.dtcCodes?.length||0)}</div>{r.events.map((f,i)=><div key={i} className={'text-xs mt-1 '+(f.severity==='critical'?'text-red-400':'text-amber-300')}>{f.code} — {f.description}</div>)}<small className="text-cyan-300">عرض تفاصيل المركبة ←</small></button>)}</div></section>;
}

function VehicleTrackingReport({imei}:{imei:string}){
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const print=async()=>{if(from&&to&&from>to){setMessage('تحقق من الفترة');return}const w=window.open('','_blank');if(!w){setMessage('اسمح بفتح نافذة الطباعة');return}w.opener=null;setBusy(true);try{const q=new URLSearchParams({limit:'5000'});if(from)q.set('from',new Date(from).toISOString());if(to)q.set('to',new Date(to+'T23:59:59').toISOString());const [h,e]=await Promise.all([fetch('/api/devices/'+imei+'/history?'+q),fetch('/api/smart-fleet/'+imei)]);if(!h.ok||!e.ok)throw Error('تعذر تحميل السجلات');const history:TelemetrySnapshot[]=await h.json();const events=(await e.json()).events as {observed_at:string;code:string;description:string;severity:string}[];const esc=(v:unknown)=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));const tr=(cells:unknown[])=>'<tr>'+cells.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>';const selected=events.filter(f=>(!from||new Date(f.observed_at)>=new Date(from))&&(!to||new Date(f.observed_at)<=new Date(to+'T23:59:59')));w.document.write('<html lang="ar" dir="rtl"><meta charset="utf-8"><style>@page{size:A4;margin:12mm}body{font:12px Arial}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px}thead{display:table-header-group}tr{break-inside:avoid}h1{color:#075985}</style><h1>ZainFleet | تقرير حركة المركبة والأعطال</h1><p>IMEI: '+esc(imei)+' | '+esc(from||'البداية')+' - '+esc(to||'الآن')+'</p><p>حد العرض: آخر 5000 نقطة تتبع وآخر 200 سجل عطل. البيانات التجريبية مميزة في وصف العطل.</p><h2>سجل الحركة ('+history.length+')</h2><table><thead><tr><th>التوقيت</th><th>خط العرض</th><th>خط الطول</th><th>السرعة كم/س</th></tr></thead><tbody>'+history.map(h=>tr([h.record.timestamp,h.record.latitude,h.record.longitude,h.record.speed])).join('')+'</tbody></table><h2>سجل الأعطال ('+selected.length+')</h2><table><thead><tr><th>التوقيت</th><th>الرمز</th><th>الوصف</th><th>الخطورة</th></tr></thead><tbody>'+selected.map(f=>tr([f.observed_at,f.code,f.description,f.severity])).join('')+'</tbody></table></html>');w.document.close();w.focus();w.print();setMessage('اختر حفظ PDF في نافذة الطباعة')}catch(e){w.close();setMessage(String(e))}finally{setBusy(false)}};
 return <section dir="rtl" className="rounded-xl bg-slate-800 text-white p-4 my-4"><h3 className="font-bold">تقرير PDF — حركة التتبع والأعطال</h3><div className="flex flex-wrap gap-3 my-3"><label>من <input className="bg-slate-900 p-2" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>إلى <input className="bg-slate-900 p-2" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div><button disabled={busy} className="bg-cyan-700 rounded-xl px-4 py-3" onClick={()=>void print()}> {busy?'تحميل السجلات…':'طباعة / حفظ PDF'}</button><p>{message}</p></section>
}

function CompanyVehicleDetail({device,onBack}:{device:DeviceInfo;onBack:()=>void}){
 const [driver,setDriver]=useState<{displayName:string;driverName?:string;phone?:string;vehicleType?:string;chassisNumber?:string;plateNumber?:string}|null>(null);
 const [history,setHistory]=useState<TelemetrySnapshot[]>([]);
 const [latest,setLatest]=useState<TelemetrySnapshot|null>(null);
 useEffect(()=>{let active=true,busy=false;setLatest(null);const load=async()=>{if(busy)return;busy=true;try{const r=await fetch('/api/devices/'+device.imei+'/latest',{cache:'no-store'});const value=r.ok?await r.json():null;if(active)setLatest(value)}catch{if(active)setLatest(null)}finally{busy=false}};void load();const timer=setInterval(load,2000);return()=>{active=false;clearInterval(timer)}},[device.imei]);
 const metrics=React.useMemo(()=>{try{return latest?.imei===device.imei&&latest.record?decodeCanMetrics(latest.record):null}catch{return null}},[latest,device.imei]);
 const [error,setError]=useState('');
 const el=React.useRef<HTMLDivElement>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const [u,h]=await Promise.all([fetch('/api/admin/users'),fetch('/api/devices/'+device.imei+'/history?limit=1000')]);if(!u.ok||!h.ok)throw Error('تعذر تحميل بيانات السائق أو الحركة');const [a,b]=await Promise.all([u.json(),h.json()]);if(active){setDriver((a.users||[]).find((x:{devices:string[]})=>x.devices.includes(device.imei))||null);setHistory(Array.isArray(b)?b:[]);setError('')}}catch(e){if(active)setError(String(e))}};void load();const timer=setInterval(load,10000);return()=>{active=false;clearInterval(timer)}},[device.imei]);
 useEffect(()=>{if(!el.current)return;const m=L.map(el.current).setView([32.8872,13.2084],11);L.control.layers({'التضاريس':L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxNativeZoom:17,maxZoom:19,attribution:'© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)'}),'الشوارع':L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(m)},{},{position:'topright'}).addTo(m);const points=history.slice().sort((a,b)=>a.record.timestampMs-b.record.timestampMs).map(h=>[h.record.latitude,h.record.longitude] as L.LatLngTuple).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180&&(p[0]!==0||p[1]!==0));if(points.length){L.polyline(points,{color:'#0891b2',weight:5}).addTo(m);L.circleMarker(points[points.length-1],{radius:10,color:'#fff',fillColor:'#0891b2',fillOpacity:1}).addTo(m);m.fitBounds(L.latLngBounds(points),{padding:[30,30],maxZoom:16})}return()=>{m.remove()}},[history]);
 return <section dir="rtl" className="space-y-4 text-white"><button className="bg-cyan-700 rounded-xl p-3" onClick={onBack}>← العودة إلى الأسطول</button><div className="rounded-xl bg-slate-800 p-4"><h2 className="text-xl font-bold text-cyan-300">{driver?.vehicleType||device.name||device.imei}</h2><p dir="ltr">{device.imei}</p><div className="grid grid-cols-2 gap-3 mt-4">{[['السائق',driver?.driverName||driver?.displayName],['الهاتف',driver?.phone],['رقم الهيكل',driver?.chassisNumber],['رقم اللوحة',driver?.plateNumber]].map(([k,v])=><div key={k} className="bg-slate-900 rounded-lg p-3"><small>{k}</small><p>{v||'غير مسجل'}</p></div>)}</div></div><article className="rounded-2xl bg-slate-900 border border-slate-700 p-3 space-y-2"><h3 className="text-cyan-300 font-bold">عداد المركبة والقراءات الفنية</h3><p className="text-xs text-slate-300">{latest?'آخر قراءة: '+new Date(latest.receivedAt).toLocaleString('ar-LY'):'لا توجد قراءة متاحة'} · {device.connected&&!latest?.isStale?'اتصال TCP قائم':'آخر بيانات محفوظة / غير متصلة'}</p><InstrumentCluster speed={metrics?.speed.displaySpeedKmH??null} rpm={metrics?.engine.rpm??null} fuel={metrics?.fuel.levelPercent??null} temperature={metrics?.engine.coolantTempC??null} odometer={metrics?.odometer.totalKm??null} trip={metrics?.odometer.tripKm??null} connected={Boolean(device.connected&&latest&&!latest.isStale)}/></article><h3 className="font-bold">مسار حركة المركبة المختارة</h3><div ref={el} style={{height:320,zIndex:0,borderRadius:12}}/><p>{history.length} نقطة تتبع محفوظة · {device.connected?'متصلة':'آخر بيانات محفوظة'}</p>{error&&<p className="text-amber-300">{error}</p>}<CompanyFleetOverview devices={[device]} onSelect={()=>{}}/><VehicleTrackingReport imei={device.imei}/></section>
}

const DashboardApp: React.FC<{onLogout: () => void; role: 'admin'|'company_admin'|'employee'|'user'; displayName: string}> = ({onLogout,role,displayName}) => {
  const [showCompanyVehicle,setShowCompanyVehicle]=useState(false);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [profileOpen,setProfileOpen]=useState(false);
  const roleLabel = role==='admin'?'المدير العام':role==='company_admin'?'مدير الشركة':role==='employee'?'موظف الشركة':'مستخدم عادي';
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedImei, setSelectedImei] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [serverHealthy, setServerHealthy] = useState<boolean>(true);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [showManageModal, setShowManageModal] = useState<boolean>(false);

  const isAr = lang === 'ar';

  // Check health endpoint
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        setServerHealthy(true);
      } else {
        setServerHealthy(false);
      }
    } catch {
      setServerHealthy(false);
    }
  }, []);

  // Fetch real connected devices from persistent server
  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data: DeviceInfo[] = await res.json();
        setDevices(data);
        if (data.length > 0) {
          setSelectedImei((prev) => (prev && data.some((d) => d.imei === prev) ? prev : data[0].imei));
        } else {
          setSelectedImei(null);
        }
      }
    } catch {
      // Quiet fallback
    }
  }, []);

  // Fetch latest telemetry for selected device
  const fetchTelemetry = useCallback(async (imei: string) => {
    setIsLoadingTelemetry(true);
    try {
      const res = await fetch(`/api/devices/${imei}/latest`);
      if (res.ok) {
        const data: TelemetrySnapshot = await res.json();
        setTelemetry(data);
      } else {
        setTelemetry(null);
      }
    } catch {
      setTelemetry(null);
    } finally {
      setIsLoadingTelemetry(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    checkHealth();
    fetchDevices();
  }, [checkHealth, fetchDevices]);

  // Load telemetry when selected IMEI changes
  useEffect(() => {
    if (selectedImei) {
      fetchTelemetry(selectedImei);
    } else {
      setTelemetry(null);
    }
  }, [selectedImei, fetchTelemetry]);

  // Refresh active telemetry every two seconds; independent of the tracker TCP
  // upload cadence. Do not issue overlapping HTTP polls to a slow Railway instance.
  useEffect(() => {
    let polling = false;
    let disposed = false;
    const refresh = async () => {
      if (polling || disposed || document.visibilityState === 'hidden') return;
      polling = true;
      try {
        await Promise.all([
          fetchDevices(),
          selectedImei ? fetchTelemetry(selectedImei) : Promise.resolve(),
          checkHealth(),
        ]);
      } finally {
        polling = false;
      }
    };
    const interval = window.setInterval(() => { void refresh(); }, 2000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onOnline = () => { void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [fetchDevices, fetchTelemetry, selectedImei, checkHealth]);

  const selectedDevice = devices.find((d) => d.imei === selectedImei) || null;
  const hasRecentAvl = Boolean(selectedDevice?.lastPacketAt && Date.now() - new Date(selectedDevice.lastPacketAt).getTime() < 15 * 60 * 1000);
  const deviceStatusLabel = selectedDevice?.connected ? (isAr ? 'TCP متصل الآن' : 'TCP connected') : hasRecentAvl ? (isAr ? 'بيانات حديثة — TCP مغلق' : 'Recent AVL — TCP closed') : (isAr ? 'لا يوجد اتصال TCP حالياً' : 'No active TCP connection');

  // Vehicle custom friendly name per IMEI
  const [customNames, setCustomNames] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('zainfleet_vehicle_names');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const vehicleName = useMemo(() => {
    if (!selectedDevice) return 'Toyota Fortuner';
    if (customNames[selectedDevice.imei]) return customNames[selectedDevice.imei];
    return selectedDevice.name || 'Toyota Fortuner';
  }, [selectedDevice, customNames]);

  const handleUpdateVehicleName = (newName: string) => {
    if (!selectedDevice) return;
    const updated = { ...customNames, [selectedDevice.imei]: newName };
    setCustomNames(updated);
    try {
      localStorage.setItem('zainfleet_vehicle_names', JSON.stringify(updated));
    } catch {}
  };

  // Compute active alerts count
  const unreadAlertsCount = useMemo(() => {
    let count = 0;
    if (telemetry?.record) {
      const metrics = decodeCanMetrics(telemetry.record);
      count += generateVehicleAlerts(metrics).length;
    }
    if (selectedDevice && !selectedDevice.connected) {
      count += 1;
    }
    return count;
  }, [telemetry, selectedDevice]);

  const liveMetrics = useMemo(() => telemetry?.record && telemetry.imei===selectedImei ? decodeCanMetrics(telemetry.record) : null, [telemetry,selectedImei]);
  const gaugeSpeed = liveMetrics?.speed.displaySpeedKmH ?? null;
  const gaugeRpm = liveMetrics?.engine.rpm ?? null;
  const gaugeFuel = liveMetrics?.fuel.levelPercent ?? null;
  const fuelLiters = liveMetrics?.fuel.levelLiters ?? null;
  const speedSweep = gaugeSpeed === null ? 0 : Math.max(0, Math.min(100, gaugeSpeed / 220 * 100));
  const rpmSweep = gaugeRpm === null ? 0 : Math.max(0, Math.min(100, gaugeRpm / 8000 * 100));
  const fuelSweep = gaugeFuel === null ? 0 : Math.max(0, Math.min(100, gaugeFuel));

  // Safe device management delete
  const handleDeleteDevice = async (imei: string) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من مسح سجلات هذه السيارة؟' : 'Are you sure you want to clear this vehicle data?')) {
      return;
    }
    try {
      await fetch(`/api/devices/${imei}`, { method: 'DELETE' });
      setShowManageModal(false);
      fetchDevices();
    } catch {}
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="zf-fleet-shell zf-reference-shell min-h-screen flex flex-col font-sans pb-16 lg:pb-0"
    >
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        serverHealthy={serverHealthy}
        activeDevice={selectedDevice}
        vehicleName={vehicleName}
        unreadAlertsCount={unreadAlertsCount}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        lang={lang}
        setLang={setLang}
      />

      {/* Mobile Slide-Out Drawer matching Screen 8 in Mockup */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        device={selectedDevice}
        vehicleName={vehicleName}
        unreadAlertsCount={unreadAlertsCount}
        serverHealthy={serverHealthy}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Container */}
      <main className="zf-page zf-fleet-page zf-reference-page flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8">

        {/* Compact mobile top navigation, separate from the desktop toolbar. */}
        <header className="zf-mobile-topnav" dir={isAr ? 'rtl' : 'ltr'}>
          <button type="button" className="zf-mobile-brand" onClick={() => setCurrentTab('dashboard')} aria-label={isAr ? 'الرئيسية' : 'Home'}>
            <Car size={22} />
            <span><strong>ZainFleet AI</strong><small>{isAr ? 'إدارة الأسطول الذكية' : 'Smart fleet management'}</small></span>
          </button>
          <div className="zf-mobile-top-actions">{(role==='admin'||role==='company_admin')&&<button type="button" onClick={()=>setCurrentTab('access-control')} aria-label="إدارة المستخدمين" title="إدارة المستخدمين"><Users size={19}/></button>}
            <button type="button" className={currentTab === 'map' ? 'active' : ''} onClick={() => setCurrentTab('map')} aria-label={isAr ? 'التتبع المباشر' : 'Live map'} title={isAr ? 'التتبع المباشر' : 'Live map'}><Radio size={19} /></button>
            <button type="button" className={currentTab === 'alerts' ? 'active zf-mobile-alert-btn' : 'zf-mobile-alert-btn'} onClick={() => setCurrentTab('alerts')} aria-label={isAr ? 'التنبيهات' : 'Alerts'} title={isAr ? 'التنبيهات' : 'Alerts'}><Bell size={19} />{unreadAlertsCount > 0 && <i>{unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}</i>}</button>
            <button type="button" onClick={() => setProfileOpen(true)} aria-label="الملف الشخصي" title="الملف الشخصي"><Settings size={19} /></button>
            <button type="button" className="zf-mobile-logout" onClick={onLogout} title={isAr ? 'تسجيل الخروج' : 'Log out'}><LogOut size={17} /><span>{isAr ? 'خروج' : 'Logout'}</span></button>
          </div>
        </header>
        <div className="zf-login-toolbar"><span>FMB140 • ADMIN CONSOLE</span><button type="button" onClick={onLogout}><LogOut size={15} /> تسجيل الخروج</button></div>

        <div className="zf-pixel-topbar">
          <div className="zf-pixel-brand"><Car size={46}/><strong>نظام تتبع المركبات</strong><small>Vehicle Tracking System</small></div>
          <nav aria-label="التنقل الرئيسي">{([['dashboard','الرئيسية','⌂'],['map','التتبع المباشر','◎'],['vehicle-profiles','المركبات','▣'],['alerts','التنبيهات','♧'],['smart-fleet','الصيانة الذكية','⚒'],['diagnostics','الأعطال','⚒'],['trips','الرحلات','▤'],['fleet-reports','تقارير PDF','▤'],['users','المستخدمون','♙'],['sensors','الإعدادات','⚙']] as const).filter(([tab])=>(tab!=='users'&&tab!=='vehicle-profiles')||role!=='user').map(([tab,label,icon])=><button type="button" key={tab} className={currentTab===tab?'active':''} onClick={()=>setCurrentTab(tab)}><b>{icon}</b><span>{label}</span>{tab==='alerts'&&unreadAlertsCount>0&&<i>{unreadAlertsCount}</i>}</button>)}</nav>
          <div className="zf-pixel-account"><button type="button" onClick={()=>setProfileOpen(true)} title="الملف الشخصي">{displayName||roleLabel}</button><button type="button" onClick={onLogout} title="تسجيل الخروج"><LogOut size={18}/></button></div>
        </div>
        <div className="zf-ref-shell">
          <aside className="zf-ref-menu zf-pixel-sidebar" aria-label="لوحات التحكم">
            <h3>لوحات التحكم حسب الصلاحيات</h3>
            <button type="button" className={role==='admin'?'zf-pixel-role selected':'zf-pixel-role'} onClick={()=>setCurrentTab('dashboard')}><span>♛</span><strong>المدير العام<small>لوحة شاملة لجميع الشركات والمركبات</small></strong></button>
            <button type="button" className={role==='company_admin'?'zf-pixel-role selected':'zf-pixel-role'} onClick={()=>setCurrentTab(role==='user'?'dashboard':'vehicle-profiles')}><span>▥</span><strong>مدير شركة<small>إدارة مركبات الشركة والتقارير</small></strong></button>
            <button type="button" className={role==='user'?'zf-pixel-role selected':'zf-pixel-role'} onClick={()=>setCurrentTab('map')}><span>♟</span><strong>مستخدم عادي<small>تتبع المركبات المصرح بها</small></strong></button>
            <div className="zf-pixel-side-bottom"><Radio size={48}/><strong>ZAINFLEET</strong><small>GPS • CAN • FLEET</small></div>
          </aside>
          <div className="zf-ref-workspace">
            <div className="zf-ref-title"><span>♛</span> لوحة التحكم - {roleLabel}</div>
 <section className="my-3 rounded-2xl border border-slate-700 bg-slate-900 p-3 text-slate-100" dir="rtl">
 <div className="flex items-center justify-between gap-2 mb-3"><strong>ZainFleet AI</strong><span className="text-xs text-cyan-300">{devices.length} مركبة مسجلة</span></div>
 <label className="block text-xs text-slate-400 mb-1">المركبة المختارة</label>
 <select aria-label="اختيار المركبة" className="w-full rounded-xl border border-slate-600 bg-slate-800 p-3 text-white" value={selectedImei||''} onChange={e=>setSelectedImei(e.target.value||null)}><option value="">اختر مركبة</option>{devices.map(d=><option key={d.imei} value={d.imei}>{customNames[d.imei]||d.name||d.imei} — {d.connected?'متصلة':'غير متصلة'}</option>)}</select>
 <nav className="grid grid-cols-3 gap-2 mt-3">{[['dashboard','الرئيسية'],...(role==='company_admin'?[['access-control','إدارة المستخدمين']]:[]),['smart-fleet','الصيانة'],['vehicle','الحالة الفنية'],['map','التتبع'],['alerts','التنبيهات'],['trips','الرحلات'],['fleet-reports','تقارير PDF']].map(([tab,label])=><button key={tab} type="button" onClick={()=>{if(tab==='dashboard')setShowCompanyVehicle(false);setCurrentTab(tab)}} className={'rounded-xl border p-2 text-xs font-bold '+(currentTab===tab?'border-cyan-400 bg-cyan-900 text-white':'border-slate-700 bg-slate-800 text-slate-200')}>{label}</button>)}</nav>
 </section>
            {role==='company_admin'&&currentTab==='dashboard'&&showCompanyVehicle&&devices.find(d=>d.imei===selectedImei)&&<CompanyVehicleDetail key={selectedImei} device={devices.find(d=>d.imei===selectedImei)!} onBack={()=>{setShowCompanyVehicle(false);window.scrollTo(0,0)}}/>}
{role==='company_admin'&&currentTab==='dashboard'&&!showCompanyVehicle&&<CompanyFleetOverview devices={devices} onSelect={id=>{setSelectedImei(id);setShowCompanyVehicle(true);setCurrentTab('dashboard');window.scrollTo(0,0)}}/>}
            {currentTab==='dashboard' && <><div style={{background:'#0b1220',padding:12,borderRadius:12}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,color:'#e2e8f0'}}><strong style={{fontSize:20}}>Fleet Overview | نظرة عامة</strong><small style={{color:'#60a5fa'}}>واجهة 2.1</small></div>

{false&&role==='company_admin'&&showCompanyVehicle&&<div className="flex flex-wrap gap-2 mb-4"><button className="bg-cyan-700 text-white rounded-xl p-3" onClick={()=>setShowCompanyVehicle(false)}>رجوع إلى خريطة الأسطول</button><button className="bg-slate-700 text-white rounded-xl p-3" onClick={()=>setCurrentTab('access-control')}>إدارة المستخدمين</button></div>}
{role!=='company_admin'&&<><section dir="rtl" className="rounded-xl border border-slate-700 bg-[#101827] p-4 mb-5 text-white shadow-lg">
<div className="flex flex-wrap justify-between items-center gap-3 mb-5"><div><p className="text-xs tracking-widest text-cyan-300">ZAINFLEET AI</p><h2 className="text-2xl font-bold">مركز قيادة الأسطول</h2><p className="text-sm text-slate-400">مراقبة الاتصال والحالة التشغيلية</p></div><span className="rounded-full border border-cyan-800 px-3 py-2 text-xs">{serverHealthy?'الخادم يستجيب':'الخادم غير متاح'}</span></div>
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['المركبات المسجلة',devices.length],['المتصلة',devices.filter(d=>d.connected).length],['غير المتصلة',devices.filter(d=>!d.connected).length],['تنبيهات المركبة المختارة',selectedDevice&&telemetry?.imei===selectedDevice.imei?unreadAlertsCount:'—']].map(([label,value])=><div key={label} className="rounded-lg border border-slate-700 bg-[#1b2637] p-4"><p className="text-xs text-slate-400">{label}</p><strong className="text-3xl text-cyan-300">{value}</strong></div>)}</div>
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">{[['diagnostics','التشخيص الفني'],['smart-fleet','الصيانة'],['map','التتبع المباشر'],['fleet-reports','تقارير PDF']].map(([tab,label])=><button key={tab} type="button" onClick={()=>setCurrentTab(tab)} className="rounded-xl border border-cyan-900 bg-slate-800 p-3 text-sm text-white">{label}</button>)}</div>
</section>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%, 340px),1fr))',gap:14,alignItems:'start'}}>
<div style={{display:'grid',gap:14,minWidth:0}}><section style={{gridArea:"auto",minWidth:0,background:"#151e2d",border:"1px solid #29364a",borderRadius:10}} className="zf-pixel-panel zf-pixel-map">
                  <header><span>التتبع المباشر</span><b className={selectedDevice?.connected?'zf-pixel-live':'zf-pixel-muted'}>{selectedDevice?.connected?'● مباشر':'○ غير متصل'}</b></header>
                  <div className="zf-pixel-map-content">{selectedDevice?<TripMap device={selectedDevice} latestTelemetry={telemetry?.imei===selectedDevice.imei?telemetry:null} lang={lang}/>:<div className="zf-pixel-empty">لا توجد مركبات مرتبطة بهذا الحساب</div>}</div>
                  <div className="zf-pixel-map-overlay"><span>{vehicleName}</span><strong>{gaugeSpeed===null?'—':Math.round(gaugeSpeed)+' كم/س'}</strong></div>
                </section><section style={{gridArea:"auto",minWidth:0,background:"#151e2d",border:"1px solid #29364a",borderRadius:10}} className="zf-pixel-panel zf-pixel-trip">
                  <header>معلومات الرحلة الحالية</header>
                  <div className="zf-pixel-metrics"><article><span>◷</span><small>آخر استقبال</small><b>{telemetry?.receivedAt?new Date(telemetry.receivedAt).toLocaleTimeString('ar-LY'):'—'}</b></article><article><span>⌁</span><small>المسافة</small><b>{liveMetrics?.odometer.tripKm==null?'—':liveMetrics.odometer.tripKm.toFixed(1)+' كم'}</b></article><article><span>◉</span><small>السرعة الحالية</small><b>{gaugeSpeed===null?'—':Math.round(gaugeSpeed)+' كم/س'}</b></article></div>
                </section><section style={{gridArea:"auto",minWidth:0,background:"#151e2d",border:"1px solid #29364a",borderRadius:10}} className="zf-pixel-panel zf-pixel-doors">
                  <header><span>حالة الأبواب والشبابيك</span><LockKeyhole size={18}/></header>
                  <div className="zf-pixel-doors-body">
                    <div className="zf-pixel-door-list">{[['الباب الأمامي الأيسر',liveMetrics?.comfort.doors.driverOpen],['الباب الأمامي الأيمن',liveMetrics?.comfort.doors.passengerOpen],['الباب الخلفي الأيسر',liveMetrics?.comfort.doors.rearLeftOpen],['الباب الخلفي الأيمن',liveMetrics?.comfort.doors.rearRightOpen],['غطاء المحرك',liveMetrics?.comfort.doors.hoodOpen],['صندوق الأمتعة',liveMetrics?.comfort.doors.trunkOpen]].map(([name,open],i)=><div key={i}><span>{name}</span><b className={!liveMetrics?.comfort.hasDoorData?'unknown':open?'open':'closed'}>{!liveMetrics?.comfort.hasDoorData?'غير متاح':open?'مفتوح':'مغلق'}</b></div>)}</div>
                    <div className="zf-pixel-topcar"><Car size={90} strokeWidth={1.1}/><small>قراءات CAN</small></div>
                    <div className="zf-pixel-window-list"><span>النافذة الأمامية اليسرى <b>غير متاح</b></span><span>النافذة الأمامية اليمنى <b>غير متاح</b></span><span>النافذة الخلفية اليسرى <b>غير متاح</b></span><span>النافذة الخلفية اليمنى <b>غير متاح</b></span></div>
                  </div>
                </section></div>
<div style={{display:'grid',gap:14,minWidth:0}}><section style={{gridArea:"auto",minWidth:0,background:"#151e2d",border:"1px solid #29364a",borderRadius:10}} className="zf-pixel-panel zf-pixel-gauges">
                  <header><span>العداد الرسمي للسيارة</span><Car size={19}/></header>
                  <InstrumentCluster speed={gaugeSpeed} rpm={gaugeRpm} fuel={gaugeFuel} temperature={liveMetrics?.engine.coolantTempC ?? null} odometer={liveMetrics?.odometer.totalKm ?? null} trip={liveMetrics?.odometer.tripKm ?? null} connected={Boolean(selectedDevice?.connected)} />
                </section><section style={{gridArea:"auto",minWidth:0,background:"#151e2d",border:"1px solid #29364a",borderRadius:10}} className="zf-pixel-panel zf-pixel-health">
                  <header><span>حالة السيارة العامة</span><b className={selectedDevice?.connected?'zf-pixel-live':'zf-pixel-muted'}>{selectedDevice?.connected?'● متصلة':'○ غير متصلة'}</b></header>
                  <div className="zf-pixel-metrics"><article><span>⚡</span><small>البطارية</small><b>{liveMetrics?.electrical.vehicleVoltageV==null?'—':liveMetrics.electrical.vehicleVoltageV.toFixed(1)+' V'}</b></article><article><span>♨</span><small>حرارة المحرك</small><b>{liveMetrics?.engine.coolantTempC==null?'—':liveMetrics.engine.coolantTempC+'°C'}</b></article><article><span>⛽</span><small>الوقود</small><b>{gaugeFuel!==null?Math.round(gaugeFuel)+'%':fuelLiters!==null?fuelLiters.toFixed(1)+' لتر':'غير متاح'}</b></article><article><span>⚙</span><small>المحرك</small><b>{liveMetrics?.ignition.verified?(liveMetrics.ignition.isOn?'يعمل':'متوقف'):'غير متاح'}</b></article></div>
                </section><section style={{gridArea:"auto",minWidth:0,background:"#151e2d",border:"1px solid #29364a",borderRadius:10}} className="zf-pixel-panel zf-pixel-faults">
                  <header><span>أخطاء السيارة (OBD)</span><b className="zf-pixel-warn">⚠</b></header>
                  <div className="zf-pixel-fault-list">{liveMetrics?.diagnostic.dtcCodes?.length?liveMetrics.diagnostic.dtcCodes.slice(0,3).map((fault,i)=><button type="button" key={i} onClick={()=>setCurrentTab('diagnostics')}><b>{fault.code}</b><span>{fault.descriptionAr}</span></button>):<p>لا توجد رموز أعطال مؤكدة من الجهاز</p>}</div>
                  <button className="zf-pixel-action" type="button" onClick={()=>setCurrentTab('diagnostics')}>⚒ تفاصيل الأخطاء والصيانة</button>
                </section><section style={{gridArea:"auto",minWidth:0,background:"#151e2d",border:"1px solid #29364a",borderRadius:10}} className="zf-pixel-panel zf-pixel-alerts">
                  <header><span>أحدث التنبيهات</span><b className="zf-pixel-warn">♟</b></header>
                  <button type="button" onClick={()=>setCurrentTab('alerts')}>{unreadAlertsCount?unreadAlertsCount+' تنبيهات للمركبة المحددة':'لا توجد تنبيهات حالياً'} <span>‹</span></button>
                  <button type="button" onClick={()=>setCurrentTab('alerts')}>عرض سجل التنبيهات <span>‹</span></button>
                </section><section style={{gridArea:"auto",minWidth:0,background:"#151e2d",border:"1px solid #29364a",borderRadius:10}} className="zf-pixel-panel zf-pixel-car">
                  <header><span>{vehicleName}</span><b className={selectedDevice?.connected?'zf-pixel-live':'zf-pixel-muted'}>{selectedDevice?.connected?'متصلة':'غير متصلة'}</b></header>
                  <div className="zf-pixel-car-graphic"><Car size={110} strokeWidth={1.15}/></div>
                  <div className="zf-pixel-car-facts"><span>رقم الجهاز<strong>{selectedDevice?.imei||'—'}</strong></span><span>حالة GPS<strong>{liveMetrics?.gnss.isFixValid?'متاح':'غير متاح'}</strong></span><span>السرعة<strong>{gaugeSpeed===null?'—':Math.round(gaugeSpeed)+' كم/س'}</strong></span></div>
                </section></div>
</div>
<section dir="rtl" className="mt-4 rounded-xl border border-slate-700 bg-[#101827] p-4 text-slate-100">
<div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h2 className="text-lg font-bold">جدول المركبات المباشر</h2><p className="text-xs text-slate-400">اختر مركبة لتحديث الخريطة والعدادات أعلاه</p></div><button type="button" onClick={fetchDevices} className="rounded-lg bg-blue-700 px-3 py-2 text-sm">تحديث</button></div>
<div className="grid gap-4 xl:grid-cols-[2fr_1fr]"><div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead className="bg-slate-800 text-slate-300"><tr>{['المركبة','IMEI','الاتصال','آخر ظهور','التتبع'].map(h=><th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{devices.map(d=><tr key={d.imei} className={'border-b border-slate-700 '+(selectedImei===d.imei?'bg-blue-950':'')}><td className="p-3"><button type="button" onClick={()=>setSelectedImei(d.imei)} className="text-cyan-300 font-bold">{customNames[d.imei]||d.name||d.imei}</button></td><td className="p-3 font-mono">{d.imei}</td><td className={'p-3 '+(d.connected?'text-emerald-400':'text-slate-400')}>{d.connected?'● متصلة':'○ غير متصلة'}</td><td className="p-3 whitespace-nowrap">{d.lastSeen?new Date(d.lastSeen).toLocaleString('ar-LY'):'—'}</td><td className="p-3"><button type="button" className="rounded bg-blue-700 px-2 py-1" onClick={()=>{setSelectedImei(d.imei);setCurrentTab('map')}}>الخريطة</button></td></tr>)}</tbody></table>{!devices.length&&<p className="p-4 text-slate-400">لا توجد مركبات متاحة</p>}</div><aside className="rounded-lg border border-slate-700 bg-slate-900 p-4"><h3 className="font-bold mb-4">حالة الاتصال بالأسطول</h3>{[['متصلة',devices.filter(d=>d.connected).length,'bg-emerald-500'],['غير متصلة',devices.filter(d=>!d.connected).length,'bg-slate-500']].map(([label,count,color])=><div key={label} className="mb-4"><div className="flex justify-between text-sm"><span>{label}</span><b>{count}</b></div><div className="mt-2 h-2 rounded bg-slate-700"><div className={'h-2 rounded '+color} style={{width:devices.length?Number(count)/devices.length*100+'%':'0%'}}/></div></div>)}<button type="button" onClick={()=>setCurrentTab('alerts')} className="text-cyan-300 text-sm">عرض التنبيهات ←</button></aside></div></section>
            {role==='company_admin'&&selectedImei&&<><VehicleTrackingReport key={selectedImei} imei={selectedImei}/><SmartFleet key={'details-'+selectedImei} imei={selectedImei} reportsOnly={true}/></>}
            </>}
            </div></>}
        {/* Multi-vehicle Switcher Bar (only when > 1 vehicle exists) */}
        {devices.length > 1 && selectedDevice && (
          <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Car className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  {isAr ? 'المركبة المحددة:' : 'Selected Vehicle:'}
                </span>
                <div className="relative">
                  <select
                    value={selectedImei || ''}
                    onChange={(e) => setSelectedImei(e.target.value)}
                    className="font-bold text-xs text-slate-900 bg-transparent pr-6 pl-2 py-1 border border-slate-200 rounded-lg cursor-pointer focus:outline-hidden"
                  >
                    {devices.map((d) => (
                      <option key={d.imei} value={d.imei}>
                        {customNames[d.imei] || d.name || `IMEI ${d.imei.slice(-6)}`} {d.connected ? '(Live)' : '(Offline)'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowManageModal(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title={isAr ? 'إدارة المركبة' : 'Manage Vehicle'}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* View 2: Trip History Log matching Screen 3 & 4 in Mockup */}
        {currentTab === 'trips' && (
          <>
            {selectedDevice ? (
              <TripsList device={selectedDevice} lang={lang} />
            ) : (
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} device={selectedDevice || devices[0] || null} lastDataAt={telemetry?.receivedAt || null} />
            )}
          </>
        )}

        {/* View 3: Live Vehicle Map matching Screen 2 in Mockup */}
        {currentTab === 'map' && (
          <>
            {selectedDevice ? (
              <>
                <TodayGpsRoute imei={selectedDevice.imei} lang={lang} />
                <TripMap
                  device={selectedDevice}
                  latestTelemetry={telemetry}
                  lang={lang}
                />
              </>
            ) : (
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} device={selectedDevice || devices[0] || null} lastDataAt={telemetry?.receivedAt || null} />
            )}
          </>
        )}

        {/* View 4: Vehicle Health & CAN Bus dynamics matching Screen 5 in Mockup */}
        {currentTab === 'vehicle' && (
          <>
            {selectedDevice ? (
              <VehicleDataView
                device={selectedDevice}
                telemetry={telemetry}
                isLoading={isLoadingTelemetry}
                onRefresh={() => selectedImei && fetchTelemetry(selectedImei)}
                lang={lang}
              />
            ) : (
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} device={selectedDevice || devices[0] || null} lastDataAt={telemetry?.receivedAt || null} />
            )}
          </>
        )}

        {/* View 5: Vehicle Alerts & Warnings matching Screen 7 in Mockup */}
        {currentTab === 'alerts' && (
          <>
            {selectedDevice ? (
              <AlertsView
                device={selectedDevice}
                telemetry={telemetry}
                lang={lang}
              />
            ) : (
              <WaitingForVehicleCard isAr={isAr} onRefresh={fetchDevices} device={selectedDevice || devices[0] || null} lastDataAt={telemetry?.receivedAt || null} />
            )}
          </>
        )}

        {/* View 6: Detailed CAN Sensors Diagnostic Table matching Screen 6 in Mockup */}
        {currentTab === 'sensors' && (
          <CanSensorsLog telemetry={telemetry} lang={lang} />
        )}

        {/* View 7: FMB140 Packet & CAN/OBD Diagnostics & Log Downloader */}
        {(currentTab === 'smart-fleet'||currentTab==='fleet-reports') && (selectedImei ? <SmartFleet key={selectedImei+currentTab} imei={selectedImei} reportsOnly={currentTab==='fleet-reports'}/> : <section dir="rtl" className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100"><h2 className="text-xl font-bold text-cyan-300">{currentTab==='fleet-reports'?'مركز التقارير':'مركز الصيانة والتشخيص'}</h2><p className="my-3">{devices.length ? 'اختر مركبة من القائمة أعلاه لعرض سجلها.' : 'لا توجد مركبات متاحة لهذا الحساب حالياً. تظهر المركبات المسجلة حتى إذا كانت غير متصلة.'}</p><div className="grid grid-cols-2 gap-3">{['خطط الصيانة','أوامر الإصلاح','الأعطال الفنية','تكاليف الصيانة'].map(t=><div key={t} className="rounded-xl border border-slate-700 bg-slate-800 p-4"><p>{t}</p><strong className="text-2xl text-slate-400">—</strong></div>)}</div><button type="button" onClick={fetchDevices} className="mt-4 rounded-xl bg-cyan-700 px-4 py-3">تحديث قائمة المركبات</button></section>)}
        {currentTab === 'diagnostics' && (
          <><section dir="rtl" className="rounded-3xl border border-cyan-800 bg-gradient-to-br from-slate-950 to-slate-800 p-5 mb-4 text-white"><p className="text-xs text-cyan-300">ZAINFLEET AI / DIAGNOSTICS</p><h2 className="text-2xl font-bold">مركز التشخيص الفني</h2><p className="text-sm text-slate-400">{selectedDevice?vehicleName:'اختر مركبة'} — آخر القراءات المتاحة، وليست تأكيداً لسلامة المركبة</p><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">{[['حرارة المحرك',liveMetrics?.engine.coolantTempC,'°C'],['دورات المحرك',gaugeRpm,'RPM'],['مستوى الوقود',gaugeFuel,'%'],['السرعة',gaugeSpeed,'km/h']].map(([label,value,unit])=><div key={label} className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><p className="text-xs text-slate-400">{label}</p><strong className="text-2xl text-cyan-300">{selectedImei&&telemetry?.imei===selectedImei&&value!=null?value:'—'}</strong><small className="block text-slate-400">{unit}</small></div>)}</div><p className="text-xs mt-3 text-slate-400">{telemetry?.imei===selectedImei&&telemetry?.receivedAt?'آخر استقبال: '+new Date(telemetry.receivedAt).toLocaleString('ar-LY'):'لا توجد قراءة متاحة'}</p><button type="button" onClick={()=>setCurrentTab('smart-fleet')} className="mt-4 rounded-xl bg-cyan-800 px-4 py-3">سجل الأعطال وأوامر الإصلاح</button></section><DiagnosticView device={selectedDevice} lang={lang} /></>
        )}

        {currentTab === 'profile' && <AccountProfile onPasswordChanged={onLogout} />}

        {/* View 8: Privacy Policy */}
        {currentTab === 'privacy' && <PrivacyPolicy />}
        {currentTab === 'access-control' && (role==='company_admin'?<UsersManagement/>:<AccessControl role={role}/>)}
          </div>
        </div>
      </main>

      {profileOpen && <div className="zf-profile-backdrop" role="presentation" onClick={()=>setProfileOpen(false)}><div className="zf-profile-dialog" role="dialog" aria-modal="true" aria-label="الملف الشخصي" onClick={e=>e.stopPropagation()}><button type="button" className="zf-profile-close" onClick={()=>setProfileOpen(false)}>✕ إغلاق</button><AccountProfile onPasswordChanged={onLogout}/></div></div>}

      {/* Fixed Bottom Navigation for Mobile matching all Mockup screens */}
      <BottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        unreadAlertsCount={unreadAlertsCount}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        lang={lang}
      />

      {/* Safe Device Management Modal */}
      {showManageModal && selectedDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {isAr ? 'إدارة المركبة وبيانات التتبع' : 'Vehicle Settings'}
            </h3>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">IMEI:</span>
                <span className="font-mono font-bold text-slate-900">{selectedDevice.imei}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? 'الاسم المعين:' : 'Assigned Name:'}</span>
                <span className="font-bold text-slate-900">{vehicleName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isAr ? 'الحالة:' : 'Connection:'}</span>
                <span className="font-bold text-slate-900">
                  {deviceStatusLabel}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => handleDeleteDevice(selectedDevice.imei)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isAr ? 'مسح بيانات هذه السيارة' : 'Clear vehicle data'}</span>
              </button>

              <button
                onClick={() => setShowManageModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer (Desktop only) */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-slate-500">
          <div>
            &copy; 2026 <span className="font-semibold text-slate-700">ZainFleet CAN</span> &bull;{' '}
            {isAr
              ? 'نظام تتبع المركبات وقراءات كمبيوتر السيارة CAN Bus المباشرة عبر Teltonika FMB140'
              : 'Teltonika FMB140 Live CAN Bus & Vehicle Telemetry'}
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-mono">
              <Radio className="w-3.5 h-3.5 text-blue-600" />
              <span>TCP Port: 5000</span>
            </span>
            <span>&bull;</span>
            <button
              onClick={() => setCurrentTab('privacy')}
              className="text-blue-600 hover:underline"
            >
              {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

const AccountProfile: React.FC<{onPasswordChanged:()=>void}> = ({onPasswordChanged}) => {
  const [profile,setProfile]=useState<{username:string;displayName:string;role:string;companyName?:string|null;email?:string;phone?:string}|null>(null);
  const [current,setCurrent]=useState('');
  const [next,setNext]=useState('');
  const [confirm,setConfirm]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;fetch('/api/auth/profile',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('تعذر تحميل الملف الشخصي');return r.json()}).then(d=>{if(active)setProfile(d)}).catch(()=>{if(active)setMessage('تعذر تحميل بيانات الحساب')});return()=>{active=false}},[]);
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();setMessage('');
    if(next.length<10){setMessage('كلمة المرور يجب أن تحتوي على 10 أحرف على الأقل');return;}
    if(next!==confirm){setMessage('تأكيد كلمة المرور غير مطابق');return;}
    setBusy(true);
    try{
      const r=await fetch('/api/auth/change-password',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:current,newPassword:next})});
      const d=await r.json();
      if(!r.ok){setMessage(d.error||'فشل تغيير كلمة المرور');return;}
      setCurrent('');setNext('');setConfirm('');setMessage('تم الحفظ. يرجى تسجيل الدخول مجدداً.');
      onPasswordChanged();
    }catch{setMessage('تعذر الاتصال بالخادم');}finally{setBusy(false);}
  };
  return <section className="zf-account-profile" dir="rtl">
    <div className="zf-profile-heading"><div className="zf-profile-avatar"><Users size={30}/></div><div><h2>الملف الشخصي</h2><p>بيانات الحساب وأمان تسجيل الدخول</p></div></div>
    <div className="zf-profile-details">
      <div><small>الاسم</small><strong>{profile?.displayName||'جارٍ التحميل...'}</strong></div>
      <div><small>اسم المستخدم</small><strong dir="auto">{profile?.username||'—'}</strong></div>
      <div><small>الصلاحية</small><strong>{profile?.role==='admin'?'مدير النظام':profile?.role==='company_admin'?'مدير شركة':profile?.role==='employee'?'موظف':'مستخدم'}</strong></div>
      {profile?.companyName&&<div><small>الشركة</small><strong>{profile.companyName}</strong></div>}
      {profile?.email&&<div><small>البريد الإلكتروني</small><strong dir="auto">{profile.email}</strong></div>}
      {profile?.phone&&<div><small>الهاتف</small><strong dir="auto">{profile.phone}</strong></div>}
    </div>
    <form className="zf-profile-form" onSubmit={submit}>
      <h3><LockKeyhole size={19}/> تغيير كلمة المرور</h3>
      <label>كلمة المرور الحالية<input type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)}/></label>
      <label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={next} onChange={e=>setNext(e.target.value)}/></label>
      <label>تأكيد كلمة المرور<input type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
      {message&&<p role="status" className="zf-profile-message">{message}</p>}
      <button type="submit" disabled={busy}>{busy?'جارٍ الحفظ...':'حفظ كلمة المرور'}</button>
    </form>
  </section>;
};

interface WaitingProps {
  isAr: boolean;
  onRefresh: () => void;
  device: DeviceInfo | null;
  lastDataAt: string | null;
}

const WaitingForVehicleCard: React.FC<WaitingProps> = ({ isAr, onRefresh, device, lastDataAt }) => {
  const [secondsWaiting, setSecondsWaiting] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsWaiting(s => s + 1);
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const [networkStatus, setNetworkStatus] = useState<{tcpConnectionsSinceStart:number;lastTcpConnectionAt:string|null;lastAvlPacketAt:string|null;tcpPublicHost:string|null;tcpPublicPort:number|null}|null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/health', { cache: 'no-store' });
        if (response.ok && active) {
          const json = await response.json();
          setNetworkStatus({
            tcpConnectionsSinceStart: Number(json.tcpConnectionsSinceStart ?? 0),
            lastTcpConnectionAt: json.lastTcpConnectionAt ?? null,
            lastAvlPacketAt: json.lastAvlPacketAt ?? null,
            tcpPublicHost: json.tcpPublicHost ?? null,
            tcpPublicPort: json.tcpPublicPort ?? null
          });
        }
      } catch { /* retain the last known status */ }
    };
    load();
    const timer = window.setInterval(load, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const [connectionDiagnosis, setConnectionDiagnosis] = useState<{reasonCode:string;reasonAr:string;lastTcpFailure:{code:string;message:string;at:string}|null}|null>(null);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch('/api/connection/diagnostics', { cache: 'no-store' });
        if (response.ok && active) setConnectionDiagnosis(await response.json());
      } catch { /* Network errors are shown by the existing /health state. */ }
    };
    check();
    const timer = window.setInterval(check, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const latestReceivedAt = lastDataAt || device?.lastPacketAt || null;
  const latestMs = latestReceivedAt ? Date.parse(latestReceivedAt) : NaN;
  const ageSeconds = Number.isFinite(latestMs) ? Math.max(0, Math.floor((nowMs - latestMs) / 1000)) : null;
  const duration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(x => String(x).padStart(2, '0')).join(':');
  };
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-3xl mx-auto shadow-xs my-6">
      <div className="w-20 h-20 rounded-3xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-6 shadow-2xs">
        <Car className="w-10 h-10 animate-bounce" />
      </div>

      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
        {isAr
          ? 'في انتظار اتصال سيارتك وجهاز Teltonika FMB140...'
          : 'Waiting for Teltonika FMB140 Vehicle Connection...'}
      </h2>

      <p className="text-sm text-slate-600 mt-2 max-w-xl mx-auto leading-relaxed">
        {isAr
          ? 'السيرفر يستمع لاتصالات TCP. لا تظهر البيانات إلا بعد وصول الجهاز فعلياً وإرسال حزم AVL؛ وتظهر قراءات CAN فقط إذا كان الجهاز موصولاً ومضبوطاً لإرسالها.'
          : 'The server is listening for real-time TCP connections and CAN bus packets (M-CAN & C-CAN). Turn on the vehicle ignition to begin streaming telemetry.'}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 text-center">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="text-xs font-semibold text-slate-500">{isAr ? 'مدة انتظار هذه الشاشة' : 'Waiting on this screen'}</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-blue-700" dir="ltr">{duration(secondsWaiting)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">{isAr ? 'آخر إرسال مسجّل' : 'Last known transmission'}</div>
          <div className="mt-2 font-mono text-lg font-bold text-slate-900" dir="ltr">{ageSeconds === null ? '—' : duration(ageSeconds)}</div>
          <div className="mt-1 text-[11px] text-slate-500">{ageSeconds === null ? (isAr ? 'لا توجد بيانات محفوظة' : 'No saved timestamps') : (isAr ? 'الوقت المنقضي منذ آخر إشارة' : 'Elapsed since last signal')}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold text-slate-500">{isAr ? 'حالة الجهاز' : 'Device state'}</div>
          <div className={`mt-2 text-base font-bold ${device?.connected ? 'text-emerald-700' : 'text-amber-700'}`}>
            {device?.connected ? (isAr ? 'متصل بالخادم' : 'TCP connected') : device ? (isAr ? 'غير متصل الآن' : 'Currently offline') : (isAr ? 'لم يسجل اتصال بعد' : 'Not detected yet')}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{device?.totalRecords ? `${device.totalRecords} ${isAr ? 'سجل AVL مستلم' : 'AVL records received'}` : (isAr ? 'بانتظار بيانات AVL' : 'Awaiting AVL data')}</div>
        </div>
      </div>
      <p className="mt-4 text-xs leading-6 text-slate-500">
        {isAr ? 'يتم فحص الاتصال تلقائياً كل 4 ثوانٍ. العداد يقيس الانتظار، ولا يحدد موعد تشغيل الجهاز؛ يتوقف الإرسال على إعدادات الجهاز والشبكة.' : 'Connection is checked every 4 seconds. This timer shows elapsed waiting, not an exact time until the tracker reconnects.'}
      </p>
      <div className={`mt-5 rounded-2xl border p-4 text-start ${connectionDiagnosis?.reasonCode === 'DATA_RECEIVED' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="mb-2 flex items-center gap-2 font-extrabold text-slate-900">
          <span>{isAr ? 'نتيجة تشخيص الاتصال' : 'Connection diagnosis'}</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-mono" dir="ltr">{connectionDiagnosis?.reasonCode || 'CHECKING'}</span>
        </div>
        <p className="text-sm leading-7 text-slate-800">{connectionDiagnosis
          ? (isAr ? connectionDiagnosis.reasonAr : connectionDiagnosis.reasonCode.replaceAll('_', ' '))
          : (isAr ? 'جاري فحص السيرفر...' : 'Checking connection...')}</p>
        {connectionDiagnosis?.lastTcpFailure && (
          <p className="mt-2 text-xs text-slate-600">
            {isAr ? 'آخر خطأ مسجل:' : 'Last observed error:'} {connectionDiagnosis.lastTcpFailure.code} — {connectionDiagnosis.lastTcpFailure.message}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">{isAr
          ? 'التشخيص يعتمد على ما رآه السيرفر فقط. لا يستطيع كشف أعطال الشريحة أو الشبكة قبل وصول اتصال TCP.'
          : 'Diagnosis is limited to events observed by the server; a device-side cause cannot be proven without incoming traffic.'}</p>
      </div>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-start text-xs leading-7">
        <div className="mb-2 font-bold text-slate-800">{isAr ? 'تشخيص الاتصال من السيرفر' : 'Server-side connection diagnostics'}</div>
        <div>{isAr ? 'اتصالات TCP منذ تشغيل السيرفر:' : 'Inbound TCP connections since startup:'} <strong>{networkStatus?.tcpConnectionsSinceStart ?? '—'}</strong></div>
        <div>{isAr ? 'آخر اتصال TCP:' : 'Last inbound TCP:'} <strong dir="ltr">{networkStatus?.lastTcpConnectionAt ? new Date(networkStatus.lastTcpConnectionAt).toLocaleString() : '—'}</strong></div>
        <div>{isAr ? 'آخر حزمة AVL مفكوكة:' : 'Last decoded AVL packet:'} <strong dir="ltr">{networkStatus?.lastAvlPacketAt ? new Date(networkStatus.lastAvlPacketAt).toLocaleString() : '—'}</strong></div>
        <p className="mt-2 text-slate-500">{networkStatus && networkStatus.tcpConnectionsSinceStart === 0
          ? (isAr ? 'لم يصل أي اتصال TCP لهذه النسخة من السيرفر. تأكد من عنوان ومنفذ Railway TCP Proxy الخارجي.' : 'No TCP traffic has reached this server process. Check the external Railway TCP proxy address and port.')
          : networkStatus?.lastAvlPacketAt
          ? (isAr ? 'وصلت بيانات AVL إلى السيرفر. إذا لم تظهر في اللوحة فتحقق من الجهاز المحدد وسجل البيانات.' : 'AVL data has reached the server. Check selected device and history if the dashboard remains empty.')
          : (isAr ? 'وصل اتصال TCP لكن لم تُفك حزمة AVL حتى الآن. راجع سجل المصافحة وفك الحزم.' : 'TCP traffic arrived but no AVL packet has been decoded yet. Inspect handshake and parsing logs.')}</p>
      </div>
            {/* Connection Info Box */}
      <div className="mt-8 p-5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-700 text-left max-w-lg mx-auto">
        <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-600" />
          <span>{isAr ? 'بيانات اتصال جهاز الـ FMB140 في برنامج Configurator:' : 'Teltonika Configurator Settings:'}</span>
        </h3>

        <p className="mb-3 text-amber-700">{isAr ? "لا تستخدم القيم القديمة؛ يجب مطابقة العنوان والمنفذ الخارجيين من إعدادات Railway TCP Proxy." : "Always match the external endpoint shown in Railway TCP Proxy settings. The internal port 5000 is not the public port."}</p>
        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex justify-between py-1 border-b border-slate-200/60">
            <span className="text-slate-500">Server Domain / IP:</span>
            <span className="font-bold text-slate-900">{networkStatus?.tcpPublicHost || (isAr ? "غير مضبوط — راجع Railway" : "Not configured — check Railway")}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200/60">
            <span className="text-slate-500">Server Port:</span>
            <span className="font-bold text-blue-600">{networkStatus?.tcpPublicPort ? `${networkStatus.tcpPublicPort} (TCP)` : (isAr ? "غير مضبوط" : "Not configured")}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200/60">
            <span className="text-slate-500">Data Protocol:</span>
            <span className="font-bold text-slate-900">Codec 8 / Codec 8 Extended</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500">CAN Bus Wiring:</span>
            <span className="font-bold text-emerald-700">CAN1 (M-CAN) + CAN2 (C-CAN)</span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
        >
          <RotateCw className="w-4 h-4" />
          <span>{isAr ? 'فحص الاتصال وتحديث' : 'Check for Connection'}</span>
        </button>
      </div>
    </div>
  );
};


// Login gate is mounted before the dashboard, so vehicle API polling starts only after authentication.
export const App: React.FC = () => {
  const [auth, setAuth] = useState<'checking' | 'guest' | 'logged-in'>('checking');
  const [account, setAccount] = useState<{role:'admin'|'company_admin'|'employee'|'user';displayName:string}>({role:'admin',displayName:'محمد زين'});
  const [username, setUsername] = useState('Admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => response.ok ? response.json() : {authenticated: false})
      .then(data => { if (active) {setAuth(data.authenticated ? 'logged-in' : 'guest'); if (data.authenticated) setAccount({role:data.role === 'company_admin' ? 'company_admin' : data.role === 'employee' ? 'employee' : data.role === 'user' ? 'user':'admin',displayName:data.displayName||'محمد زين'}); } })
      .catch(() => { if (active) {setAuth('guest');setError('تعذر الاتصال بالخادم. تحقق من تشغيل Railway.');} });
    return () => { active = false; };
  }, []);
  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'تعذر تسجيل الدخول'); return; }
      setAccount({role:data.role === 'company_admin'?'company_admin':data.role === 'employee'?'employee':data.role === 'user'?'user':'admin',displayName:data.displayName||'محمد زين'});setAuth('logged-in'); setPassword('');
    } catch { setError('تعذر الاتصال بالخادم. حاول مرة أخرى.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    try { await fetch('/api/auth/logout', {method: 'POST', credentials: 'same-origin'}); }
    finally { setAuth('guest'); setPassword(''); }
  };
  if (auth === 'checking') return <div className="zf-auth-loading" dir="rtl"><ShieldCheck size={35} /> جاري التحقق من الجلسة...</div>;
  if (auth === 'logged-in') return <DashboardApp onLogout={logout} role={account.role} displayName={account.displayName} />;
  return (
    <main className="zf-mobile-login zf-zain-login" dir="rtl">
      <div className="zf-zain-scene" aria-hidden="true">
        <div className="zf-zain-worldmap" />
        <div className="zf-zain-route"><span className="zf-zain-pin zf-zain-pin-a">●</span><span className="zf-zain-pin zf-zain-pin-b">●</span></div>
        <div className="zf-zain-skyline" />
        <div className="zf-zain-road" />
        <div className="zf-zain-car"><Car size={126} strokeWidth={1.1}/></div>
        <div className="zf-zain-satellite">✦</div>
      </div>
      <div className="zf-zain-login-layout">
        <header className="zf-zain-brand">
          <div className="zf-zain-brand-line"><span className="zf-zain-brand-pin"><Car size={36}/></span><strong>زين</strong></div>
          <p>نظام تتبع وإدارة المركبات</p>
        </header>
        <section className="zf-zain-login-panel">
          <div className="zf-zain-user-icon"><ShieldCheck size={30}/></div>
          <h1>تسجيل الدخول</h1>
          <form onSubmit={login} className="zf-zain-form">
            <div className="zf-zain-field"><input aria-label="البريد الإلكتروني أو اسم المستخدم" id="zf-user" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required placeholder="البريد الإلكتروني" /><span><Bell size={23}/></span></div>
            <div className="zf-zain-field"><input aria-label="كلمة المرور" id="zf-password" type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="كلمة المرور" /><button type="button" aria-label={showPassword?'إخفاء كلمة المرور':'إظهار كلمة المرور'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={24}/>:<Eye size={24}/>}</button><span><LockKeyhole size={23}/></span></div>
            <div className="zf-zain-options"><label><input type="checkbox" defaultChecked /> تذكرني</label><span title="تواصل مع مدير النظام لإعادة تعيين كلمة المرور">نسيت كلمة المرور؟</span></div>
            {error && <p role="alert" className="zf-mobile-login-error">{error}</p>}
            <button type="submit" className="zf-zain-submit" disabled={busy}><LogIn size={23}/>{busy?'جارٍ تسجيل الدخول...':'دخول'}</button>
          </form>
          <div className="zf-zain-features"><span><Radio size={24}/> تتبع مباشر</span><span><Settings size={24}/> تقارير وإحصائيات</span><span><Car size={24}/> إدارة الأسطول</span></div>
        </section>
      </div>
    </main>
  );};
export default App;

