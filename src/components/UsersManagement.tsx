import React, { useEffect, useState } from 'react';
import { Users, UserPlus, ShieldCheck, RefreshCw } from 'lucide-react';
import type { DeviceInfo } from '../types/fleet.js';

type ManagedUser = {username:string;displayName:string;devices:string[];enabled:boolean};
type AccountsResponse = {admin:{username:string;displayName:string;devices:string[]};users:ManagedUser[];devices:DeviceInfo[]};

export const UsersManagement: React.FC = () => {
  const [data,setData] = useState<AccountsResponse|null>(null);
  const [username,setUsername] = useState('');
  const [displayName,setDisplayName] = useState('');
  const [password,setPassword] = useState('');
  const [selected,setSelected] = useState<string[]>([]);
  const [message,setMessage] = useState('');
  const [saving,setSaving] = useState(false);
  const reload = async () => {
    try {
      const response=await fetch('/api/admin/users',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok) throw Error('تعذر تحميل الحسابات');
      setData(await response.json());
    } catch(err) {setMessage(String(err));}
  };
  useEffect(()=>{void reload();},[]);
  const create = async (event:React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/admin/users',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,displayName,password,devices:selected})});
      const result=await response.json();
      if(!response.ok) throw Error(result.error||'تعذر إضافة الحساب');
      setUsername('');setDisplayName('');setPassword('');setSelected([]);
      setMessage('تم إنشاء الحساب وتخصيص الأجهزة');await reload();
    }catch(err){setMessage(String(err));}finally{setSaving(false);}
  };
  const changeUser=async (user:ManagedUser, next:Partial<ManagedUser>)=>{
    setMessage('');
    try{
      const response=await fetch('/api/admin/users/'+encodeURIComponent(user.username),{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...user,...next})});
      if(!response.ok) throw Error('تعذر حفظ الصلاحيات');
      await reload();
    }catch(err){setMessage(String(err));}
  };
  return <section dir="rtl" className="space-y-5 max-w-6xl mx-auto pb-12">
    <div className="rounded-3xl border border-cyan-500/40 bg-[#081c34] text-slate-100 p-5 flex justify-between items-center gap-3">
      <div><h2 className="text-xl font-black flex gap-2 items-center"><Users/>إدارة المستخدمين والأجهزة</h2><p className="text-xs text-cyan-200 mt-2">كل مستخدم يرى الأجهزة المخصصة له فقط؛ المدير الرئيسي يرى جميع الأجهزة</p></div>
      <button type="button" onClick={()=>void reload()} className="p-3 rounded-xl bg-blue-600"><RefreshCw size={18}/></button>
    </div>
    {message&&<div role="status" className="p-3 rounded-xl border border-cyan-700 bg-[#0b2943] text-cyan-200 text-sm">{message}</div>}
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={create} className="rounded-3xl bg-[#0a2038] border border-sky-700 p-5 space-y-4 text-white">
        <h3 className="font-extrabold flex items-center gap-2"><UserPlus/>إنشاء حساب جديد</h3>
        <label className="block text-xs">اسم الدخول<input required minLength={3} maxLength={40} pattern="[a-zA-Z0-9_.-]{3,40}" value={username} onChange={e=>setUsername(e.target.value)} className="mt-1 block w-full rounded-xl p-3 bg-[#061427] border border-sky-800" placeholder="user01"/></label>
        <label className="block text-xs">اسم المستخدم<input required maxLength={100} value={displayName} onChange={e=>setDisplayName(e.target.value)} className="mt-1 block w-full rounded-xl p-3 bg-[#061427] border border-sky-800" placeholder="الاسم الكامل"/></label>
        <label className="block text-xs">كلمة المرور (10 أحرف على الأقل)<input type="password" required minLength={10} value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 block w-full rounded-xl p-3 bg-[#061427] border border-sky-800" autoComplete="new-password"/></label>
        <fieldset className="space-y-2"><legend className="text-xs font-bold mb-2">الأجهزة المسموحة</legend>
          {data?.devices.length ? data.devices.map(d=><label key={d.imei} className="flex gap-2 items-center text-sm p-2 bg-[#061427] rounded-lg"><input type="checkbox" checked={selected.includes(d.imei)} onChange={e=>setSelected(x=>e.target.checked?[...x,d.imei]:x.filter(id=>id!==d.imei))}/><span>{d.name||'مركبة'} — <span dir="ltr">{d.imei}</span></span></label>):<p className="text-xs text-amber-300">لا توجد أجهزة مسجلة بعد؛ يمكن إنشاء الحساب دون أجهزة.</p>}
        </fieldset>
        <button disabled={saving} type="submit" className="w-full rounded-xl bg-blue-600 py-3 font-bold disabled:opacity-50">{saving?'جارٍ الحفظ...':'إنشاء المستخدم'}</button>
      </form>
      <div className="rounded-3xl bg-[#0a2038] border border-sky-700 p-5 text-white space-y-4">
        <h3 className="font-extrabold flex gap-2 items-center"><ShieldCheck/>الحسابات والصلاحيات</h3>
        <div className="p-3 bg-[#061427] rounded-xl border border-emerald-800"><strong>{data?.admin.displayName||'محمد زين'}</strong><p className="text-xs text-emerald-300">المدير الرئيسي — جميع الأجهزة — بيانات الدخول الحالية محفوظة</p></div>
        {data?.users.map(user=><div key={user.username} className="border border-sky-800 rounded-xl p-3 space-y-2 bg-[#061427]">
          <div className="flex justify-between gap-2 items-center"><strong>{user.displayName} <small className="text-slate-400">({user.username})</small></strong><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={user.enabled} onChange={e=>void changeUser(user,{enabled:e.target.checked})}/>مفعّل</label></div>
          <p className="text-xs text-slate-400">تخصيص الأجهزة لهذا الحساب:</p>
          <div className="flex flex-wrap gap-2">{data.devices.map(d=><label key={d.imei} className="rounded-lg border border-sky-900 p-2 text-xs flex gap-1 items-center"><input type="checkbox" checked={user.devices.includes(d.imei)} onChange={e=>void changeUser(user,{devices:e.target.checked?[...user.devices,d.imei]:user.devices.filter(id=>id!==d.imei)})}/><span dir="ltr">{d.name||d.imei}</span></label>)}</div>
        </div>)}
      </div>
    </div>
  </section>;
};
