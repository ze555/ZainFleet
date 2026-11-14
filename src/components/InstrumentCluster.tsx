import React from 'react';
type Props = {speed:number|null;rpm:number|null;fuel:number|null;temperature:number|null;odometer:number|null;trip:number|null;connected:boolean};
function Dial({cx,value,max,unit,major}:{cx:number;value:number|null;max:number;unit:string;major:number}) {
 const ticks=Array.from({length:max/major*5+1},(_,i)=>{const v=i*major/5,a=(-210+(v/max)*240)*Math.PI/180;const majorTick=i%5===0;const r1=majorTick?143:151,r2=162;return <line key={i} x1={cx+Math.cos(a)*r1} y1={190+Math.sin(a)*r1} x2={cx+Math.cos(a)*r2} y2={190+Math.sin(a)*r2} stroke={majorTick?'#fff':'#b4bac5'} strokeWidth={majorTick?3:1.4}/>});
 const labels=Array.from({length:max/major+1},(_,i)=>{const v=i*major,a=(-210+(v/max)*240)*Math.PI/180;return <text key={v} x={cx+Math.cos(a)*121} y={194+Math.sin(a)*121} fill="#f5f5f5" fontSize="22" textAnchor="middle" fontFamily="Arial">{v}</text>});
 const angle=(-210+Math.max(0,Math.min(max,value??0))/max*240)*Math.PI/180;
 return <g><circle cx={cx} cy="190" r="174" fill="#050609" stroke="#5d636b" strokeWidth="7"/><circle cx={cx} cy="190" r="166" fill="#08090c" stroke="#b3bac1" strokeWidth="1.5"/>{ticks}{labels}<text x={cx} y="122" fill="#bfc5cd" textAnchor="middle" fontSize="17">{unit}</text><line x1={cx-Math.cos(angle)*24} y1={190-Math.sin(angle)*24} x2={cx+Math.cos(angle)*141} y2={190+Math.sin(angle)*141} stroke="#f12930" strokeWidth="6" strokeLinecap="round" style={{transition:'all .55s ease'}}/><circle cx={cx} cy="190" r="17" fill="#101115" stroke="#1c1c20" strokeWidth="4"/>{value===null&&<text x={cx} y="255" fill="#d1d6df" textAnchor="middle" fontSize="19">—</text>}</g>;
}
export function InstrumentCluster({speed,rpm,fuel,temperature,odometer,trip,connected}:Props){
 return <div className="zf-real-cluster" role="img" aria-label="عداد المركبة الحقيقي: السرعة ودورات المحرك والوقود والحرارة">
 <svg viewBox="0 0 900 390" width="100%" preserveAspectRatio="xMidYMid meet">
 <defs><radialGradient id="clusterBg"><stop stopColor="#181a1e"/><stop offset="1" stopColor="#010203"/></radialGradient></defs>
 <rect x="0" y="0" width="900" height="390" rx="26" fill="url(#clusterBg)"/>
 <Dial cx={190} value={rpm===null?null:rpm/1000} max={8} major={1} unit="x1000 r/min"/>
 <Dial cx={710} value={speed} max={240} major={20} unit="km/h"/>
 <rect x="377" y="77" width="146" height="239" rx="9" fill="#07101a" stroke="#263647" strokeWidth="2"/>
 <text x="450" y="111" fill={connected?'#62e3b3':'#aab7c7'} textAnchor="middle" fontSize="15">{connected?'● متصل':'○ غير متصل'}</text>
 <text x="450" y="147" fill="#f1f4fa" textAnchor="middle" fontSize="18">حرارة المحرك</text>
 <text x="450" y="177" fill="#fff" textAnchor="middle" fontSize="25" fontWeight="bold">{temperature===null?'—':temperature+'°C'}</text>
 <text x="450" y="213" fill="#f1f4fa" textAnchor="middle" fontSize="17">الوقود</text>
 <rect x="397" y="224" width="106" height="10" rx="4" fill="#394552"/>
 {fuel!==null&&<rect x="397" y="224" width={106*Math.max(0,Math.min(100,fuel))/100} height="10" rx="4" fill={fuel<15?'#f44747':'#66c8e5'}/>}
 <text x="450" y="261" fill="#fff" textAnchor="middle" fontSize="22">{fuel===null?'—':Math.round(fuel)+'%'}</text>
 <text x="450" y="291" fill="#c8d1dc" textAnchor="middle" fontSize="14">ODO {odometer===null?'—':Math.round(odometer).toLocaleString()+' km'}</text>
 <text x="450" y="309" fill="#c8d1dc" textAnchor="middle" fontSize="12">TRIP {trip===null?'—':trip.toFixed(1)+' km'}</text>
 </svg></div>;
}
