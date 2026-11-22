import React,{useEffect,useState} from 'react';
type Part={id:string;part_name:string;quantity:number;unit_cost:number};
type Row={parts?:Part[];id:string;title?:string;description?:string;due_at?:string;observed_at?:string;status?:string;labor_cost?:string;parts_cost?:string;code?:string;severity?:string};
type Data={plans:Row[];orders:Row[];events:Row[];canEdit:boolean};
const statuses:Record<string,string>={open:'مفتوح',in_progress:'قيد الإصلاح',completed:'مكتمل',cancelled:'ملغى'};
export function SmartFleet({imei}:{imei:string}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,refresh]=useState(0);
 const [kind,setKind]=useState('plans'),[title,setTitle]=useState(''),[date,setDate]=useState(''),[code,setCode]=useState(''),[severity,setSeverity]=useState('unknown');
 const url='/api/smart-fleet/'+encodeURIComponent(imei);
 useEffect(()=>{const c=new AbortController();setError('');fetch(url,{signal:c.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error('تعذر تحميل بيانات الصيانة');return r.json()}).then(d=>{if(!c.signal.aborted)setData(d)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[url,revision]);
 async function save(path:string,method:string,body:unknown){setBusy(true);setError('');try{const r=await fetch(url+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('تعذر الحفظ ('+r.status+')');refresh(n=>n+1);return true}catch(e){setError(e instanceof Error?e.message:'تعذر الحفظ');return false}finally{setBusy(false)}}
 const panel='rounded-2xl border border-slate-700 bg-slate-900 p-4 text-slate-100';
 const field='w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white';
 const button='rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white disabled:opacity-50';
 return <section dir="rtl" className="space-y-4 text-slate-100">
 <header className={panel}><h2 className="text-xl font-bold">ZainFleet AI | مركز الصيانة</h2><p className="text-slate-400 text-sm">IMEI: {imei} — سجل الصيانة والتشخيص الفني</p><button className={button} onClick={()=>refresh(n=>n+1)}>تحديث</button></header>
 {error&&<p role="alert" className="text-red-400">{error}</p>}
 {!data?<p>جاري تحميل البيانات...</p>:<>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['خطط الصيانة',data.plans.length],['أوامر مفتوحة',data.orders.filter(x=>x.status==='open'||x.status==='in_progress').length],['سجل الأعطال',data.events.length],['تكلفة الأوامر المعروضة',data.orders.reduce((n,x)=>n+Number(x.labor_cost||0)+Number(x.parts_cost||0),0).toFixed(3)+' د.ل']].map(([label,value])=><article key={label} className={panel}><p className="text-slate-400">{label}</p><strong className="text-xl text-cyan-300">{value}</strong></article>)}</div>
 {data.canEdit&&<form className={panel+' space-y-3'} onSubmit={async e=>{e.preventDefault();if(await save('/'+kind,'POST',{title,dueAt:date?new Date(date+'T00:00:00').toISOString():undefined,code,severity})){setTitle('');setCode('')}}}>
 <h3 className="font-bold">إضافة سجل</h3><select className={field} value={kind} onChange={e=>setKind(e.target.value)}><option value="plans">خطة صيانة</option><option value="orders">أمر إصلاح</option><option value="events">عطل يدوي</option></select>
 <input className={field} required maxLength={300} placeholder="العنوان أو وصف العطل" value={title} onChange={e=>setTitle(e.target.value)}/>
 {kind==='plans'&&<input aria-label="موعد الصيانة" className={field} type="date" required value={date} onChange={e=>setDate(e.target.value)}/>}
 {kind==='events'&&<><input className={field} placeholder="كود العطل إن توفر" value={code} onChange={e=>setCode(e.target.value)}/><select className={field} value={severity} onChange={e=>setSeverity(e.target.value)}><option value="unknown">غير محدد</option><option value="info">معلومة</option><option value="warning">تحذير</option><option value="critical">حرج</option></select></>}
 <button className={button} disabled={busy}>حفظ</button></form>}
 <article className={panel}><h3 className="font-bold mb-3">جدول الصيانة</h3>{!data.plans.length&&<p>لا توجد خطط مسجلة</p>}{data.plans.map(p=><div className="border-t border-slate-700 py-3" key={p.id}>{p.title} — {p.due_at?new Date(p.due_at).toLocaleDateString('ar-LY'):'—'} {p.due_at&&Date.parse(p.due_at)<Date.now()&&<span className="text-amber-400">موعد مستحق (راجع حالة التنفيذ)</span>}</div>)}</article>
 <article className={panel}><h3 className="font-bold mb-3">أوامر الإصلاح</h3>{!data.orders.length&&<p>لا توجد أوامر</p>}{data.orders.map(o=><Order key={o.id+':'+revision} row={o} editable={data.canEdit} busy={busy} save={save} field={field} button={button}/>)}</article>
 <article className={panel}><h3 className="font-bold mb-3">الأعطال المسجلة</h3>{!data.events.length&&<p>لا توجد أعطال مسجلة؛ لا يعني ذلك سلامة المركبة.</p>}{data.events.map(o=><div key={o.id} className="border-t border-slate-700 py-3"><strong>{o.code||'بدون كود'} — {o.description}</strong><p>{o.severity} · {o.observed_at?new Date(o.observed_at).toLocaleString('ar-LY'):''}</p></div>)}</article>
 <p className="text-xs text-slate-400">تعرض الشاشة آخر 200 سجل لكل قسم. التشخيص اليدوي لا يمثل قراءة مباشرة من السيارة.</p></>}
 </section>
}
function Order({row,editable,busy,save,field,button}:{row:Row;editable:boolean;busy:boolean;save:(p:string,m:string,b:unknown)=>Promise<boolean>;field:string;button:string}){
 const [status,setStatus]=useState(row.status||'open'),[cost,setCost]=useState(row.labor_cost||'0');
 const [name,setName]=useState(''),[qty,setQty]=useState('1'),[price,setPrice]=useState('');
 return <div><form className="border-t border-slate-700 py-3 space-y-2" onSubmit={e=>{e.preventDefault();void save('/orders/'+row.id,'PATCH',{status,laborCost:Number(cost)})}}><strong>{row.title}</strong><p>{statuses[row.status||'open']} | قطع الغيار: {row.parts_cost||0} د.ل</p>{editable&&<div className="grid gap-2 sm:grid-cols-3"><select className={field} value={status} onChange={e=>setStatus(e.target.value)}>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><input className={field} aria-label="تكلفة العمالة" type="number" min="0" max="99999999999" step=".001" required value={cost} onChange={e=>setCost(e.target.value)}/><button className={button} disabled={busy}>تحديث الأمر</button></div>}</form>
 <div className="space-y-2 text-sm">{(row.parts||[]).map(p=><div key={p.id} className="bg-slate-800 rounded-lg p-2">{p.part_name} × {p.quantity} — {(p.quantity*p.unit_cost).toFixed(3)} د.ل</div>)}</div>
 {editable&&(row.status==='open'||row.status==='in_progress')&&<form className="grid gap-2 py-3 sm:grid-cols-4" onSubmit={async e=>{e.preventDefault();if(await save('/orders/'+row.id+'/parts','POST',{name,quantity:Number(qty),unitCost:Number(price)})){setName('');setPrice('')}}}><input className={field} required maxLength={200} placeholder="اسم قطعة الغيار" value={name} onChange={e=>setName(e.target.value)}/><input aria-label="الكمية" className={field} type="number" required min=".001" step=".001" value={qty} onChange={e=>setQty(e.target.value)}/><input aria-label="سعر الوحدة" className={field} type="number" required min="0" step=".001" placeholder="سعر الوحدة" value={price} onChange={e=>setPrice(e.target.value)}/><button className={button} disabled={busy}>إضافة قطعة</button></form>}</div>
}
