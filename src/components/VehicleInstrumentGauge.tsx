import React from 'react';

type GaugeProps = {
  label: string;
  value: number | null | undefined;
  max: number;
  majorStep: number;
  unit: string;
  divisor?: number;
  accent: 'cyan' | 'amber';
  stale?: boolean;
};

export const VehicleInstrumentGauge: React.FC<GaugeProps> = ({
  label, value, max, majorStep, unit, divisor = 1, accent, stale = false,
}) => {
  const available = value !== null && value !== undefined && Number.isFinite(value) && value >= 0;
  const normalized = available ? Math.min(max, Math.max(0, value!)) / max : 0;
  const cx = 160, cy = 160, radius = 114;
  // Car-style sweeping dial: 225 degrees clockwise from bottom-left to bottom-right.
  const minDeg = -225, sweep = 270;
  const point = (deg: number, r: number) => {
    const angle = deg * Math.PI / 180;
    return {x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r};
  };
  const arc = (from: number, to: number, r: number) => {
    const a = point(from, r), b = point(to, r);
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${Math.abs(to - from) > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  };
  const end = minDeg + normalized * sweep;
  const needle = point(end, 82);
  const accentColor = accent === 'cyan' ? '#43ddff' : '#ffb454';
  const ticks = Array.from({length: 55}, (_, i) => {
    const fraction = i / 54, major = i % 6 === 0, deg = minDeg + sweep * fraction;
    const inner = point(deg, major ? 95 : 105), outer = point(deg, 115);
    const textPoint = point(deg, 79);
    return <g key={i}>
      <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={major ? '#e5f5ff' : '#57758e'} strokeWidth={major ? 2.5 : 1.2} strokeLinecap="round"/>
      {major && <text x={textPoint.x} y={textPoint.y} fill="#dceefd" fontSize="12" fontWeight="700" textAnchor="middle" dominantBaseline="central">{Math.round(max * fraction / divisor)}</text>}
    </g>;
  });
  return <div className={`zf-real-gauge zf-real-gauge-${accent}`}>
    <div className="zf-real-gauge-label">{label}</div>
    <svg viewBox="0 0 320 320" role="img" aria-label={`${label}: ${available ? Math.round(value!) : 'غير متاح'} ${unit}`}>
      <defs>
        <radialGradient id={`zf-gauge-face-${accent}`} cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#122b43"/><stop offset="68%" stopColor="#071626"/><stop offset="100%" stopColor="#020a14"/>
        </radialGradient>
        <filter id={`zf-gauge-glow-${accent}`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      <circle cx="160" cy="160" r="148" fill="#020914" stroke="#346282" strokeWidth="3"/>
      <circle cx="160" cy="160" r="140" fill={`url(#zf-gauge-face-${accent})`} stroke="#0c405e" strokeWidth="2"/>
      <circle cx="160" cy="160" r="124" fill="none" stroke="#123a56" strokeWidth="11"/>
      <path d={arc(minDeg,minDeg+sweep,123)} stroke="#1e4e69" strokeWidth="6" strokeLinecap="round" fill="none"/>
      {available && <path d={arc(minDeg, Math.max(minDeg + .1,end),123)} stroke={accentColor} strokeWidth="6" strokeLinecap="round" fill="none" filter={`url(#zf-gauge-glow-${accent})`}/>}
      {available && <path d={arc(minDeg, Math.max(minDeg + .1,end),123)} stroke={accentColor} strokeWidth="4" strokeLinecap="round" fill="none"/>}
      {ticks}
      {available && <>
        <line x1="160" y1="160" x2={needle.x} y2={needle.y} stroke={accentColor} strokeWidth="4" strokeLinecap="round" className="zf-gauge-needle"/>
        <circle cx="160" cy="160" r="12" fill="#172c3d" stroke={accentColor} strokeWidth="3"/>
        <circle cx="160" cy="160" r="4" fill="#d5faff"/>
      </>}
      <text x="160" y="212" textAnchor="middle" fill="#f3fcff" fontSize="37" fontWeight="900" fontFamily="Inter,Arial,sans-serif">{available ? Math.round(value! / divisor) : '—'}</text>
      <text x="160" y="234" textAnchor="middle" fill="#89bdd6" fontSize="13" fontWeight="800">{unit}</text>
      <text x="160" y="267" textAnchor="middle" fill={stale ? '#ffd08c' : '#56deb9'} fontSize="10">{stale ? 'آخر قراءة محفوظة' : available ? 'قراءة الجهاز' : 'بانتظار بيانات الجهاز'}</text>
    </svg>
  </div>;
};
