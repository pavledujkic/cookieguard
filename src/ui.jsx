import React from 'react';
import { EXPLORER, fmtNum, short } from './chain.js';

/* ---------------- verdict colours ---------------- */
export const verdictColor = (v) =>
  v === 'SAFE' ? 'var(--green)' : v === 'CAUTION' ? 'var(--amber)' : 'var(--red)';

/* ---------------- risk gauge ---------------- */
export function Gauge({ score, verdict, size = 190 }) {
  const R = 76, C = 2 * Math.PI * R;
  const track = C * 0.75; // 270° sweep
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = verdictColor(verdict);
  return (
    <svg width={size} height={size * 0.82} viewBox="0 0 200 164" role="img" aria-label={`Risk score ${score} of 100`}>
      <circle cx="100" cy="100" r={R} fill="none" stroke="#2a2724" strokeWidth="13"
        strokeDasharray={`${track} ${C}`} strokeLinecap="round" transform="rotate(135 100 100)" />
      <circle cx="100" cy="100" r={R} fill="none" stroke={color} strokeWidth="13"
        strokeDasharray={`${track * pct} ${C}`} strokeLinecap="round" transform="rotate(135 100 100)"
        style={{ transition: 'stroke-dasharray .7s cubic-bezier(.22,1,.36,1), stroke .3s' }} />
      <text x="100" y="96" textAnchor="middle" fill="var(--text)" fontSize="42" fontWeight="650"
        style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-1.5px' }}>{score}</text>
      <text x="100" y="116" textAnchor="middle" fill="var(--dim)" fontSize="10.5"
        style={{ textTransform: 'uppercase', letterSpacing: '1.4px' }}>of 100</text>
      <text x="100" y="143" textAnchor="middle" fill={color} fontSize="14.5" fontWeight="700"
        style={{ letterSpacing: '1.6px' }}>{verdict}</text>
    </svg>
  );
}

/* ---------------- horizontal share bars ---------------- */
export function ShareBars({ items, max = 100 }) {
  if (!items?.length) return <p className="dim tiny">No funded holders found.</p>;
  return (
    <div>
      {items.map((d, i) => (
        <div className="bar-row" key={d.address || i}>
          <div className="lbl" title={d.owner || d.label}>{d.label || (d.owner ? short(d.owner, 6) : '—')}</div>
          <div className="bar-track">
            <div className={`bar-fill${d.isVault ? ' pool' : ''}`} style={{ width: `${Math.min(100, (d.pct / max) * 100)}%` }} />
          </div>
          <div className="val">{d.pct !== undefined ? `${d.pct.toFixed(2)}%` : d.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- column chart ---------------- */
export function ColumnChart({ data, height = 150, color = 'var(--amber)' }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height, padding: '10px 0' }}>
      {data.map((d) => (
        <div key={d.key ?? d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' }}>
          <span className="tiny" style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', fontSize: 10 }}>{d.count}</span>
          <div title={`${d.label ?? d.key}: ${d.count}`}
            style={{ width: '100%', height: `${(d.count / max) * 100}%`, minHeight: d.count ? 3 : 0, background: color, borderRadius: '4px 4px 0 0', opacity: .85, transition: 'height .5s' }} />
          <span style={{ fontSize: 10, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{d.label ?? d.key}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- donut ---------------- */
export function Donut({ segments, size = 168, label, sub }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const R = 62, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
      <svg width={size} height={size} viewBox="0 0 168 168">
        <circle cx="84" cy="84" r={R} fill="none" stroke="#2a2724" strokeWidth="17" />
        {segments.map((s) => {
          const frac = s.value / total;
          const el = (
            <circle key={s.label} cx="84" cy="84" r={R} fill="none" stroke={s.color} strokeWidth="17"
              strokeDasharray={`${C * frac} ${C}`} strokeDashoffset={-C * acc}
              transform="rotate(-90 84 84)" style={{ transition: 'stroke-dasharray .6s' }} />
          );
          acc += frac;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
        <div>
          <div style={{ fontSize: 25, fontWeight: 650, letterSpacing: '-.6px' }}>{label}</div>
          <div className="tiny dim">{sub}</div>
        </div>
      </div>
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {items.map((i) => (
        <div key={i.label} className="row" style={{ gap: 9, flexWrap: 'nowrap' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: i.color, flex: '0 0 10px' }} />
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{i.label}</span>
          <b style={{ marginLeft: 'auto', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{i.value}</b>
          {i.pct !== undefined && <span className="dim tiny" style={{ width: 44, textAlign: 'right' }}>{i.pct}%</span>}
        </div>
      ))}
    </div>
  );
}

/* ---------------- stat ---------------- */
export function Stat({ label, value, hint, accent }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b style={accent ? { color: accent } : undefined}>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function CheckRow({ c }) {
  const ic = c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✕';
  return (
    <div className={`check ${c.status}`}>
      <div className="ic">{ic}</div>
      <div className="bd">
        <div className="lb">
          {c.label}
          {c.weight > 0 && <span className="w">−{c.weight}</span>}
        </div>
        <div className="dt">{c.detail}</div>
      </div>
    </div>
  );
}

export function Copy({ text, label = 'copy' }) {
  const [done, setDone] = React.useState(false);
  return (
    <button className="copy" onClick={() => {
      navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); }).catch(() => {});
    }}>{done ? 'copied ✓' : label}</button>
  );
}

export function Addr({ value, chars = 4, link = true }) {
  if (!value) return <span className="dim">—</span>;
  return (
    <span className="mono">
      {link
        ? <a href={`${EXPLORER}/address/${value}`} target="_blank" rel="noreferrer" title={value}>{short(value, chars)}</a>
        : short(value, chars)}
      <Copy text={value} label="⧉" />
    </span>
  );
}

export function TokenAmount({ raw, decimals, max = 4 }) {
  if (raw === null || raw === undefined) return <span className="dim">—</span>;
  return <>{fmtNum(Number(raw) / 10 ** (decimals ?? 0), max)}</>;
}
