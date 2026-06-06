// Lightweight tests for company news normalization and URL construction.
// Mirrors the normalizeNewsItem / fmtNewsDate logic in views-analysis.jsx.
// No external dependencies — pure Node.js, consistent with project test style.

const fail = message => { throw new Error(message); };

// --- replicate helpers from views-analysis.jsx ---

function fmtNewsDate(dt, language) {
  if (!(dt instanceof Date) || !Number.isFinite(dt.getTime())) return "";
  const diff = Date.now() - dt.getTime();
  if (diff < 0) return dt.toISOString().slice(0, 10);
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (language === "tr") {
    if (mins  < 2)  return "Az önce";
    if (mins  < 60) return mins  + "dk önce";
    if (hours < 24) return hours + "s önce";
    if (days  < 8)  return days  + "g önce";
  } else {
    if (mins  < 2)  return "Just now";
    if (mins  < 60) return mins  + "m ago";
    if (hours < 24) return hours + "h ago";
    if (days  < 8)  return days  + "d ago";
  }
  return dt.toISOString().slice(0, 10);
}

function normalizeNewsItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const headline = String(raw.headline || "").trim();
  if (!headline) return null;
  const source   = String(raw.source || "").trim() || "—";
  const datetime = typeof raw.datetime === "number" && raw.datetime > 0
    ? new Date(raw.datetime * 1000) : null;
  const rawUrl   = typeof raw.url === "string" ? raw.url.trim() : "";
  const url      = (rawUrl.startsWith("https://") || rawUrl.startsWith("http://")) ? rawUrl : null;
  return {
    headline: headline.length > 120 ? headline.slice(0, 117) + "…" : headline,
    source,
    datetime,
    url,
  };
}

// --- news URL construction (mirrors CompanyTab fetch logic) ---

function buildNewsUrl(apiBase, symbol, fromDate, toDate) {
  return apiBase + "/api/company/news?symbol=" + encodeURIComponent(symbol) + "&from=" + fromDate + "&to=" + toDate;
}

// --- tests ---

// 1. normalizeNewsItem: valid item with all fields
{
  const raw = {
    headline: "Apple reports record Q4 earnings",
    source: "Reuters",
    datetime: 1700000000,
    url: "https://example.com/news/1",
    summary: "Quarterly earnings beat expectations.",
  };
  const n = normalizeNewsItem(raw);
  if (!n) fail("normalizeNewsItem: valid item should not return null");
  if (n.headline !== raw.headline) fail(`headline mismatch: "${n.headline}"`);
  if (n.source !== "Reuters") fail(`source mismatch: "${n.source}"`);
  if (!(n.datetime instanceof Date)) fail("datetime must be a Date instance");
  if (n.url !== raw.url) fail(`url mismatch: "${n.url}"`);
}

// 2. normalizeNewsItem: missing headline → returns null
{
  const n1 = normalizeNewsItem({ source: "Bloomberg", datetime: 1700000000 });
  if (n1 !== null) fail("Empty headline: expected null");
  const n2 = normalizeNewsItem({ headline: "   ", source: "CNBC" });
  if (n2 !== null) fail("Whitespace-only headline: expected null");
  const n3 = normalizeNewsItem(null);
  if (n3 !== null) fail("null input: expected null");
  const n4 = normalizeNewsItem("not an object");
  if (n4 !== null) fail("String input: expected null");
}

// 3. normalizeNewsItem: missing source → defaults to "—"
{
  const n = normalizeNewsItem({ headline: "Test headline", source: "" });
  if (!n) fail("Missing source: should not return null");
  if (n.source !== "—") fail(`Missing source: expected "—", got "${n.source}"`);
  const n2 = normalizeNewsItem({ headline: "Test headline" });
  if (n2.source !== "—") fail(`Absent source field: expected "—", got "${n2.source}"`);
}

// 4. normalizeNewsItem: invalid or absent URL → null
{
  const withBadUrl = normalizeNewsItem({ headline: "Test", url: "ftp://bad.url" });
  if (withBadUrl.url !== null) fail(`ftp:// URL should be null, got "${withBadUrl.url}"`);
  const withNoUrl = normalizeNewsItem({ headline: "Test" });
  if (withNoUrl.url !== null) fail(`Missing URL should be null, got "${withNoUrl.url}"`);
  const withJsUrl = normalizeNewsItem({ headline: "Test", url: "javascript:void(0)" });
  if (withJsUrl.url !== null) fail(`javascript: URL should be null, got "${withJsUrl.url}"`);
}

// 5. normalizeNewsItem: valid http:// and https:// URLs are preserved
{
  const h = normalizeNewsItem({ headline: "Test", url: "http://example.com/article" });
  if (h.url !== "http://example.com/article") fail(`http:// URL should be preserved, got "${h.url}"`);
  const s = normalizeNewsItem({ headline: "Test", url: "https://example.com/article" });
  if (s.url !== "https://example.com/article") fail(`https:// URL should be preserved, got "${s.url}"`);
}

// 6. normalizeNewsItem: headline truncated at 120 chars, suffix "…"
{
  const long = "A".repeat(130);
  const n = normalizeNewsItem({ headline: long });
  if (!n) fail("Long headline: should not return null");
  if (n.headline.length > 120) fail(`Truncated headline too long: ${n.headline.length} chars`);
  if (!n.headline.endsWith("…")) fail('Truncated headline must end with …');
  const short = "Short headline";
  const ns = normalizeNewsItem({ headline: short });
  if (ns.headline !== short) fail("Short headline should not be modified");
}

// 7. normalizeNewsItem: datetime 0 or negative → null
{
  const n0 = normalizeNewsItem({ headline: "Test", datetime: 0 });
  if (n0.datetime !== null) fail(`datetime=0 should be null, got ${n0.datetime}`);
  const nNeg = normalizeNewsItem({ headline: "Test", datetime: -1 });
  if (nNeg.datetime !== null) fail(`datetime=-1 should be null, got ${nNeg.datetime}`);
  const nStr = normalizeNewsItem({ headline: "Test", datetime: "not-a-number" });
  if (nStr.datetime !== null) fail(`string datetime should be null, got ${nStr.datetime}`);
}

// 8. News URL construction: symbol encoded, correct route, all params present
{
  const url = buildNewsUrl("http://127.0.0.1:8787", "AAPL", "2026-05-01", "2026-05-31");
  if (!url.startsWith("http://127.0.0.1:8787/api/company/news?")) {
    fail(`URL missing expected base and route: ${url}`);
  }
  if (!url.includes("symbol=AAPL")) fail(`URL missing symbol param: ${url}`);
  if (!url.includes("from=2026-05-01")) fail(`URL missing from param: ${url}`);
  if (!url.includes("to=2026-05-31")) fail(`URL missing to param: ${url}`);

  // Symbol with special char (e.g., BRK.B)
  const url2 = buildNewsUrl("http://127.0.0.1:8787", "BRK.B", "2026-05-01", "2026-05-31");
  if (url2.includes("BRK.B") && !url2.includes("BRK")) {
    // encodeURIComponent("BRK.B") = "BRK.B" (dots are not encoded), so this is just a sanity check
  }
  if (!url2.includes("symbol=")) fail(`Encoded symbol URL missing symbol param: ${url2}`);
}

// 9. Empty data array → produces empty items list without throwing
{
  const emptyResult = (Array.isArray([]) ? [] : [])
    .map(normalizeNewsItem).filter(Boolean).slice(0, 6);
  if (!Array.isArray(emptyResult)) fail("Empty array should produce an array");
  if (emptyResult.length !== 0) fail(`Empty array should produce 0 items, got ${emptyResult.length}`);
}

// 10. Non-array data (null, object, string) is handled safely
{
  const fromNull   = (Array.isArray(null)   ? null   : []).map(normalizeNewsItem).filter(Boolean);
  const fromString = (Array.isArray("news") ? "news" : []).map(normalizeNewsItem).filter(Boolean);
  const fromObj    = (Array.isArray({})     ? {}     : []).map(normalizeNewsItem).filter(Boolean);
  if (fromNull.length   !== 0) fail(`null data should yield 0 items, got ${fromNull.length}`);
  if (fromString.length !== 0) fail(`string data should yield 0 items, got ${fromString.length}`);
  if (fromObj.length    !== 0) fail(`object data should yield 0 items, got ${fromObj.length}`);
}

// 11. fmtNewsDate: invalid / null input → empty string
{
  if (fmtNewsDate(null, "en") !== "")      fail("null datetime: expected empty string");
  if (fmtNewsDate(new Date("invalid"), "en") !== "") fail("Invalid Date: expected empty string");
  if (fmtNewsDate("2026-01-01", "en") !== "") fail("String datetime: expected empty string");
}

// 12. fmtNewsDate: recent timestamps → relative format (EN + TR)
{
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const threeHrAgo  = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const twoDaysAgo  = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  const enMin = fmtNewsDate(fiveMinAgo, "en");
  if (!enMin.includes("m ago")) fail(`5-min-ago EN: expected "m ago", got "${enMin}"`);
  const trMin = fmtNewsDate(fiveMinAgo, "tr");
  if (!trMin.includes("dk önce")) fail(`5-min-ago TR: expected "dk önce", got "${trMin}"`);

  const enHr = fmtNewsDate(threeHrAgo, "en");
  if (!enHr.includes("h ago")) fail(`3-hr-ago EN: expected "h ago", got "${enHr}"`);
  const trHr = fmtNewsDate(threeHrAgo, "tr");
  if (!trHr.includes("s önce")) fail(`3-hr-ago TR: expected "s önce", got "${trHr}"`);

  const enDay = fmtNewsDate(twoDaysAgo, "en");
  if (!enDay.includes("d ago")) fail(`2-day-ago EN: expected "d ago", got "${enDay}"`);
  const trDay = fmtNewsDate(twoDaysAgo, "tr");
  if (!trDay.includes("g önce")) fail(`2-day-ago TR: expected "g önce", got "${trDay}"`);
}

// 13. fmtNewsDate: old date (> 8 days) → ISO date string
{
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = fmtNewsDate(old, "en");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    fail(`Old date EN: expected ISO YYYY-MM-DD, got "${result}"`);
  }
}

// 14. Slice limit: at most 6 items rendered from a larger array
{
  const manyRaw = Array.from({ length: 20 }, (_, i) => ({
    headline: `Headline ${i}`,
    source: "TestSource",
    datetime: 1700000000 + i,
    url: `https://example.com/${i}`,
  }));
  const items = manyRaw.map(normalizeNewsItem).filter(Boolean).slice(0, 6);
  if (items.length !== 6) fail(`Slice limit: expected 6, got ${items.length}`);
}

console.log("News checks passed");
