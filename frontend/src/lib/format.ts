/** Shared formatting utilities for stat display */

export function fmtAvg(val: number): string {
  return val.toFixed(3).replace(/^0/, "");
}

export function fmtPct(val: number): string {
  return `${val.toFixed(1)}%`;
}

export function fmtDec1(val: number): string {
  return val.toFixed(1);
}

export function fmtNullableAvg(val: number | null | undefined, fallback = "—"): string {
  return val != null ? fmtAvg(val) : fallback;
}

export function fmtNullablePct(val: number | null | undefined, fallback = "N/A"): string {
  return val != null ? fmtPct(val) : fallback;
}

export function fmtDiff(val: number): string {
  const prefix = val > 0 ? "+" : "";
  return `${prefix}${val.toFixed(3).replace(/^(-?)0/, "$1")}`;
}

export function fmtNum(val: number | undefined | null, decimals = 0): string {
  if (val == null) return "N/A";
  return decimals > 0 ? val.toFixed(decimals) : String(Math.round(val));
}

/** Returns Tailwind classes for positive/negative diff values, dark-mode safe */
export function diffColor(val: number | null): string {
  if (val == null) return "";
  if (val > 0.02) return "text-emerald-700 dark:text-emerald-400 font-semibold";
  if (val > 0) return "text-emerald-600 dark:text-emerald-400";
  if (val < -0.02) return "text-rose-700 dark:text-rose-400 font-semibold";
  if (val < 0) return "text-rose-600 dark:text-rose-400";
  return "";
}

/** Returns ▲ / ▼ / "" for positive/negative values (colorblind-safe secondary indicator) */
export function diffArrow(val: number | null): string {
  if (val == null) return "";
  if (val > 0) return "▲";
  if (val < 0) return "▼";
  return "";
}
