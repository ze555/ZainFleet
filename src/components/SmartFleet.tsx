import React,{useEffect,useState} from 'react';
type Part={id:string;part_name:string;quantity:number;unit_cost:number};
type Row={parts?:Part[];id:string;title?:string;description?:string;due_at?:string;observed_at?:string;status?:string;labor_cost?:string;parts_cost?:string;code?:string;severity?:string};
type Data={plans:Row[];orders:Row[];events:Row[];canEdit:boolean};
const statuses:Record<string,string>={open:'مفتوح',in_progress:'قيد الإصلاح',completed:'مكتمل',cancelled:'ملغى'};
function printReport(imei:string,data:Data,kind:string){
 const win=window.open('','_blank');if(!win){window.alert('يرجى السماح بالنوافذ المنبثقة للطباعة');return;}
 const esc=(v:unknown)=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
 const table=(headers:string[],rows:unknown[][])=>'<table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 const money=(v:unknown)=>Number(v||0).toFixed(3);
 const active=data.orders.filter(o=>o.status!=='cancelled');
 const total=active.reduce((n,o)=>n+Number(o.labor_cost||0)+Number(o.parts_cost||0),0);
 const sections=[
 ['plans','جدول الصيانة',table(['الخطة','الموعد'],data.plans.map(p=>[p.title,p.due_at?new Date(p.due_at).toLocaleDateString('ar-LY'):'—']))],
 ['orders','أوامر الإصلاح والتكاليف',table(['الأمر','الحالة','العمالة','القطع','الإجمالي'],data.orders.map(o=>[o.title,statuses[o.status||'open'],money(o.labor_cost),money(o.parts_cost),money(Number(o.labor_cost||0)+Number(o.parts_cost||0))]))+'<p>إجمالي الأوامر غير الملغاة المعروضة: '+money(total)+' د.ل</p>'],
 ['parts','قطع الغيار',table(['الأمر','القطعة','الكمية','سعر الوحدة','الإجمالي'],data.orders.flatMap(o=>(o.parts||[]).map(p=>[o.title,p.part_name,p.quantity,money(p.unit_cost),money(p.quantity*p.unit_cost)])))],
 ['events','سجل الأعطال',table(['الكود','الوصف','الخطورة','التاريخ'],data.events.map(o=>[o.code,o.description,o.severity,o.observed_at?new Date(o.observed_at).toLocaleString('ar-LY'):'—']))]
 ];
 win.opener=null;win.document.open();win.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>ZainFleet AI - Report</title><style>@page{size:A4;margin:15mm}body{font:14px Arial,sans-serif;color:#12263b}header{border-bottom:3px solid #0891b2;padding:12px 0}h1{margin:0;color:#075985}h2{background:#eaf4f8;padding:8px;font-size:16px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #cbd5e1;padding:7px;overflow-wrap:anywhere}th{background:#e2e8f0}tr{break-inside:avoid}thead{display:table-header-group}footer{margin-top:32px;display:flex;justify-content:space-around}button{padding:10px}@media print{button{display:none}}</style></head><body><header><h1>ZainFleet AI</h1><p>منظومة إدارة الأسطول الذكية | تقرير المركبة</p></header><p>IMEI: '+esc(imei)+' | تاريخ الإصدار: '+esc(new Date().toLocaleString('ar-LY'))+'</p><p>التقرير يعرض السجلات المحملة (حتى 200 لكل قسم)، وليس جميع السجلات التاريخية.</p>'+sections.filter(x=>kind==='all'||x[0]===kind).map(x=>'<h2>'+x[1]+'</h2>'+x[2]).join('')+'<footer><span>إعداد التقرير: __________</span><span>الاعتماد: __________</span></footer></body></html>');win.document.close();win.focus();win.print();
}
export function SmartFleet({imei,reportsOnly=false}:{imei:string;reportsOnly?:boolean}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,refresh]=useState(0);
 const [kind,setKind]=useState('plans'),[title,setTitle]=useState(''),[date,setDate]=useState(''),[code,setCode]=useState(''),[severity,setSeverity]=useState('unknown');
 const [reportKind,setReportKind]=useState('all');
 const url='/api/smart-fleet/'+encodeURIComponent(imei);
 useEffect(()=>{const c=new AbortController();setError('');fetch(url,{signal:c.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error('تعذر تحميل بيانات الصيانة');return r.json()}).then(d=>{if(!c.signal.aborted)setData(d)}).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort()},[url,revision]);
 async function save(path:string,method:string,body:unknown){setBusy(true);setError('');try{const r=await fetch(url+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('تعذر الحفظ ('+r.status+')');refresh(n=>n+1);return true}catch(e){setError(e instanceof Error?e.message:'تعذر الحفظ');return false}finally{setBusy(false)}}
 const panel='rounded-2xl border border-cyan-900/70 bg-gradient-to-br from-slate-900 to-slate-950 p-5 text-slate-100 shadow-lg';
 const field='w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white';
 const button='rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white disabled:opacity-50';
 return <section dir="rtl" className="space-y-4 text-slate-100">
 <header className={panel+" border-cyan-700/70"}><h2 className="text-xl font-bold">{reportsOnly?'ZainFleet AI | مركز التقارير':'ZainFleet AI | مركز الصيانة'}</h2><p className="text-slate-400 text-sm">IMEI: {imei} — سجل الصيانة والتشخيص الفني</p><button className={button} onClick={()=>refresh(n=>n+1)}>تحديث</button></header>
 {error&&<p role="alert" className="text-red-400">{error}</p>}
 {!data?<p>جاري تحميل البيانات...</p>:<>
 <article className={panel}><h3 className="font-bold text-cyan-300 mb-3">مركز التقارير والطباعة</h3><div className="grid gap-2 sm:grid-cols-2"><select aria-label="نوع التقرير" className={field} value={reportKind} onChange={e=>setReportKind(e.target.value)}><option value="all">تقرير شامل للمركبة</option><option value="plans">جدول الصيانة</option><option value="orders">الإصلاحات والتكاليف</option><option value="parts">قطع الغيار</option><option value="events">الأعطال الفنية</option></select><button type="button" className={button} onClick={()=>printReport(imei,data,reportKind)}>طباعة / حفظ PDF</button></div><p className="text-xs text-slate-400 mt-2">اختر حفظ بصيغة PDF من نافذة الطباعة.</p></article>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['خطط الصيانة',data.plans.length],['أوامر مفتوحة',data.orders.filter(x=>x.status==='open'||x.status==='in_progress').length],['سجل الأعطال',data.events.length],['تكلفة الأوامر المعروضة',data.orders.reduce((n,x)=>n+Number(x.labor_cost||0)+Number(x.parts_cost||0),0).toFixed(3)+' د.ل']].map(([label,value])=><article key={label} className={panel}><p className="text-slate-400">{label}</p><strong className="text-xl text-cyan-300">{value}</strong></article>)}</div>
 {!reportsOnly&&data.canEdit&&<form className={panel+' space-y-3'} onSubmit={async e=>{e.preventDefault();if(await save('/'+kind,'POST',{title,dueAt:date?new Date(date+'T00:00:00').toISOString():undefined,code,severity})){setTitle('');setCode('')}}}>
 <h3 className="font-bold">إضافة سجل</h3><select className={field} value={kind} onChange={e=>setKind(e.target.value)}><option value="plans">خطة صيانة</option><option value="orders">أمر إصلاح</option><option value="events">عطل يدوي</option></select>
 <input className={field} required maxLength={300} placeholder="العنوان أو وصف العطل" value={title} onChange={e=>setTitle(e.target.value)}/>
 {kind==='plans'&&<input aria-label="موعد الصيانة" className={field} type="date" required value={date} onChange={e=>setDate(e.target.value)}/>}
 {kind==='events'&&<><input className={field} placeholder="كود العطل إن توفر" value={code} onChange={e=>setCode(e.target.value)}/><select className={field} value={severity} onChange={e=>setSeverity(e.target.value)}><option value="unknown">غير محدد</option><option value="info">معلومة</option><option value="warning">تحذير</option><option value="critical">حرج</option></select></>}
 <button className={button} disabled={busy}>حفظ</button></form>}
 {!reportsOnly&&<><article className={panel}><h3 className="font-bold mb-3">جدول الصيانة</h3>{!data.plans.length&&<p>لا توجد خطط مسجلة</p>}{data.plans.map(p=><div className="border-t border-slate-700 py-3" key={p.id}>{p.title} — {p.due_at?new Date(p.due_at).toLocaleDateString('ar-LY'):'—'} {p.due_at&&Date.parse(p.due_at)<Date.now()&&<span className="text-amber-400">موعد مستحق (راجع حالة التنفيذ)</span>}</div>)}</article>
 <article className={panel}><h3 className="font-bold mb-3">أوامر الإصلاح</h3>{!data.orders.length&&<p>لا توجد أوامر</p>}{data.orders.map(o=><Order key={o.id+':'+revision} row={o} editable={data.canEdit} busy={busy} save={save} field={field} button={button}/>)}</article>
 <article className={panel}><h3 className="font-bold mb-3">الأعطال المسجلة</h3>{!data.events.length&&<p>لا توجد أعطال مسجلة؛ لا يعني ذلك سلامة المركبة.</p>}{data.events.map(o=><div key={o.id} className="border-t border-slate-700 py-3"><strong>{o.code||'بدون كود'} — {o.description}</strong><p>{o.severity} · {o.observed_at?new Date(o.observed_at).toLocaleString('ar-LY'):''}</p></div>)}</article>
 </>}
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
