import React,{useEffect,useState} from 'react';
import {Users,Building2,Car,RefreshCw,PlusCircle} from 'lucide-react';
type Role='admin'|'company_admin'|'employee'|'user';
type Company={id:string;name:string;enabled:boolean};
type User={username:string;displayName:string;role:Role;companyId:string|null;devices:string[];email:string;phone:string;vehicleType:string;enabled:boolean};
type Device={imei:string;connected:boolean};
const api=async(url:string,init?:RequestInit)=>{const r=await fetch(url,{credentials:'same-origin',...init,headers:{'Content-Type':'application/json',...init?.headers}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'تعذر إتمام العملية');return d};
export function AccessControl({role}:{role:Role}){
 const [deviceFilter,setDeviceFilter]=useState<'all'|'available'|'used'>('all'),[deviceSearch,setDeviceSearch]=useState('');
 const [users,setUsers]=useState<User[]>([]),[companies,setCompanies]=useState<Company[]>([]),[devices,setDevices]=useState<Device[]>([]),[assignments,setAssignments]=useState<Record<string,string>>({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [companyName,setCompanyName]=useState(''),[selectedCompany,setSelectedCompany]=useState(''),[sector,setSector]=useState('general'),[companyImei,setCompanyImei]=useState('');
 const [username,setUsername]=useState(''),[displayName,setDisplayName]=useState(''),[password,setPassword]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[vehicleType,setVehicleType]=useState(''),[imei,setImei]=useState(''),[newRole,setNewRole]=useState<'company_admin'|'employee'|'user'>(role==='admin'?'company_admin':'employee');
 const load=async()=>{try{const u=await api('/api/admin/users');setUsers(u.users||[]);setCompanies(u.companies||[]);setDevices(u.devices||[]);if(role==='admin'){const c=await api('/api/admin/companies');setAssignments(c.assignments||{});setDevices(c.devices||[]);setCompanies(c.companies||[])}setMessage('')}catch(e){setMessage(String(e))}};
 useEffect(()=>{void load()},[role]);
 const execute=async(fn:()=>Promise<unknown>)=>{setBusy(true);setMessage('');try{await fn();await load();setMessage('تم الحفظ بنجاح')}catch(e){setMessage(e instanceof Error?e.message:'تعذر الحفظ')}finally{setBusy(false)}};
 const reserved=new Set(users.filter(u=>u.enabled).flatMap(u=>u.devices));
 const free=devices.filter(d=>!reserved.has(d.imei) && (role==='admin'?(!assignments[d.imei]):true));
 const deviceRows=devices.map(d=>{
   const owner=users.find(u=>u.enabled&&u.devices.includes(d.imei));
   const company=companies.find(c=>c.id===assignments[d.imei]);
   const used=Boolean(owner||company);
   return {...d,owner,company,used};
 }).filter(d=>(deviceFilter==='all'||(deviceFilter==='used' ? d.used:!d.used))&&
  (d.imei.includes(deviceSearch.trim())||d.owner?.displayName?.toLowerCase().includes(deviceSearch.trim().toLowerCase())||d.company?.name?.toLowerCase().includes(deviceSearch.trim().toLowerCase())));
 const availableCount=devices.filter(d=>!users.some(u=>u.enabled&&u.devices.includes(d.imei))&&!assignments[d.imei]).length;
 const usedCount=devices.length-availableCount;
 const canManage=role==='admin'||role==='company_admin';
 if(!canManage)return <section className="zf-access"><h2>لوحة المستخدم</h2><p>يمكنك متابعة مركباتك المصرح بها من الصفحة الرئيسية.</p></section>;
 return <section className="zf-access" dir="rtl">
  <header className="zf-access-title"><div><h2><Users size={25}/> {role==='admin'?'لوحة مدير عام النظام':'لوحة مدير الشركة'}</h2><p>إدارة الصلاحيات والأجهزة المخصصة دون تكرار IMEI</p></div><button onClick={()=>void load()}><RefreshCw size={17}/> تحديث</button></header>
  <div className="zf-access-stats"><div><strong>{companies.length}</strong><span>الشركات</span></div><div><strong>{users.length}</strong><span>المستخدمون</span></div><div><strong>{devices.length}</strong><span>إجمالي الأجهزة</span></div></div>
  <div className="zf-access-card zf-imei-directory">
    <h3><Car size={19}/> شاشة أجهزة IMEI للتخصيص</h3>
    <div className="zf-imei-summary">
      <button type="button" className={deviceFilter==='all'?'selected':''} onClick={()=>setDeviceFilter('all')}>الكل <strong>{devices.length}</strong></button>
      <button type="button" className={deviceFilter==='available'?'selected':''} onClick={()=>setDeviceFilter('available')}>المتاحة <strong>{availableCount}</strong></button>
      <button type="button" className={deviceFilter==='used'?'selected':''} onClick={()=>setDeviceFilter('used')}>المستخدمة <strong>{usedCount}</strong></button>
    </div>
    <input className="zf-imei-search" type="search" placeholder="بحث برقم IMEI أو اسم المستخدم أو الشركة" value={deviceSearch} onChange={e=>setDeviceSearch(e.target.value)}/>
    <div className="zf-imei-list">
      {deviceRows.map(d=><article key={d.imei} className="zf-imei-item">
        <div><strong dir="ltr">{d.imei}</strong><small>{d.connected?'● الجهاز متصل':'○ الجهاز غير متصل'}</small></div>
        <div><span className={d.used?'zf-imei-used':'zf-imei-free'}>{d.used?'مستخدم / مخصص':'متاح للتخصيص'}</span>
          {d.company&&<small>الشركة: {d.company.name}</small>}
          {d.owner&&<small>المستخدم: {d.owner.displayName}</small>}
          {!d.used&&role==='admin'&&<button type="button" onClick={()=>{setCompanyImei(d.imei);document.getElementById('zf-company-assign')?.scrollIntoView({behavior:'smooth',block:'center'})}}>تخصيص لشركة</button>}
          {!d.used&&role==='company_admin'&&<small>يمكن اختياره عند إضافة موظف</small>}
        </div>
      </article>)}
      {!deviceRows.length&&<p className="zf-imei-empty">لا توجد أجهزة تطابق البحث أو حالة التخصيص.</p>}
    </div>
  </div>
  {role==='admin'&&<div className="zf-access-card"><h3><Building2 size={19}/> إضافة شركة</h3><form onSubmit={e=>{e.preventDefault();void execute(async()=>{await api('/api/admin/companies',{method:'POST',body:JSON.stringify({name:companyName,sector})});setCompanyName('')})}}><input required placeholder="اسم الشركة" value={companyName} onChange={e=>setCompanyName(e.target.value)}/><select value={sector} onChange={e=>setSector(e.target.value)}><option value="general">عام</option><option value="rental">تأجير</option><option value="logistics">نقل وخدمات</option><option value="school">تعليمي</option></select><button disabled={busy}><PlusCircle size={17}/> إضافة شركة</button></form></div>}
  {role==='admin'&&<div id="zf-company-assign" className="zf-access-card"><h3><Car size={19}/> تخصيص جهاز IMEI لشركة</h3><form onSubmit={e=>{e.preventDefault();void execute(async()=>{await api('/api/admin/devices/'+companyImei+'/company',{method:'PUT',body:JSON.stringify({companyId:selectedCompany})});setCompanyImei('')})}}><select required value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}><option value="">اختر الشركة</option>{companies.filter(c=>c.enabled).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select required value={companyImei} onChange={e=>setCompanyImei(e.target.value)}><option value="">اختر IMEI غير مخصص</option>{devices.filter(d=>!assignments[d.imei]).map(d=><option key={d.imei} value={d.imei}>{d.imei}</option>)}</select><button disabled={busy}>تخصيص الجهاز</button></form></div>}
  <div className="zf-access-card"><h3><Users size={19}/> {role==='admin'?'إضافة مدير شركة أو مستخدم عادي':'إضافة موظف شركة'}</h3><form onSubmit={e=>{e.preventDefault();void execute(async()=>{await api('/api/admin/users',{method:'POST',body:JSON.stringify({username,displayName,password,email,phone,vehicleType,role:newRole,companyId:newRole==='company_admin'?selectedCompany:null,devices:imei?[imei]:[]})});setUsername('');setDisplayName('');setPassword('');setEmail('');setPhone('');setVehicleType('');setImei('')})}}>
   {role==='admin'&&<select value={newRole} onChange={e=>setNewRole(e.target.value as 'company_admin'|'user')}><option value="company_admin">مدير عام شركة</option><option value="user">مستخدم عادي</option></select>}
   {role==='admin'&&newRole==='company_admin'&&<select required value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}><option value="">اختر الشركة</option>{companies.filter(c=>c.enabled).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
   <input required placeholder="الاسم الكامل" value={displayName} onChange={e=>setDisplayName(e.target.value)}/>
   <input required placeholder="اسم الدخول (بالإنجليزية)" pattern="[A-Za-z0-9_.-]{3,40}" value={username} onChange={e=>setUsername(e.target.value)}/>
   <input required type="password" minLength={10} placeholder="كلمة المرور الأولية (10 أحرف على الأقل)" value={password} onChange={e=>setPassword(e.target.value)}/>
   <input required placeholder="نوع المركبة" value={vehicleType} onChange={e=>setVehicleType(e.target.value)}/>
   <input required type="tel" placeholder="رقم الهاتف" value={phone} onChange={e=>setPhone(e.target.value)}/>
   <input required type="email" placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)}/>
   <select value={imei} onChange={e=>setImei(e.target.value)}><option value="">بدون جهاز حاليًا</option>{(role==='admin'&&newRole==='company_admin'?devices.filter(d=>assignments[d.imei]===selectedCompany&&!reserved.has(d.imei)):free).map(d=><option key={d.imei} value={d.imei}>{d.imei}</option>)}</select>
   <button disabled={busy}><PlusCircle size={17}/> حفظ المستخدم</button>
  </form></div>
  {message&&<p className="zf-access-message" role="status">{message}</p>}
  <div className="zf-access-card"><h3>المستخدمون المسجلون</h3><div className="zf-access-users">{users.map(u=><article key={u.username}><strong>{u.displayName}</strong><span>{u.role==='company_admin'?'مدير شركة':u.role==='employee'?'موظف':'مستخدم عادي'} · {u.username}</span><small>{u.email} · {u.phone}</small><small>IMEI: {u.devices.join('، ')||'غير مخصص'}</small></article>)}</div></div>
 </section>
}
