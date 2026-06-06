/* ============================================================
   src/ui.jsx — Vite-native ES module for React UI components.
   Re-exports all pure-JS utilities from src/ui.js and adds
   the JSX-based component layer.

   JSX pragma: classic mode with explicit npm React import (Phase 6i prep).
   React is imported from the npm package rather than the CDN window global.
   The window.React UMD global is still present in the browser (loaded by
   index.html CDN scripts) but is no longer relied upon by this file.

   Node.js consumers: import pure-JS utilities from src/ui.js instead.
   This file cannot be imported in Node.js (JSX is not valid JS for Node).

   public/legacy/ui.jsx is the unchanged browser-Babel shim that
   assigns every symbol to window.* for legacy script consumers.

   Migration phase: 6i-prep.
   ============================================================ */
/* @jsxRuntime classic */
/* @jsx React.createElement */
/* @jsxFrag React.Fragment */

import React from "react";

import {
  fmtPct, fmtPctSigned, fmtUSD, fmtUSDc, fmtNum,
  SERIES_COLORS, assetColor,
  I18N, t,
} from "./ui.js";
export { fmtPct, fmtPctSigned, fmtUSD, fmtUSDc, fmtNum, SERIES_COLORS, assetColor, I18N, t };

// ---- Card / Panel ----
export function Card({ title, subtitle, action, children, pad = true, style, className = "" }) {
  return (
    <section className={"card " + className} style={style}>
      {(title || action) && (
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: subtitle ? 2 : 14 }}>
          <div>
            {title && <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</h3>}
            {subtitle && <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--text-faint)", maxWidth: 560, lineHeight: 1.5 }}>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {subtitle && !title && null}
      <div style={{ marginTop: subtitle && title ? 14 : 0 }}>{children}</div>
      <style>{`
        .card { background: var(--panel); border: 1px solid var(--border-soft); border-radius: var(--r-lg);
          padding: ${pad ? "var(--s5)" : "0"}; }
      `}</style>
    </section>
  );
}

// ---- Metric / KPI ----
export function Metric({ label, value, delta, deltaLabel, sub, accent, glossary, big }) {
  const dPos = delta != null && delta >= 0;
  return (
    <div className="metric" title={glossary || undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="eyebrow" style={{ fontSize: 10 }}>{label}</span>
        {glossary && <span style={{ fontSize: 9.5, color: "var(--text-faint)", border: "1px solid var(--border)", borderRadius: 99, width: 13, height: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "help" }}>?</span>}
      </div>
      <div className="num" style={{ fontSize: big ? 30 : 24, fontWeight: 600, lineHeight: 1.1, marginTop: 6, color: accent || "var(--text)" }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6, minHeight: 16 }}>
        {delta != null && (
          <span className="num" style={{ fontSize: 11.5, fontWeight: 600, color: dPos ? "var(--pos)" : "var(--neg)", display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 9 }}>{dPos ? "▲" : "▼"}</span>{typeof delta === "string" ? delta : fmtPct(Math.abs(delta))}
          </span>
        )}
        {deltaLabel && <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{deltaLabel}</span>}
        {sub && <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{sub}</span>}
      </div>
      <style>{`.metric { padding: 2px 0; }`}</style>
    </div>
  );
}

// ---- Pill / Badge ----
export function Pill({ children, tone = "neutral", soft = true, size = "md" }) {
  const tones = {
    neutral: ["var(--text-dim)", "var(--panel-hi)"],
    accent: ["var(--accent)", "var(--accent-soft)"],
    teal: ["var(--accent-2)", "var(--accent-2-soft)"],
    pos: ["var(--pos)", "var(--pos-soft)"],
    neg: ["var(--neg)", "var(--neg-soft)"],
    warn: ["var(--warn)", "color-mix(in oklch, var(--warn), transparent 86%)"],
  };
  const [fg, bg] = tones[tone] || tones.neutral;
  const pad = size === "sm" ? "1px 7px" : "2px 9px";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: pad,
      fontSize: size === "sm" ? 10 : 11, fontWeight: 600, borderRadius: 99,
      color: fg, background: soft ? bg : "transparent",
      border: soft ? "none" : `1px solid ${fg}`, lineHeight: 1.4, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

// ---- Table ----
export function Table({ columns, rows, zebra = true, dense = false, footer }) {
  // columns: [{key, label, align, render, mono, width}]
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={{ textAlign: c.align || "left", width: c.width }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {columns.map(c => (
                <td key={c.key} className={c.mono ? "num" : ""} style={{ textAlign: c.align || "left", color: c.color ? c.color(row) : undefined }}>
                  {c.render ? c.render(row, ri) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot><tr>{footer.map((f, i) => (
          <td key={i} className={f.mono ? "num" : ""} style={{ textAlign: f.align || "left" }}>{f.content}</td>
        ))}</tr></tfoot>}
      </table>
      <style>{`
        .tbl-wrap { width: 100%; overflow-x: auto; }
        .tbl { width: 100%; border-collapse: collapse; font-size: ${dense ? 12 : 12.5}px; }
        .tbl thead th {
          position: sticky; top: 0; background: var(--table-head);
          color: var(--text-faint); font-weight: 600; font-size: 10.5px;
          letter-spacing: .05em; text-transform: uppercase;
          padding: ${dense ? "7px 10px" : "9px 12px"}; border-bottom: 1px solid var(--border);
          white-space: nowrap; z-index: 1;
        }
        .tbl tbody td {
          padding: ${dense ? "7px 10px" : "9px 12px"};
          border-bottom: 1px solid var(--border-soft); color: var(--text-dim);
          white-space: nowrap;
        }
        .tbl tbody tr:last-child td { border-bottom: none; }
        ${zebra ? `.tbl tbody tr:nth-child(even) td { background: var(--table-zebra); }` : ""}
        .tbl tbody tr:hover td { background: var(--panel-hi); color: var(--text); }
        .tbl tfoot td {
          padding: ${dense ? "8px 10px" : "10px 12px"}; font-weight: 600; color: var(--text);
          border-top: 1.5px solid var(--border); background: var(--table-head);
        }
        .tbl td:first-child, .tbl th:first-child { padding-left: 14px; }
        .tbl td:last-child, .tbl th:last-child { padding-right: 14px; }
      `}</style>
    </div>
  );
}

// ---- Alert / callout ----
function var_(v) { return `var(${v})`; }

export function Alert({ tone = "accent", title, children, icon }) {
  const tones = {
    accent: ["var(--accent)", "var(--accent-soft)"],
    warn: ["var(--warn)", "color-mix(in oklch, var(--warn), transparent 88%)"],
    neg: ["var(--neg)", "var(--neg-soft)"],
    pos: ["var(--pos)", "var(--pos-soft)"],
  };
  const [fg, bg] = tones[tone];
  return (
    <div style={{ display: "flex", gap: 11, padding: "11px 14px", background: bg, borderRadius: var_("--r-md"), border: `1px solid color-mix(in oklch, ${fg}, transparent 70%)` }}>
      <span style={{ color: fg, fontWeight: 700, fontSize: 13, lineHeight: 1.5, flexShrink: 0 }}>{icon || "›"}</span>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-dim)" }}>
        {title && <strong style={{ color: "var(--text)", fontWeight: 600 }}>{title}. </strong>}
        {children}
      </div>
    </div>
  );
}

// ---- Analyst guidance blocks ----
export function ModuleIntro({ question, answer, children }) {
  return (
    <section className="module-intro">
      <div>
        <div className="eyebrow">Bu ekran neyi cevaplıyor?</div>
        <h2>{question}</h2>
        {answer && <p>{answer}</p>}
      </div>
      {children && <div className="module-intro-side">{children}</div>}
      <style>{`
        .module-intro {
          display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center;
          padding: 16px 18px; background: var(--panel); border: 1px solid var(--border-soft);
          border-radius: var(--r-lg);
        }
        .module-intro h2 { margin: 5px 0 0; font-size: 19px; line-height: 1.25; letter-spacing: -0.02em; }
        .module-intro p { margin: 7px 0 0; max-width: 760px; color: var(--text-faint); font-size: 12.5px; line-height: 1.55; }
        .module-intro-side { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
      `}</style>
    </section>
  );
}

export function InsightGrid({ children }) {
  return (
    <div className="insight-grid">
      {children}
      <style>{`
        .insight-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 980px) { .insight-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

export function InsightCard({ label, value, tone = "neutral", children }) {
  const colors = {
    neutral: "var(--text)",
    accent: "var(--accent)",
    pos: "var(--pos)",
    neg: "var(--neg)",
    warn: "var(--warn)",
  };
  return (
    <div className="insight-card">
      <div className="eyebrow">{label}</div>
      <div className="num" style={{ color: colors[tone] || colors.neutral }}>{value}</div>
      <p>{children}</p>
      <style>{`
        .insight-card {
          min-height: 118px; padding: 14px 15px; background: var(--panel);
          border: 1px solid var(--border-soft); border-radius: var(--r-lg);
        }
        .insight-card .num { margin-top: 7px; font-size: 23px; font-weight: 700; line-height: 1.12; }
        .insight-card p { margin: 8px 0 0; color: var(--text-faint); font-size: 11.8px; line-height: 1.5; }
      `}</style>
    </div>
  );
}

// ---- Segmented control ----
export function Segmented({ options, value, onChange, size = "md" }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--panel-hi)", borderRadius: var_("--r-md"), padding: 3, gap: 2, border: "1px solid var(--border-soft)" }}>
      {options.map(o => {
        const active = (o.value ?? o) === value;
        const label = o.label ?? o;
        return (
          <button key={o.value ?? o} onClick={() => onChange(o.value ?? o)} style={{
            padding: size === "sm" ? "4px 10px" : "5px 13px", fontSize: size === "sm" ? 11.5 : 12.5, fontWeight: 600,
            borderRadius: 5, color: active ? "var(--text)" : "var(--text-faint)",
            background: active ? "var(--panel)" : "transparent",
            boxShadow: active ? "0 1px 2px rgba(0,0,0,.12)" : "none", transition: "all .14s",
          }}>{label}</button>
        );
      })}
    </div>
  );
}

// ---- Sparkline (tiny inline) ----
export function Spark({ data, color = "var(--accent)", width = 64, height = 20, area = false }) {
  const lo = Math.min(...data), hi = Math.max(...data);
  const x = i => (i / (data.length - 1)) * width;
  const y = v => (1 - (v - lo) / ((hi - lo) || 1)) * (height - 2) + 1;
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  const c = color === "auto" ? (up ? "var(--pos)" : "var(--neg)") : color;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {area && <polygon points={`0,${height} ${pts} ${width},${height}`} fill={c} opacity="0.13" />}
      <polyline points={pts} fill="none" stroke={c} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
