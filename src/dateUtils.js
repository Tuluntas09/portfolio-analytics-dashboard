/**
 * src/dateUtils.js — pure date helpers for the custom date range feature (Phase 8d).
 * No DOM or React dependencies — importable by Node.js test scripts.
 */

export function getDefaultCustomFrom() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 900);
  return d.toISOString().slice(0, 10);
}

export function validateDateRange(from, to) {
  if (!from || !to) return "dateRangeMissing";
  const f = new Date(from);
  const end = new Date(to);
  if (isNaN(f.getTime()) || isNaN(end.getTime())) return "dateRangeMissing";
  if (f >= end) return "dateRangeStartAfterEnd";
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (end > today) return "dateRangeFutureEnd";
  const diffDays = (end - f) / (1000 * 60 * 60 * 24);
  if (diffDays < 30) return "dateRangeTooShort";
  return null;
}

export function calendarToTradingDays(fromStr, toStr) {
  const ms = new Date(toStr) - new Date(fromStr);
  return Math.max(30, Math.round(ms / (1000 * 60 * 60 * 24) * 5 / 7));
}
