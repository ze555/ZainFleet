import React,{useEffect,useState} from 'react';
import {Cpu,RadioTower,ShieldCheck,RefreshCcw,PlusCircle} from 'lucide-react';
type Protocol={id:string;label:string;defaultTransport:string;port:number|null;listenerActive:boolean};
type Registration={imei:string;protocol:string;model:string;gateway:string;transport:string};
export const GpsProtocolManagement:React.FC=()=>{
 const [protocols,setProtocols]=useState<Protocol[]>([]);
 const [registrations,setRegistrations]=useState<Registration[]>([]);
 const [imei,setImei]=useState(''); const [model,setModel]=useState(''); const [protocol,setProtocol]=useState('teltonika');
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 const refresh=async()=>{try{const r=await fetch('/api/admin/gps-protocols',{credentials:'same-origin',cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Access denied');setProtocols(j.protocols||[]);setRegistrations(j.registrations||[]);}catch(e){setNotice(String(e));}};
 useEffect(()=>{void refresh();},[]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(!window.confirm('تأكيد تسجيل الجهاز '+imei+' بنوع '+protocol+'؟'))return;setBusy(true);try{const r=await fetch('/api/admin/gps-protocols/register',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({imei,protocol,model})});const j=await r.json();if(!r.ok)throw Error(j.error||'Save failed');setNotice(j.listenerActive?'تم حفظ الجهاز، مستمع Teltonika يعمل':'تم تسجيل الجهاز فقط. يجب إعداد مستمع البروتوكول في خدمة Traccar قبل وصول البيانات.');setImei('');setModel('');await refresh();}catch(e){setNotice(String(e));}finally{setBusy(false);}};
 const choice=protocols.find(p=>p.id===protocol);
 return <section dir="rtl" className="space-y-5 text-white max-w-6xl mx-auto pb-14">
  <div className="rounded-[2rem] p-7 bg-gradient-to-br from-sky-800 via-slate-900 to-indigo-950 border border-cyan-500/40 shadow-xl"><h2 className="text-2xl font-black flex gap-3 items-center"><RadioTower className="text-cyan-300"/>مركز بروتوكولات GPS</h2><p className="mt-3 text-slate-300 text-sm">تسجيل الأجهزة بحسب البروتوكول، مع فصل محرك Traccar عن Teltonika الحالي</p></div>
  {notice&&<p role="status" className="p-3 bg-sky-950 rounded-xl border border-sky-700">{notice}</p>}
  <div className="grid gap-5 lg:grid-cols-2">
   <form onSubmit={save} className="rounded-2xl p-5 bg-[#091e36] border border-sky-800 space-y-4">
    <h3 className="font-extrabold flex items-center gap-2"><PlusCircle/>إضافة جهاز GPS</h3>
    <label className="block text-sm">IMEI / معرف الجهاز<input required inputMode="numeric" pattern="[0-9]{15}" maxLength={15} value={imei} onChange={e=>setImei(e.target.value)} placeholder="15 رقماً" className="block mt-2 w-full bg-slate-950 border border-sky-700 rounded-xl p-3"/></label>
    <label className="block text-sm">الموديل<input maxLength={100} value={model} onChange={e=>setModel(e.target.value)} placeholder="FMB140 / GT06 ..." className="block mt-2 w-full bg-slate-950 border border-sky-700 rounded-xl p-3"/></label>
    <label className="block text-sm">نوع البروتوكول<select value={protocol} onChange={e=>setProtocol(e.target.value)} className="block mt-2 w-full bg-slate-950 border border-sky-700 rounded-xl p-3">{protocols.map(p=><option value={p.id} key={p.id}>{p.label}</option>)}</select></label>
    <div className="p-3 rounded-xl bg-slate-950 text-sm text-slate-300">المحرك: {protocol==='teltonika'?'ZainFleet Teltonika':'Traccar مستقل'} · النقل المتوقع: {choice?.defaultTransport||'—'}<div className="text-xs mt-2">{choice?.listenerActive?'مستمع Teltonika الحالي متاح':'تسجيل الجهاز لا يشغّل مستمع Traccar تلقائياً'}</div></div>
    <button disabled={busy||!protocols.length} className="w-full rounded-xl p-3 bg-gradient-to-l from-cyan-500 to-blue-700 font-bold disabled:opacity-50">{busy?'جارٍ الحفظ':'تأكيد وإضافة الجهاز'}</button>
   </form>
   <div className="rounded-2xl p-5 bg-[#091e36] border border-sky-800 space-y-3">
    <h3 className="font-extrabold flex items-center gap-2"><Cpu/>الأجهزة المسجلة <button type="button" onClick={()=>void refresh()} className="mr-auto p-2 bg-sky-900 rounded-lg"><RefreshCcw size={17}/></button></h3>
    {registrations.length===0&&<p className="text-slate-400 text-sm">لا توجد أجهزة مسجلة في سجل البروتوكولات حتى الآن.</p>}
    {registrations.map(d=><div key={d.imei} className="p-3 rounded-xl border border-sky-800 bg-slate-950 flex items-center gap-3"><ShieldCheck className="text-cyan-400"/><div className="min-w-0"><strong className="block break-all">{d.imei}</strong><small className="text-slate-400">{d.model||'—'} · {d.protocol} · {d.gateway}</small></div></div>)}
   </div>
  </div>
  <p className="text-sm text-amber-200 bg-amber-950/30 rounded-xl p-3 border border-amber-700/30">تنبيه: لا تبرمج أجهزة غير Teltonika على عنوان ومنفذ FMB140. يجب أولاً نشر Traccar وفتح منفذ TCP/UDP الصحيح لكل بروتوكول، ثم ربط بياناته بـ ZainFleet.</p>
 </section>;
};