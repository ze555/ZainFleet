import React from 'react';
import { VehicleInstrumentGauge } from './VehicleInstrumentGauge.js';

type Props = { speed?:number|null; rpm?:number|null; fuel?:number|null; temperature?:number|null; odometer?:number|null; online:boolean; stale:boolean; readingAgeText?:string; rpmSource?:string; lang:'ar'|'en' };
const MiniGauge:React.FC<{value?:number|null;min:number;max:number;left:string;right:string;label:string;unit:string;warnHigh?:boolean}>=({value,min,max,left,right,label,unit,warnHigh})=>{
 const valid=value!=null&&Number.isFinite(value)&&value>=min&&value<=max;
 const angle=valid?-65+((value!-min)/(max-min))*130:-65;
 return <div className="zf-cluster-mini">
  <div className="zf-cluster-mini-scale"><span>{left}</span><span>{label}</span><span>{right}</span></div>
  <div className="zf-cluster-mini-arc"><div className="zf-cluster-mini-needle" style={{transform:`translateX(-50%) rotate(${angle}deg)`}}/></div>
  <strong className={warnHigh&&valid&&value!>105?'zf-mini-hot':''}>{valid?`${Math.round(value!)}${unit}`:'—'}</strong>
 </div>;
};
export const AutomotiveCluster:React.FC<Props>=({speed,rpm,fuel,temperature,odometer,online,stale,readingAgeText,rpmSource,lang})=>{
 const ar=lang==='ar';
 const validFuel=fuel!=null&&Number.isFinite(fuel)&&fuel>=0&&fuel<=100?fuel:null;
 return <section className="zf-auto-cluster" aria-label={ar?'عدادات السيارة المباشرة':'Live vehicle dashboard'}>
  <div className="zf-auto-cluster-top">
   <span className={online?'zf-auto-live':'zf-auto-offline'}>● {online?(ar?'الجهاز متصل':'ONLINE'):(ar?'آخر بيانات محفوظة':'OFFLINE')}</span>
   <span>{stale?(ar?'قراءات قديمة':'STALE READINGS'):(ar?'بيانات FMB140':'FMB140 DATA')}</span>
  </div>
  <div className="zf-auto-cluster-grid">
   <div className="zf-auto-large-dial">
    <VehicleInstrumentGauge label={ar?'دورات المحرك':'ENGINE RPM'} value={rpm} max={8000} majorStep={1000} divisor={1000} unit="×1000 RPM" accent="amber" stale={stale}/>
   </div>
   <div className="zf-auto-center">
    <div className="zf-auto-minis">
     <MiniGauge value={temperature} min={40} max={120} left="C" right="H" label={ar?'حرارة':'TEMP'} unit="°C" warnHigh/>
     <MiniGauge value={validFuel} min={0} max={100} left="E" right="F" label={ar?'وقود':'FUEL'} unit="%"/>
    </div>
    <div className="zf-auto-lcd">
     <div className="zf-auto-lcd-label">{ar?'لوحة بيانات المركبة':'VEHICLE DATA'}</div>
     <div className="zf-auto-lcd-line"><span>{ar?'السرعة':'SPEED'}</span><b>{speed!=null&&Number.isFinite(speed)?Math.round(speed):'—'} <small>km/h</small></b></div>
     <div className="zf-auto-lcd-line"><span>{ar?'عداد الكيلومترات':'ODOMETER'}</span><b>{odometer!=null&&Number.isFinite(odometer)?Math.round(odometer).toLocaleString():'—'} <small>km</small></b></div>
     <div className="zf-auto-lcd-footer"><span>{ar?'حرارة المحرك':'COOLANT'}: {temperature!=null?`${temperature}°C`:'—'}</span><span>{ar?'الوقود':'FUEL'}: {validFuel!=null?`${Math.round(validFuel)}%`:'—'}</span></div>
    </div>
   </div>
   <div className="zf-auto-large-dial"><VehicleInstrumentGauge label={ar?'عداد السرعة':'SPEEDOMETER'} value={speed} max={240} majorStep={40} unit="km/h" accent="cyan" stale={stale}/></div>
  </div>
  <div className="zf-auto-caption" role="status">{ar?'مصدر RPM':'RPM source'}: {rpmSource||'—'} · {ar?'عمر آخر قراءة':'Reading age'}: {readingAgeText||'—'} · {stale ? (ar?'القراءة قديمة وليست بثاً لحظياً':'Historical reading, not live') : (ar?'قراءة حديثة':'Recent reading')}</div>
  <p className="zf-auto-caption">{ar?'العدادات تعرض البيانات المستلمة فعلياً؛ علامة — تعني عدم توفر القراءة.':'Gauges show only received data; — indicates unavailable readings.'}</p>
 </section>;
};
