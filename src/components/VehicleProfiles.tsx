import React,{useEffect,useState} from 'react';
import {CarFront,Save,Search,RefreshCw,UserRound,Phone,Hash,Truck} from 'lucide-react';
type Profile={name:string;model:string;driverName:string;plateNumber:string;phoneNumber:string};
type Vehicle={imei:string;connected:boolean;profile:Profile|null};
const blank:Profile={name:'',model:'',driverName:'',plateNumber:'',phoneNumber:''};
export const VehicleProfiles:React.FC=()=>{
 const [vehicles,setVehicles]=useState<Vehicle[]>([]);
 const [imei,setImei]=useState('');
 const [profile,setProfile]=useState<Profile>({...blank});
 const [query,setQuery]=useState('');
 const [role,setRole]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const reload=async()=>{try{const res=await fetch('/api/admin/vehicle-profiles',{credentials:'same-origin',cache:'no-store'});if(!res.ok)throw Error('لا يمكن جلب السيارات');const data=await res.json();setVehicles(data.vehicles||[]);setRole(data.role||'');}catch(e){setMessage(String(e));}};
 useEffect(()=>{void reload();},[]);
 const select=(v:Vehicle)=>{setImei(v.imei);setProfile(v.profile?{...v.profile}:{...blank});setMessage('');};
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setMessage('');try{
  const res=await fetch('/api/admin/vehicle-profiles/'+encodeURIComponent(imei),{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});
  const body=await res.json().catch(()=>({}));if(!res.ok)throw Error(body.error||'فشل الحفظ');
  setMessage('تم حفظ بيانات المركبة وربطها برقم IMEI');await reload();
 }catch(e){setMessage(String(e));}finally{setBusy(false);}};
 const visible=vehicles.filter(v=>[v.imei,v.profile?.name,v.profile?.plateNumber,v.profile?.driverName].some(x=>(x||'').toLowerCase().includes(query.toLowerCase())));
 const field=(key:keyof Profile,label:string,placeholder:string,required=false)=><label className="block text-sm font-bold text-cyan-100">{label}<input required={required} value={profile[key]} onChange={e=>setProfile(p=>({...p,[key]:e.target.value}))} maxLength={120} placeholder={placeholder} className="mt-2 block w-full rounded-xl bg-[#07172a] text-white p-3 border border-cyan-800 focus:border-cyan-400 outline-none"/></label>;
 return <section dir="rtl" className="mx-auto max-w-7xl pb-12 space-y-5 text-white">
  <header className="rounded-3xl border border-cyan-600 bg-gradient-to-l from-[#103b60] to-[#05162b] p-6 flex justify-between items-center gap-3">
   <div><h2 className="text-2xl font-black flex items-center gap-2"><CarFront className="text-cyan-300"/> إدارة بيانات المركبات وIMEI</h2><p className="text-sm mt-2 text-cyan-200">{role==='admin'?'المدير العام: مركبات الأفراد المستقلين فقط':'مدير الشركة: المركبات التابعة لشركتك فقط'}</p></div>
   <button type="button" onClick={()=>void reload()} aria-label="تحديث" className="p-3 bg-cyan-700 rounded-xl"><RefreshCw/></button>
  </header>
  {message&&<p role="status" className="p-3 rounded-xl border border-cyan-600 bg-[#0d2b45]">{message}</p>}
  <div className="grid lg:grid-cols-[.95fr_1.05fr] gap-5">
   <aside className="rounded-3xl border border-sky-800 bg-[#081d34] p-5">
    <label className="flex gap-2 items-center bg-[#06172b] border border-sky-800 rounded-xl p-3"><Search size={18}/><input className="bg-transparent outline-none w-full text-white" placeholder="بحث بالاسم أو IMEI أو اللوحة" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <button className="my-4 w-full py-3 rounded-xl border border-cyan-500 text-cyan-200 font-bold" type="button" onClick={()=>{setImei('');setProfile({...blank});setMessage('');}}>+ تسجيل IMEI جديد</button>
    <div className="space-y-2 max-h-[550px] overflow-auto">
     {visible.map(v=><button key={v.imei} type="button" onClick={()=>select(v)} className={`w-full text-right rounded-xl border p-3 ${imei===v.imei?'border-cyan-400 bg-[#174164]':'border-sky-800 bg-[#07172b]'}`}>
      <span className="flex items-center gap-2 font-bold"><Truck size={17} className="text-cyan-400"/>{v.profile?.name||'مركبة غير مسماة'}</span>
      <small className="block mt-1 text-slate-300" dir="ltr">{v.imei}</small>
      <span className={`text-xs ${v.connected?'text-emerald-300':'text-slate-400'}`}>{v.connected?'● متصل':'○ غير متصل'}</span>
     </button>)}
     {!visible.length&&<p className="text-slate-400 text-sm">لا توجد مركبات مطابقة</p>}
    </div>
   </aside>
   <form onSubmit={save} className="rounded-3xl border border-sky-700 bg-[#092340] p-5 space-y-4">
    <h3 className="text-xl font-black">بطاقة بيانات المركبة</h3>
    <label className="block text-sm font-bold text-cyan-100"><Hash size={15} className="inline"/> رقم IMEI (15 رقماً)
     <input required inputMode="numeric" pattern="[0-9]{15}" maxLength={15} value={imei} onChange={e=>setImei(e.target.value.replace(/\D/g,''))} readOnly={vehicles.some(v=>v.imei===imei)} placeholder="أدخل IMEI الموجود على الجهاز" className="mt-2 w-full rounded-xl bg-[#07172a] p-3 border border-cyan-800 text-white font-mono" dir="ltr"/>
    </label>
    <div className="grid sm:grid-cols-2 gap-4">
     {field('name','اسم المركبة','سوناتا / شاحنة / حافلة',true)}
     {field('model','الموديل','Hyundai Sonata 2016')}
     {field('driverName','اسم السائق','الاسم الكامل')}
     {field('plateNumber','رقم اللوحة','لوحة المركبة')}
     {field('phoneNumber','رقم الهاتف','09xxxxxxxx')}
    </div>
    <p className="text-xs text-cyan-200 flex items-center gap-2"><UserRound size={15}/><Phone size={15}/> تتم حماية هذه البيانات حسب صلاحيات المدير والشركة.</p>
    <button type="submit" disabled={busy} className="flex items-center justify-center gap-2 w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black p-3 disabled:opacity-50"><Save size={19}/>{busy?'جارٍ الحفظ...':'حفظ وربط IMEI'}</button>
   </form>
  </div>
 </section>;
};
