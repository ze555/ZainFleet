import React,{useEffect,useRef,useState} from 'react';
import {Building2,Users,UserPlus,RefreshCw,Car,Phone,Mail,Truck,CheckCircle2,Sparkles} from 'lucide-react';
type Company={id:string;name:string;enabled:boolean;sector?:'rental'|'logistics'|'school'|'general'};
type Device={imei:string;name?:string};
type ManagedUser={username:string;displayName:string;devices:string[];enabled:boolean;role:'company_admin'|'user';companyId:string|null;phone?:string;email?:string;vehicleType?:string;plateNumber?:string};
type Accounts={role:'admin'|'company_admin';companyId:string|null;admin:{username:string;displayName:string};users:ManagedUser[];devices:Device[];companies:Company[]};
export const UsersManagement:React.FC=()=>{
 const [data,setData]=useState<Accounts|null>(null);
 const [assignments,setAssignments]=useState<Record<string,string>>({});
 const [companyName,setCompanyName]=useState('');
 const [sector,setSector]=useState<'rental'|'logistics'|'school'|'general'>('general');
 const [username,setUsername]=useState('');
 const [displayName,setDisplayName]=useState('');
 const [password,setPassword]=useState('');
 const [phone,setPhone]=useState('');
 const [email,setEmail]=useState('');
 const [vehicleType,setVehicleType]=useState('');
 const [plateNumber,setPlateNumber]=useState('');
 const [confirmation,setConfirmation]=useState<string|null>(null);
 const confirmResolver=useRef<((ok:boolean)=>void)|null>(null);
 const confirmAction=(message:string)=>new Promise<boolean>(resolve=>{confirmResolver.current=resolve;setConfirmation(message);});
 const answerConfirmation=(ok:boolean)=>{setConfirmation(null);confirmResolver.current?.(ok);confirmResolver.current=null;};
 const [search,setSearch]=useState('');
 const [editing,setEditing]=useState<string|null>(null);
 const [draft,setDraft]=useState<ManagedUser|null>(null);
 const [profilePassword,setProfilePassword]=useState('');
 const [profilePasswordAgain,setProfilePasswordAgain]=useState('');
 const openProfile=(u:ManagedUser)=>{setEditing(u.username);setDraft({...u});setProfilePassword('');setProfilePasswordAgain('');};
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
 const createCompany=async(e:React.FormEvent)=>{e.preventDefault();if(!await confirmAction('هل تؤكد إنشاء الشركة '+companyName+'؟'))return;setSaving(true);try{await api('/api/admin/companies',{method:'POST',body:JSON.stringify({name:companyName,sector})});setCompanyName('');setMessage('تمت إضافة الشركة');await reload();}catch(e){setMessage(String(e));}finally{setSaving(false);}};
 const assign=async(imei:string,next:string)=>{if(!await confirmAction('تأكيد '+(next?'تخصيص':'سحب')+' IMEI: '+imei+'؟'))return;try{await api('/api/admin/devices/'+encodeURIComponent(imei)+'/company',{method:'PUT',body:JSON.stringify({companyId:next||null})});await reload();}catch(e){setMessage(String(e));}};
 const create=async(e:React.FormEvent)=>{e.preventDefault();if(!await confirmAction('هل تؤكد حفظ '+displayName+' وربط '+selected.length+' جهاز؟'))return;setSaving(true);try{await api('/api/admin/users',{method:'POST',body:JSON.stringify({username,displayName,password,role,companyId:actualCompany||null,devices:selected,phone,email,vehicleType,plateNumber})});setUsername('');setDisplayName('');setPassword('');setPhone('');setEmail('');setVehicleType('');setPlateNumber('');setSelected([]);setMessage('تم إنشاء الحساب');await reload();}catch(e){setMessage(String(e));}finally{setSaving(false);}};
 const edit=async(user:ManagedUser,next:Partial<ManagedUser>)=>{if(!await confirmAction('تأكيد تعديل صلاحيات '+user.displayName+'؟'))return;try{const isDeviceChange=next.devices!==undefined;await api('/api/admin/users/'+encodeURIComponent(user.username)+(isDeviceChange?'/devices':''),{method:'PUT',body:JSON.stringify(isDeviceChange?{devices:next.devices}:{...user,...next})});setMessage(isDeviceChange?'تم تحديث ربط IMEI بالمستخدم':'تم تحديث المستخدم');await reload();}catch(e){setMessage(String(e));}};
 const removeUser=async(user:ManagedUser)=>{
  if(!await confirmAction('حذف حساب '+user.displayName+' نهائياً؟ لن يُحذف أي جهاز IMEI أو سجل رحلة.'))return;
  setSaving(true);
  try{await api('/api/admin/users/'+encodeURIComponent(user.username),{method:'DELETE'});setMessage('تم حذف المستخدم دون حذف بيانات السيارة');await reload();}
  catch(e){setMessage(String(e));}finally{setSaving(false);}
 };
 const saveUser=async()=>{
  if(!draft)return;
  if(!draft.displayName.trim()){setMessage('اسم المستخدم مطلوب');return;}
  if(!await confirmAction('تأكيد حفظ بيانات '+draft.displayName+'؟'))return;
  setSaving(true);
  try{await api('/api/admin/users/'+encodeURIComponent(draft.username),{method:'PUT',body:JSON.stringify(draft)});setEditing(null);setDraft(null);setMessage('تم حفظ بيانات المستخدم');await reload();}
  catch(e){setMessage(String(e));}finally{setSaving(false);}
 };
 const saveProfilePassword=async()=>{
  if(!draft)return;
  if(profilePassword.length<10){setMessage('كلمة المرور يجب أن تكون 10 أحرف على الأقل');return;}
  if(profilePassword!==profilePasswordAgain){setMessage('كلمتا المرور غير متطابقتين');return;}
  if(!await confirmAction('هل تؤكد إعادة تعيين كلمة مرور '+draft.displayName+'؟'))return;
  setSaving(true);
  try{await api('/api/admin/users/'+encodeURIComponent(draft.username)+'/password',{method:'PUT',body:JSON.stringify({password:profilePassword})});setProfilePassword('');setProfilePasswordAgain('');setMessage('تم تغيير كلمة المرور بنجاح');}
  catch(e){setMessage(String(e));}finally{setSaving(false);}
 };
 const isAdmin=data?.role==='admin';
 const actualCompany=isAdmin?(role==='user'?'':companyId):data?.companyId||'';
 const available=(data?.devices||[]).filter(d=>isAdmin ? (actualCompany ? assignments[d.imei]===actualCompany : !assignments[d.imei]) : true);
 const visibleUsers=(data?.users||[]).filter(u=>(u.displayName+' '+u.username+' '+(u.phone||'')).toLowerCase().includes(search.toLowerCase()));
 return <section dir="rtl" className="max-w-7xl mx-auto space-y-6 pb-16 text-white">
  <div className="rounded-[2rem] bg-gradient-to-br from-[#073b66] via-[#071b35] to-[#0a1428] p-7 sm:p-9 border border-cyan-500/30 shadow-2xl shadow-cyan-950/40 flex justify-between gap-3">
   <div><h2 className="text-2xl font-black flex items-center gap-3"><Sparkles className="text-cyan-300"/>{isAdmin?'مركز القيادة وإدارة الأسطول':'بوابة إدارة أسطول الشركة'}</h2><p className="text-sm text-slate-300 mt-2">{isAdmin?'المدير العام — إدارة جميع الشركات والصلاحيات':'مدير الشركة — إدارة مستخدمي شركتك وسياراتها فقط'}</p></div>
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
   <div className="bg-[#0a2038] rounded-2xl p-5 border border-sky-800 space-y-3"><h3 className="font-bold flex gap-2"><Car className="text-cyan-300"/>توزيع IMEI — للمدير العام فقط</h3><p className="text-xs text-slate-400">تخصيص الأجهزة حصرًا للمدير العام، مع تأكيد كل عملية.</p><div className="max-h-56 overflow-y-auto space-y-2">{data?.devices.map(d=><label key={d.imei} className="flex justify-between gap-2 items-center bg-slate-900 p-2 rounded-xl"><span className="text-xs">{d.name||d.imei}</span><select value={assignments[d.imei]||''} onChange={e=>void assign(d.imei,e.target.value)} className="rounded-lg bg-slate-800 border border-sky-700 p-2 text-xs"><option value="">غير مخصصة</option>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}</div></div>
  </div>}
  <div className="grid gap-4 lg:grid-cols-2">
   <form onSubmit={create} className="bg-[#0a2038] rounded-2xl p-5 border border-sky-800 space-y-3">
    <h3 className="font-bold flex items-center gap-2 text-lg"><UserPlus className="text-cyan-300"/>{isAdmin?'إنشاء حساب جديد':'إضافة سائق إلى شركتك'}</h3>
    {isAdmin&&<><label className="block text-xs">الشركة (لمدير الشركة فقط)</label><select disabled={role==='user'} required={role==='company_admin'} value={companyId} onChange={e=>{setCompanyId(e.target.value);setSelected([]);}} className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700">{data?.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><label className="block text-xs">نوع الحساب</label><select value={role} onChange={e=>(setRole(e.target.value as 'company_admin'|'user'),setSelected([]))} className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"><option value="company_admin">مدير شركة</option><option value="user">فرد مستقل — يتبعه المدير العام</option></select></>}
    <input required minLength={3} maxLength={40} pattern="[a-zA-Z0-9_.-]{3,40}" placeholder="اسم الدخول" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"/>
    <input required maxLength={100} placeholder="الاسم الكامل" value={displayName} onChange={e=>setDisplayName(e.target.value)} className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"/>
    <input type="password" required minLength={10} placeholder="كلمة المرور (10 أحرف على الأقل)" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"/>
    {!isAdmin&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs text-slate-300 flex flex-col gap-2"><span className="flex gap-2 items-center"><Phone size={15}/>رقم الهاتف</span><input type="tel" maxLength={35} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="09xxxxxxxx" className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"/></label><label className="text-xs text-slate-300 flex flex-col gap-2"><span className="flex gap-2 items-center"><Mail size={15}/>البريد الإلكتروني</span><input type="email" maxLength={150} value={email} onChange={e=>setEmail(e.target.value)} placeholder="driver@example.com" className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"/></label><label className="text-xs text-slate-300 flex flex-col gap-2 sm:col-span-2"><span className="flex gap-2 items-center"><Truck size={15}/>نوع السيارة</span><input maxLength={100} value={vehicleType} onChange={e=>setVehicleType(e.target.value)} placeholder="سوناتا / شاحنة / حافلة" className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"/></label><label className="text-xs text-slate-300 flex flex-col gap-2 sm:col-span-2"><span>رقم لوحة السيارة</span><input maxLength={40} value={plateNumber} onChange={e=>setPlateNumber(e.target.value)} placeholder="رقم لوحة المركبة" className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"/></label></div>}
    <fieldset><legend className="text-xs mb-2">اختر أجهزة IMEI التابعة لهذه الشركة</legend><div className="max-h-48 overflow-auto space-y-2">{available.map(d=><label key={d.imei} className="flex gap-2 p-2 rounded-lg bg-slate-900 text-xs"><input type="checkbox" checked={selected.includes(d.imei)} onChange={e=>setSelected(v=>e.target.checked?[...v,d.imei]:v.filter(i=>i!==d.imei))}/>{d.name||d.imei}</label>)}</div></fieldset>
    <button disabled={saving||(isAdmin&&role==='company_admin'&&!actualCompany)} className="w-full rounded-xl bg-gradient-to-l from-cyan-500 to-blue-700 hover:from-cyan-400 hover:to-blue-600 disabled:opacity-50 p-3.5 font-bold shadow-lg flex items-center justify-center gap-2"><CheckCircle2 size={18}/>{saving?'جارٍ الحفظ...':isAdmin?'تأكيد وحفظ الحساب':'تأكيد وإضافة السائق'}</button>
   </form>
   <div className="bg-[#0a2038] rounded-2xl p-5 border border-sky-800 space-y-3"><h3 className="font-bold flex gap-2"><Users className="text-cyan-300"/>{isAdmin?'الحسابات والمديرون':'السائقون وأجهزتهم'}</h3><input aria-label="بحث عن مستخدم" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف أو اسم الدخول..." className="w-full bg-slate-900 p-3 rounded-xl border border-sky-700"/>
    {visibleUsers.map(user=><article key={user.username} className="rounded-xl p-3 bg-slate-900 border border-sky-800 space-y-2">
      <div className="flex justify-between gap-2"><div><b>{user.displayName}</b><p className="text-xs text-slate-400">{user.username} — {user.role==='company_admin'?'مدير شركة':isAdmin?'فرد مستقل':'سائق'}</p>{(user.phone||user.email||user.vehicleType||user.plateNumber)&&<div className="text-xs text-slate-300 flex flex-wrap gap-x-4 gap-y-1 mt-2">{user.phone&&<span>☎ {user.phone}</span>}{user.email&&<span>✉ {user.email}</span>}{user.vehicleType&&<span>🚘 {user.vehicleType}</span>}{user.plateNumber&&<span>رقم اللوحة: {user.plateNumber}</span>}</div>}</div><label className="text-xs"><input type="checkbox" checked={user.enabled} onChange={e=>void edit(user,{enabled:e.target.checked})}/> مفعّل</label></div>
      <div className="flex gap-2 flex-wrap"><button type="button" className="px-3 py-2 text-xs rounded-xl bg-sky-700 font-bold" onClick={()=>openProfile(user)}>عرض الملف الشخصي</button>{user.role==='user'&&<button type="button" disabled={saving} className="px-3 py-2 text-xs rounded-xl bg-rose-800 font-bold" onClick={()=>void removeUser(user)}>حذف المستخدم</button>}</div>
      <div className="flex flex-wrap gap-2">{(data.devices||[]).filter(d=>!isAdmin||(user.companyId ? assignments[d.imei]===user.companyId : !assignments[d.imei])).map(d=><label key={d.imei} className="text-xs bg-slate-800 p-2 rounded-lg"><input type="checkbox" checked={user.devices.includes(d.imei)} onChange={e=>void edit(user,{devices:e.target.checked?[...user.devices,d.imei]:user.devices.filter(v=>v!==d.imei)})}/> {d.name||d.imei}</label>)}</div>
    </article>)}
   </div>
  </div>
  {editing && draft && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-6" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="zf-profile-title" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] border border-cyan-400/50 bg-gradient-to-bl from-[#123c61] via-[#0b213c] to-[#070f20] shadow-[0_0_90px_rgba(14,165,233,.2)] p-5 sm:p-7 space-y-5">
      <div className="flex justify-between items-start gap-3"><div><p className="text-cyan-300 text-xs font-bold">ZAINFLEET · USER PROFILE</p><h3 id="zf-profile-title" className="font-black text-2xl mt-2">{draft.displayName}</h3><p className="text-slate-300 text-sm mt-1">@{draft.username} · {draft.role==='company_admin'?'مدير شركة':'مستخدم / سائق'}</p></div><button type="button" onClick={()=>{setEditing(null);setDraft(null);setProfilePassword('');setProfilePasswordAgain('');}} className="rounded-xl bg-slate-800 border border-sky-800 px-4 py-2">إغلاق ×</button></div>
      <div className="flex flex-wrap gap-2"><span className="rounded-xl bg-sky-900/60 px-3 py-2 text-xs">الحالة: {draft.enabled?'مفعّل':'موقوف'}</span><span className="rounded-xl bg-sky-900/60 px-3 py-2 text-xs">الأجهزة المخصصة: {draft.devices.length}</span><span className="rounded-xl bg-sky-900/60 px-3 py-2 text-xs">اسم الدخول: {draft.username}</span></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {([['displayName','الاسم الكامل'],['phone','رقم الهاتف'],['email','البريد الإلكتروني'],['vehicleType','نوع السيارة'],['plateNumber','رقم لوحة السيارة']] as const).map(([field,label])=><label key={field} className="flex flex-col gap-2 text-xs text-slate-200">{label}<input type={field==='email'?'email':'text'} maxLength={field==='email'?150:field==='displayName'||field==='vehicleType'?100:field==='phone'?35:40} className="bg-[#06162a] border border-sky-700 rounded-xl p-3 text-white" value={draft[field]||''} onChange={e=>setDraft(x=>x?{...x,[field]:e.target.value}:x)}/></label>)}
      </div>
      <div className="border border-sky-700/50 rounded-2xl bg-slate-950/40 p-4 space-y-2">
        <h4 className="font-bold text-cyan-200">أجهزة IMEI المخصصة للمستخدم</h4>
        {draft.devices.length?draft.devices.map(d=><span key={d} className="inline-block ml-2 mt-2 rounded-lg bg-sky-900/60 px-3 py-2 text-xs">{d}</span>):<p className="text-slate-400 text-sm">لا توجد أجهزة مخصصة</p>}
        <p className="text-xs text-slate-400">لتعديل الأجهزة استخدم قائمة التخصيص الخاصة بالشركة.</p>
      </div>
      <button type="button" disabled={saving} onClick={()=>void saveUser()} className="w-full rounded-xl bg-gradient-to-l from-blue-700 to-cyan-500 font-bold p-3 disabled:opacity-50">تأكيد حفظ بيانات المستخدم</button>
      <div className="border-t border-sky-700/50 pt-5 space-y-3"><h4 className="text-lg font-black text-cyan-200">تغيير كلمة المرور</h4><p className="text-xs text-slate-400">كلمة المرور القديمة لا يمكن عرضها. يمكنك تعيين كلمة جديدة فقط.</p>
       <input type="password" autoComplete="new-password" minLength={10} maxLength={256} value={profilePassword} onChange={e=>setProfilePassword(e.target.value)} placeholder="كلمة مرور جديدة (10 أحرف على الأقل)" className="w-full rounded-xl bg-[#06162a] border border-sky-700 p-3"/>
       <input type="password" autoComplete="new-password" minLength={10} maxLength={256} value={profilePasswordAgain} onChange={e=>setProfilePasswordAgain(e.target.value)} placeholder="تأكيد كلمة المرور الجديدة" className="w-full rounded-xl bg-[#06162a] border border-sky-700 p-3"/>
       <button type="button" disabled={saving} onClick={()=>void saveProfilePassword()} className="w-full rounded-xl border border-cyan-400 bg-sky-900 p-3 font-bold disabled:opacity-50">تأكيد تغيير كلمة المرور</button>
      </div>
    </div>
  </div>}
  {confirmation && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-5" role="presentation">
    <div role="alertdialog" aria-modal="true" aria-labelledby="zf-confirm-title" className="w-full max-w-md rounded-[2rem] border border-cyan-500/60 bg-gradient-to-br from-[#103d62] via-[#081e39] to-[#071122] p-6 text-white shadow-[0_0_75px_rgba(3,174,255,.2)]">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-sky-400/50 bg-sky-500/20"><CheckCircle2 size={28} className="text-cyan-300"/></div>
      <h3 id="zf-confirm-title" className="text-xl font-black">تأكيد العملية</h3>
      <p className="my-4 text-sm leading-8 text-slate-200">{confirmation}</p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" autoFocus onClick={()=>answerConfirmation(false)} className="rounded-xl border border-sky-700 bg-[#122c48] p-3 font-bold">إلغاء</button>
        <button type="button" onClick={()=>answerConfirmation(true)} className="rounded-xl border border-cyan-400 bg-gradient-to-l from-blue-600 to-cyan-500 p-3 font-bold shadow-lg">تأكيد الحفظ</button>
      </div>
    </div>
  </div>}
 </section>;
};
