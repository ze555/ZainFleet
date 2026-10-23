import React,{useEffect,useState} from 'react';
import {Building2,Users,UserPlus,RefreshCw,ShieldCheck,Car} from 'lucide-react';
type Company={id:string;name:string;enabled:boolean;sector?:'rental'|'logistics'|'school'|'general'};
type Device={imei:string;name?:string};
type ManagedUser={username:string;displayName:string;devices:string[];enabled:boolean;role:'company_admin'|'user';companyId:string|null};
type Accounts={role:'admin'|'company_admin';companyId:string|null;admin:{username:string;displayName:string};users:ManagedUser[];devices:Device[];companies:Company[]};
export const UsersManagement:React.FC=()=>{
 const [data,setData]=useState<Accounts|null>(null);
 const [assignments,setAssignments]=useState<Record<string,string>>({});
 const [companyName,setCompanyName]=useState('');
 const [sector,setSector]=useState<'rental'|'logistics'|'school'|'general'>('general');
 const [username,setUsername]=useState('');
 const [displayName,setDisplayName]=useState('');
 const [password,setPassword]=useState('');
 const [role,setRole]=useState<'company_admin'|'user'>('user');
 const [companyId,setCompanyId]=useState('');
 const [selected,setSelected]=useState<string[]>([]);
 const [message,setMessage]=useState('');
 const [saving,setSaving]=useState(false);
 const api=async(url:string,options?:RequestInit)=>{const r=await fetch(url,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...options?.headers}});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||('HTTP '+r.status));return data;};
 const reload=async()=>{
  try{const result:Accounts=await api('/api/admin/users');setData(result);
   if(result.role==='admin'){const info=await api('/api/admin/companies');setAssignments(info.assignments||{});}
   setCompanyId(previous=>previous||result.companyId||result.companies[0]?.id||'');
  }catch(e){setMessage(String(e));}
 };
 useEffect(()=>{void reload();},[]);
 const createCompany=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{await api('/api/admin/companies',{method:'POST',body:JSON.stringify({name:companyName,sector})});setCompanyName('');setMessage('تمت إضافة الشركة');await reload();}catch(e){setMessage(String(e));}finally{setSaving(false);}};
 const assign=async(imei:string,next:string)=>{try{await api('/api/admin/devices/'+encodeURIComponent(imei)+'/company',{method:'PUT',body:JSON.stringify({companyId:next||null})});await reload();}catch(e){setMessage(String(e));}};
 const create=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{await api('/api/admin/users',{method:'POST',body:JSON.stringify({username,displayName,password,role,companyId:actualCompany||null,devices:selected})});setUsername('');setDisplayName('');setPassword('');setSelected([]);setMessage('تم إنشاء الحساب');await reload();}catch(e){setMessage(String(e));}finally{setSaving(false);}};
 const edit=async(user:ManagedUser,next:Partial<ManagedUser>)=>{try{const isDeviceChange=next.devices!==undefined;await api('/api/admin/users/'+encodeURIComponent(user.username)+(isDeviceChange?'/devices':''),{method:'PUT',body:JSON.stringify(isDeviceChange?{devices:next.devices}:{...user,...next})});setMessage(isDeviceChange?'تم تحديث ربط IMEI بالمستخدم':'تم تحديث المستخدم');await reload();}catch(e){setMessage(String(e));}};
 const isAdmin=data?.role==='admin';
 const actualCompany=isAdmin?(role==='user'?'':companyId):data?.companyId||'';
 const available=(data?.devices||[]).filter(d=>isAdmin ? (actualCompany ? assignments[d.imei]===actualCompany : !assignments[d.imei]) : true);
 return <section dir="rtl" className="max-w-7xl mx-auto space-y-5 pb-14 text-white">
  <div className="rounded-3xl bg-gradient-to-l from-blue-950 via-slate-900 to-cyan-950 p-6 border border-cyan-700 flex justify-between gap-3">
   <div><h2 className="text-2xl font-black flex items-center gap-3"><ShieldCheck/>إدارة الشركات والمستخدمين</h2><p className="text-sm text-slate-300 mt-2">{isAdmin?'المدير العام — إدارة جميع الشركات والصلاحيات':'مدير الشركة — إدارة مستخدمي شركتك وسياراتها فقط'}</p></div>
   <button onClick={()=>void reload()} className="bg-blue-600 rounded-xl px-3 self-center" title="تحديث"><RefreshCw/></button>
  </div>
  {message&&<div role="status" className="rounded-xl bg-slate-800 border border-sky-700 p-3">{message}</div>}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
   <div className="p-4 rounded-2xl bg-[#0a2038] border border-sky-800"><Building2 className="text-cyan-400"/><b className="block text-3xl mt-2">{data?.companies.length||0}</b><small>الشركات المتاحة</small></div>
   <div className="p-4 rounded-2xl bg-[#0a2038] border border-sky-800"><Users className="text-cyan-400"/><b className="block text-3xl mt-2">{data?.users.length||0}</b><small>المستخدمون</small></div>
   <div className="p-4 rounded-2xl bg-[#0a2038] border border-sky-800"><Car className="text-cyan-400"/><b className="block text-3xl mt-2">{data?.devices.length||0}</b><small>السيارات المسموحة</small></div>
  </div>
  {isAdmin&&<div className="grid gap-4 lg:grid-cols-2">
   <form onSubmit={createCompany} className="bg-[#0a2038] rounded-2xl p-5 border border-sky-800 space-y-3"><h3 className="font-bold flex gap-2"><Building2/>إضافة شركة</h3><input required minLength={2} maxLength={100} value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="اسم الشركة" className="w-full rounded-xl p-3 bg-slate-900 border border-sky-700"/><label className="block text-xs">نوع نشاط المؤسسة</label><select value={sector} onChange={e=>setSector(e.target.value as typeof sector)} className="w-full rounded-xl p-3 bg-slate-900 border border-sky-700"><option value="general">شركة عامة / متعددة الأنشطة</option><option value="rental">تأجير سيارات</option><option value="logistics">نقل وشحن</option><option value="school">مدرسة / نقل طلاب</option></select><button disabled={saving} className="rounded-xl px-5 py-3 bg-blue-600 font-bold">حفظ الشركة</button><div className="flex flex-wrap gap-2">{data?.companies.map(c=><span key={c.id} className="px-3 py-1 rounded-full bg-slate-800">{c.name} · {({rental:'تأجير',logistics:'نقل وشحن',school:'مدرسة',general:'عام'} as Record<string,string>)[c.sector||'general']}</span>)}</div></form>
   <div className="bg-[#0a2038] rounded-2xl p-5 border border-sky-800 space-y-3"><h3 className="font-bold flex gap-2"><Car/>المرحلة الأولى — ربط IMEI بالشركة</h3><div className="max-h-56 overflow-y-auto space-y-2">{data?.devices.map(d=><label key={d.imei} className="flex justify-between gap-2 items-center bg-slate-900 p-2 rounded-xl"><span className="text-xs">{d.name||d.imei}</span><select value={assignments[d.imei]||''} onChange={e=>void assign(d.imei,e.target.value)} className="rounded-lg bg-slate-800 border border-sky-700 p-2 text-xs"><option value="">غير مخصصة</option>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}</div></div>
  </div>}
  <div className="grid gap-4 lg:grid-cols-2">
   <form onSubmit={create} className="bg-[#0a2038] rounded-2xl p-5 border border-sky-800 space-y-3">
    <h3 className="font-bold flex items-center gap-2"><UserPlus/>إضافة مستخدم</h3>
    {isAdmin&&<><label className="block text-xs">الشركة (لمدير الشركة فقط)</label><select disabled={role==='user'} required={role==='company_admin'} value={companyId} onChange={e=>{setCompanyId(e.target.value);setSelected([]);}} className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700">{data?.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><label className="block text-xs">نوع الحساب</label><select value={role} onChange={e=>(setRole(e.target.value as 'company_admin'|'user'),setSelected([]))} className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"><option value="company_admin">مدير شركة</option><option value="user">فرد مستقل — يتبعه المدير العام</option></select></>}
    <input required minLength={3} maxLength={40} pattern="[a-zA-Z0-9_.-]{3,40}" placeholder="اسم الدخول" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"/>
    <input required maxLength={100} placeholder="الاسم الكامل" value={displayName} onChange={e=>setDisplayName(e.target.value)} className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"/>
    <input type="password" required minLength={10} placeholder="كلمة المرور (10 أحرف على الأقل)" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"/>
    <fieldset><legend className="text-xs mb-2">اختر أجهزة IMEI التابعة لهذه الشركة</legend><div className="max-h-48 overflow-auto space-y-2">{available.map(d=><label key={d.imei} className="flex gap-2 p-2 rounded-lg bg-slate-900 text-xs"><input type="checkbox" checked={selected.includes(d.imei)} onChange={e=>setSelected(v=>e.target.checked?[...v,d.imei]:v.filter(i=>i!==d.imei))}/>{d.name||d.imei}</label>)}</div></fieldset>
    <button disabled={saving||(role==='company_admin'&&!actualCompany)} className="w-full rounded-xl bg-blue-600 p-3 font-bold">حفظ المستخدم</button>
   </form>
   <div className="bg-[#0a2038] rounded-2xl p-5 border border-sky-800 space-y-3"><h3 className="font-bold flex gap-2"><Users/>المرحلة الثانية — مدير الشركة لموظفيه، والمدير العام للأفراد المستقلين</h3>
    {data?.users.map(user=><article key={user.username} className="rounded-xl p-3 bg-slate-900 border border-sky-800 space-y-2">
      <div className="flex justify-between gap-2"><div><b>{user.displayName}</b><p className="text-xs text-slate-400">{user.username} — {user.role==='company_admin'?'مدير شركة':'مستخدم عادي'}</p></div><label className="text-xs"><input type="checkbox" checked={user.enabled} onChange={e=>void edit(user,{enabled:e.target.checked})}/> مفعّل</label></div>
      <div className="flex flex-wrap gap-2">{(data.devices||[]).filter(d=>!isAdmin||(user.companyId ? assignments[d.imei]===user.companyId : !assignments[d.imei])).map(d=><label key={d.imei} className="text-xs bg-slate-800 p-2 rounded-lg"><input type="checkbox" checked={user.devices.includes(d.imei)} onChange={e=>void edit(user,{devices:e.target.checked?[...user.devices,d.imei]:user.devices.filter(v=>v!==d.imei)})}/> {d.name||d.imei}</label>)}</div>
    </article>)}
   </div>
  </div>
 </section>;
};
