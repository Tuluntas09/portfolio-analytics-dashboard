/* ============================================================
   ui.jsx — shared presentational primitives + formatters
   ============================================================ */

// ---- formatters ----
const fmtPct = (v, d = 1) => (v >= 0 ? "" : "−") + Math.abs(v * 100).toFixed(d) + "%";
const fmtPctSigned = (v, d = 1) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d) + "%";
const fmtUSD = v => "$" + Math.round(v).toLocaleString("en-US");
const fmtUSDc = v => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (v, d = 2) => v.toFixed(d);

// stable color per asset index
const SERIES_COLORS = [
  "var(--accent)", "var(--accent-2)",
  "oklch(0.72 0.13 295)", "oklch(0.78 0.13 95)",
  "oklch(0.70 0.13 25)",  "oklch(0.74 0.12 145)",
  "oklch(0.70 0.12 330)", "oklch(0.76 0.11 60)",
];
function assetColor(i) { return SERIES_COLORS[i % SERIES_COLORS.length]; }

const I18N = {
  en: {
    language: "Language",
    toggleTheme: "Toggle theme",
    holdings: "holdings",
    range: "range",
    annReturn: "Ann. Return",
    sharpe: "Sharpe",
    maxDd: "Max DD",
    realPrices: "Real Prices",
    loadingPrices: "Loading Prices",
    partialPrices: "Partial Prices",
    mockPrices: "Mock Prices",
    addInstrument: "Add instrument",
    searchTicker: "Search ticker or name...",
    added: "added",
    noMatch: "No match for",
    portfolio: "Portfolio",
    position: "position",
    positions: "positions",
    emptyHoldings: "Search above to add your first instrument.",
    remove: "Remove",
    lotsTitle: "Position lots (shares)",
    lotsHelp: "Weights are computed from lots x latest price.",
    portfolioValue: "Portfolio value",
    dataRange: "Data range",
    from: "From",
    to: "To",
    analysisProfile: "Analysis profile",
    advancedAssumptions: "Advanced assumptions",
    riskFreeRate: "Risk-free rate",
    rfHelp: "Used in Sharpe & Sortino. Defaults to 3-month T-bill.",
    mcHorizon: "MC horizon",
    mcHorizonHelp: "Projection length for Monte Carlo simulation.",
    mcPaths: "MC paths",
    mcPathsHelp: "More paths = smoother distribution, slower compute.",
    dataAdapterReady: "Data adapter ready",
    proxyChecking: "Proxy checking",
    proxyReady: "Proxy ready",
    proxyKeyMissing: "Proxy online - key missing",
    proxyOffline: "Proxy offline",
    realPricesCount: "Real prices",
    partialPricesCount: "Partial prices",
    loadingHistory: "Loading price history",
    mockPricesLower: "Mock prices",
    quoteProfile: "Quote/profile",
    loadingQuoteProfile: "Loading quote/profile",
    mockCompanyData: "Mock company data",
    noHoldingsYet: "No holdings yet",
    emptyStateHelp: "Use the search in the control panel to add stock or ETF tickers, then enter position lots to build your portfolio.",
    rateLimitWarn: "Rate limit reached — some data may be delayed.",
  },
  tr: {
    language: "Dil",
    toggleTheme: "Temayı değiştir",
    holdings: "varlık",
    range: "aralık",
    annReturn: "Yıllık Getiri",
    sharpe: "Sharpe",
    maxDd: "Maks. Düşüş",
    realPrices: "Canlı Fiyat",
    loadingPrices: "Fiyat Yükleniyor",
    partialPrices: "Kısmi Fiyat",
    mockPrices: "Model Fiyat",
    addInstrument: "Varlık ekle",
    searchTicker: "Sembol veya şirket ara...",
    added: "eklendi",
    noMatch: "Eşleşme yok:",
    portfolio: "Portföy",
    position: "pozisyon",
    positions: "pozisyon",
    emptyHoldings: "İlk varlığı eklemek için yukarıdaki aramayı kullan.",
    remove: "Sil",
    lotsTitle: "Pozisyon lotları",
    lotsHelp: "Ağırlıklar lot x son fiyat üzerinden hesaplanır.",
    portfolioValue: "Portföy değeri",
    dataRange: "Veri aralığı",
    from: "Başlangıç",
    to: "Bitiş",
    analysisProfile: "Profil analizi",
    advancedAssumptions: "Gelişmiş varsayımlar",
    riskFreeRate: "Risksiz faiz",
    rfHelp: "Sharpe ve Sortino hesaplarında kullanılır. Varsayılan olarak 3 aylık T-Bill kabul edilir.",
    mcHorizon: "MC vadesi",
    mcHorizonHelp: "Monte Carlo simülasyonu için projeksiyon süresi.",
    mcPaths: "MC yol sayısı",
    mcPathsHelp: "Daha fazla yol daha pürüzsüz dağılım üretir, hesaplama süresini artırır.",
    dataAdapterReady: "Veri adaptörü hazır",
    proxyChecking: "Proxy kontrol ediliyor",
    proxyReady: "Proxy hazır",
    proxyKeyMissing: "Proxy çevrimiçi - key eksik",
    proxyOffline: "Proxy çevrimdışı",
    realPricesCount: "Canlı fiyat",
    partialPricesCount: "Kısmi fiyat",
    loadingHistory: "Fiyat geçmişi yükleniyor",
    mockPricesLower: "Model fiyat",
    quoteProfile: "Quote/profil",
    loadingQuoteProfile: "Quote/profil yükleniyor",
    mockCompanyData: "Model şirket verisi",
    noHoldingsYet: "Henüz varlık yok",
    emptyStateHelp: "Portföy oluşturmak için kontrol panelindeki aramadan hisse veya ETF sembolü ekle, ardından pozisyon lotlarını gir.",
    rateLimitWarn: "Rate limit sınırına ulaşıldı — bazı veriler gecikebilir.",
  },
};

function t(lang, key) {
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}

// ---- Card / Panel ----
function Card({ title, subtitle, action, children, pad = true, style, className = "" }) {
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
function Metric({ label, value, delta, deltaLabel, sub, accent, glossary, big }) {
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
function Pill({ children, tone = "neutral", soft = true, size = "md" }) {
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
function Table({ columns, rows, zebra = true, dense = false, footer }) {
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
function Alert({ tone = "accent", title, children, icon }) {
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
function var_(v) { return `var(${v})`; }

// ---- Analyst guidance blocks ----
function ModuleIntro({ question, answer, children }) {
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

function InsightGrid({ children }) {
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

function InsightCard({ label, value, tone = "neutral", children }) {
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
function Segmented({ options, value, onChange, size = "md" }) {
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
function Spark({ data, color = "var(--accent)", width = 64, height = 20, area = false }) {
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

Object.assign(window, {
  fmtPct, fmtPctSigned, fmtUSD, fmtUSDc, fmtNum, assetColor, SERIES_COLORS,
  I18N, t, Card, Metric, Pill, Table, Alert, ModuleIntro, InsightGrid, InsightCard, Segmented, Spark,
});
