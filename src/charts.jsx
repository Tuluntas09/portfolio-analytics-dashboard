/* ============================================================
   src/charts.jsx — Vite-native ES module for SVG chart components.
   All colors pull from CSS vars so they track dark/light themes.

   JSX pragma: classic mode with explicit npm React import (Phase 6i prep).
   React is imported from the npm package rather than the CDN window global.
   The window.React UMD global is still present in the browser (loaded by
   index.html CDN scripts) but is no longer relied upon by this file.

   Node.js consumers: this file cannot be imported directly (JSX is not
   valid JS for Node). Verify exports via scripts/charts-check.mjs.

   public/legacy/charts.jsx is the unchanged browser-Babel shim that
   assigns every chart component to window.* for legacy script consumers.

   Migration phase: 6i-prep.
   ============================================================ */
/* @jsxRuntime classic */
/* @jsx React.createElement */
/* @jsxFrag React.Fragment */

import React from "react";
const { useState, useRef, useEffect } = React;

// shared helpers (private — not exported)
function extent(arr) { return [Math.min(...arr), Math.max(...arr)]; }
function pathFrom(pts) {
  return pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(2) + " " + p[1].toFixed(2)).join(" ");
}

// ---------- AREA / LINE: cumulative growth vs benchmark ----------
export function GrowthChart({ series, height = 250 }) {
  // series: [{name, data:[], color, fill}]
  const [hover, setHover] = useState(null);
  const W = 760, H = height, padL = 46, padR = 14, padT = 14, padB = 24;
  const all = series.flatMap(s => s.data);
  let [lo, hi] = extent(all);
  lo = Math.min(lo, 1); hi = hi + (hi - lo) * 0.08;
  const n = series[0].data.length;
  const x = i => padL + (i / (n - 1)) * (W - padL - padR);
  const y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}
      onMouseLeave={() => setHover(null)}
      onMouseMove={e => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width * W;
        let i = Math.round((px - padL) / (W - padL - padR) * (n - 1));
        i = Math.max(0, Math.min(n - 1, i));
        setHover(i);
      }}>
      <defs>
        <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = lo + (i / ticks) * (hi - lo);
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" />
            <text x={padL - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--text-faint)" fontFamily="var(--font-mono)">
              {v.toFixed(2)}×
            </text>
          </g>
        );
      })}
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => [x(i), y(v)]);
        return (
          <g key={si}>
            {s.fill && (
              <path d={pathFrom(pts) + ` L ${x(n - 1)} ${y(lo)} L ${x(0)} ${y(lo)} Z`} fill="url(#growthFill)" />
            )}
            <path d={pathFrom(pts)} fill="none" stroke={s.color} strokeWidth={s.fill ? 2 : 1.5}
              strokeDasharray={s.dash || "none"} strokeLinejoin="round" />
          </g>
        );
      })}
      {hover != null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--text-faint)" strokeWidth="1" strokeDasharray="3 3" />
          {series.map((s, si) => (
            <circle key={si} cx={x(hover)} cy={y(s.data[hover])} r="3.5" fill="var(--panel)" stroke={s.color} strokeWidth="2" />
          ))}
          <g transform={`translate(${Math.min(x(hover) + 10, W - 150)}, ${padT + 6})`}>
            <rect width="140" height={18 + series.length * 16} rx="6" fill="var(--panel-hi)" stroke="var(--border)" />
            <text x="10" y="15" fontSize="10" fill="var(--text-faint)" fontFamily="var(--font-mono)">
              day {hover}
            </text>
            {series.map((s, si) => (
              <g key={si} transform={`translate(10, ${30 + si * 16})`}>
                <rect width="8" height="8" y="-7" rx="2" fill={s.color} />
                <text x="14" y="0" fontSize="11" fill="var(--text-dim)">{s.name}</text>
                <text x="130" y="0" textAnchor="end" fontSize="11" fill="var(--text)" fontFamily="var(--font-mono)">
                  {s.data[hover].toFixed(3)}×
                </text>
              </g>
            ))}
          </g>
        </g>
      )}
    </svg>
  );
}

// ---------- DONUT: allocation ----------
export function Donut({ data, size = 168, thickness = 26 }) {
  // data: [{label, value, color}]
  const [hover, setHover] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = size / 2, r = R - thickness, cx = R, cy = R;
  let a0 = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const frac = d.value / total;
    const a1 = a0 + frac * Math.PI * 2;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
    const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R);
    const [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
    const d3 = `M ${x0} ${y0} A ${R} ${R} 0 ${big} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${big} 0 ${x3} ${y3} Z`;
    a0 = a1;
    return { ...d, d3, frac, i };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} onMouseLeave={() => setHover(null)}>
      {arcs.map(a => (
        <path key={a.i} d={a.d3} fill={a.color}
          opacity={hover == null || hover === a.i ? 1 : 0.35}
          stroke="var(--panel)" strokeWidth="1.5"
          style={{ transition: "opacity .15s" }}
          onMouseEnter={() => setHover(a.i)} />
      ))}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="11" fill="var(--text-faint)">
        {hover == null ? "Holdings" : arcs[hover].label}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" fontSize="19" fontWeight="600" fill="var(--text)" fontFamily="var(--font-mono)">
        {hover == null ? data.length : (arcs[hover].frac * 100).toFixed(1) + "%"}
      </text>
    </svg>
  );
}

// ---------- HORIZONTAL BARS: risk contribution / generic ----------
export function HBars({ data, valueFmt = v => (v * 100).toFixed(1) + "%", height }) {
  // data:[{label,value,color}]
  const max = Math.max(...data.map(d => d.value), 1e-6);
  const rowH = 30;
  const H = height || data.length * rowH;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "52px 1fr 56px", alignItems: "center", gap: 10 }}>
          <span className="num" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>{d.label}</span>
          <div style={{ height: 9, background: "var(--panel-hi)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: (d.value / max * 100) + "%", height: "100%", background: d.color || "var(--accent)", borderRadius: 99, transition: "width .4s" }} />
          </div>
          <span className="num" style={{ fontSize: 12, textAlign: "right", color: "var(--text)" }}>{valueFmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- VERTICAL BARS: rolling / generic time bars ----------
export function VBars({ data, height = 150, color = "var(--accent)", baseline = 0, fmt }) {
  const W = 760, H = height, padB = 18, padT = 8, padL = 40, padR = 8;
  const vals = data.map(d => d.v);
  let lo = Math.min(baseline, ...vals), hi = Math.max(baseline, ...vals);
  const pad = (hi - lo) * 0.1 || 0.01; lo -= pad; hi += pad;
  const y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const bw = (W - padL - padR) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      {[0, 0.5, 1].map((f, i) => {
        const v = lo + f * (hi - lo);
        return <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
          <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="9.5" fill="var(--text-faint)" fontFamily="var(--font-mono)">{fmt ? fmt(v) : v.toFixed(2)}</text>
        </g>;
      })}
      {data.map((d, i) => {
        const yt = y(Math.max(d.v, baseline)), yb = y(Math.min(d.v, baseline));
        const c = d.color || (d.v >= baseline ? color : "var(--neg)");
        return <rect key={i} x={padL + i * bw + bw * 0.15} width={bw * 0.7} y={yt} height={Math.max(1, yb - yt)} fill={c} rx="1.5" />;
      })}
    </svg>
  );
}

// ---------- LINE (single, generic) for rolling vol/sharpe ----------
export function MiniLine({ data, height = 150, color = "var(--accent-2)", fmt, band }) {
  const W = 760, H = height, padB = 18, padT = 8, padL = 40, padR = 8;
  let [lo, hi] = extent(data);
  const pad = (hi - lo) * 0.12 || 0.01; lo -= pad; hi += pad;
  const x = i => padL + (i / (data.length - 1)) * (W - padL - padR);
  const y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const pts = data.map((v, i) => [x(i), y(v)]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      {[0, 0.5, 1].map((f, i) => {
        const v = lo + f * (hi - lo);
        return <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
          <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="9.5" fill="var(--text-faint)" fontFamily="var(--font-mono)">{fmt ? fmt(v) : v.toFixed(2)}</text>
        </g>;
      })}
      {band != null && <line x1={padL} x2={W - padR} y1={y(band)} y2={y(band)} stroke="var(--text-faint)" strokeDasharray="4 3" strokeWidth="1" />}
      <path d={pathFrom(pts)} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- CORRELATION HEATMAP ----------
export function Heatmap({ tickers, corrFn }) {
  const [hover, setHover] = useState(null);
  const N = tickers.length;
  const cell = Math.min(46, Math.floor(420 / N));
  const labelW = 44;
  const W = labelW + N * cell + 8, H = labelW + N * cell + 8;
  const colorFor = v => {
    // -1..1 -> neg(red) .. neutral .. accent(blue)
    if (v >= 0) return `color-mix(in oklch, var(--panel-hi), var(--accent) ${(v * 78).toFixed(0)}%)`;
    return `color-mix(in oklch, var(--panel-hi), var(--neg) ${(-v * 70).toFixed(0)}%)`;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }} onMouseLeave={() => setHover(null)}>
      {tickers.map((t, i) => (
        <text key={"c" + i} x={labelW + i * cell + cell / 2} y={labelW - 8} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-dim)">{t}</text>
      ))}
      {tickers.map((t, i) => (
        <text key={"r" + i} x={labelW - 8} y={labelW + i * cell + cell / 2 + 3.5} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--text-dim)">{t}</text>
      ))}
      {tickers.map((rt, i) => tickers.map((ct, j) => {
        const v = corrFn(rt, ct);
        const isH = hover && hover[0] === i && hover[1] === j;
        return (
          <g key={i + "-" + j} onMouseEnter={() => setHover([i, j, v])}>
            <rect x={labelW + j * cell} y={labelW + i * cell} width={cell - 2} height={cell - 2} rx="3"
              fill={colorFor(v)} stroke={isH ? "var(--text)" : "transparent"} strokeWidth="1.5" />
            <text x={labelW + j * cell + cell / 2 - 1} y={labelW + i * cell + cell / 2 + 3} textAnchor="middle"
              fontSize="9.5" fontFamily="var(--font-mono)"
              fill={Math.abs(v) > 0.55 ? "white" : "var(--text-dim)"}>{v.toFixed(2)}</text>
          </g>
        );
      }))}
    </svg>
  );
}

// ---------- MONTE CARLO FAN ----------
export function FanChart({ sim, startValue, years, height = 280 }) {
  const W = 760, H = height, padL = 58, padR = 12, padT = 14, padB = 24;
  const fan = sim.fan;
  const len = fan[0].length;
  const allV = fan.flat().concat([sim.p95, sim.p5]);
  let lo = Math.min(...allV), hi = Math.max(...allV);
  lo = Math.min(lo, startValue * 0.9);
  const x = i => padL + (i / (len - 1)) * (W - padL - padR);
  const y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const fmtM = v => "$" + (v / 1000).toFixed(0) + "k";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const v = lo + f * (hi - lo);
        return <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
          <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="9.5" fill="var(--text-faint)" fontFamily="var(--font-mono)">{fmtM(v)}</text>
        </g>;
      })}
      {/* start line */}
      <line x1={padL} x2={W - padR} y1={y(startValue)} y2={y(startValue)} stroke="var(--text-faint)" strokeDasharray="4 3" />
      {fan.map((p, i) => (
        <path key={i} d={pathFrom(p.map((v, k) => [x(k), y(v)]))} fill="none"
          stroke="var(--accent)" strokeWidth="1" opacity="0.13" />
      ))}
      {/* percentile guide markers at terminal */}
      {[["p95", "95th", "var(--pos)"], ["median", "median", "var(--accent-hi)"], ["p5", "5th", "var(--neg)"]].map(([k, lbl, c]) => (
        <g key={k}>
          <circle cx={x(len - 1)} cy={y(sim[k])} r="3.5" fill={c} />
          <text x={x(len - 1) - 6} y={y(sim[k]) + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill={c}>{lbl} {fmtM(sim[k])}</text>
        </g>
      ))}
    </svg>
  );
}

// ---------- HISTOGRAM (terminal value distribution) ----------
export function Histogram({ values, startValue, bins = 28, height = 180 }) {
  const W = 760, H = height, padL = 40, padR = 8, padT = 8, padB = 22;
  const lo = Math.min(...values), hi = Math.max(...values);
  const bw = (hi - lo) / bins;
  const counts = new Array(bins).fill(0);
  values.forEach(v => { let b = Math.floor((v - lo) / bw); if (b >= bins) b = bins - 1; counts[b]++; });
  const maxC = Math.max(...counts);
  const x = i => padL + (i / bins) * (W - padL - padR);
  const cw = (W - padL - padR) / bins;
  const y = c => padT + (1 - c / maxC) * (H - padT - padB);
  const fmtM = v => "$" + (v / 1000).toFixed(0) + "k";
  const startX = padL + ((startValue - lo) / (hi - lo)) * (W - padL - padR);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      {counts.map((c, i) => {
        const binMid = lo + (i + 0.5) * bw;
        return <rect key={i} x={x(i) + cw * 0.1} width={cw * 0.8} y={y(c)} height={H - padB - y(c)}
          rx="1.5" fill={binMid < startValue ? "var(--neg-soft)" : "var(--accent-soft)"}
          stroke={binMid < startValue ? "var(--neg)" : "var(--accent)"} strokeWidth="0.75" />;
      })}
      <line x1={startX} x2={startX} y1={padT} y2={H - padB} stroke="var(--text-faint)" strokeDasharray="4 3" />
      <text x={startX} y={H - 6} textAnchor="middle" fontSize="9.5" fill="var(--text-faint)" fontFamily="var(--font-mono)">start {fmtM(startValue)}</text>
      {[0, 0.5, 1].map((f, i) => {
        const v = lo + f * (hi - lo);
        return <text key={i} x={x(f * bins)} y={H - 6} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} fontSize="9.5" fill="var(--text-faint)" fontFamily="var(--font-mono)">{fmtM(v)}</text>;
      })}
    </svg>
  );
}
