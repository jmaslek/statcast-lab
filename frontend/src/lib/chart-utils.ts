import { select } from "d3-selection";
import type { Selection } from "d3-selection";

// ---- Shared color palettes for D3 charts ----

/** Pitch type colors (keyed by Statcast pitch_type abbreviation) */
export const PITCH_COLORS: Record<string, string> = {
  FF: "#ef4444", // Four-seam Fastball - red
  SI: "#f97316", // Sinker - orange
  SL: "#eab308", // Slider - yellow
  CU: "#3b82f6", // Curveball - blue
  CH: "#22c55e", // Changeup - green
  FC: "#a855f7", // Cutter - purple
  FS: "#14b8a6", // Splitter - teal
  KC: "#6366f1", // Knuckle Curve - indigo
  ST: "#ec4899", // Sweeper - pink
  SV: "#d946ef", // Slurve - fuchsia
};

export function pitchColor(pitchType: string): string {
  return PITCH_COLORS[pitchType] ?? "#94a3b8";
}

/** Batted-ball event colors */
export const EVENT_COLORS: Record<string, string> = {
  home_run: "#ef4444",
  triple: "#f97316",
  double: "#eab308",
  single: "#22c55e",
  field_out: "#94a3b8",
  grounded_into_double_play: "#94a3b8",
  force_out: "#94a3b8",
  sac_fly: "#94a3b8",
  fielders_choice: "#94a3b8",
  double_play: "#94a3b8",
};

export function eventColor(event: string): string {
  return EVENT_COLORS[event] ?? "#64748b";
}

/** General-purpose chart palette for multi-series comparisons */
export const CHART_COLORS = [
  "#3b82f6", // blue (primary)
  "#f97316", // orange
  "#22c55e", // green
  "#a855f7", // purple
  "#eab308", // yellow
];

/** Pitch result color for mini strike zone display */
export function pitchResultColor(description: string): string {
  const d = description.toLowerCase();
  if (d.includes("called_strike") || d.includes("swinging_strike"))
    return "#ef4444";
  if (d.includes("ball") || d.includes("blocked")) return "#3b82f6";
  if (d.includes("foul")) return "#f59e0b";
  if (d.includes("hit_into_play")) return "#22c55e";
  return "#94a3b8";
}

// ---- Theme utilities ----

/** Read current theme colors from CSS custom properties */
export function getChartTheme() {
  const style = getComputedStyle(document.documentElement);
  const get = (prop: string, fallback: string) =>
    style.getPropertyValue(prop).trim() || fallback;
  return {
    foreground: get("--foreground", "#18181b"),
    mutedForeground: get("--muted-foreground", "#71717a"),
    border: get("--border", "#e4e4e7"),
  };
}

/** Create a theme-aware tooltip div appended to body. Returns the d3 selection. */
export function createTooltip() {
  return select("body")
    .append("div")
    .attr("class", "chart-tooltip")
    .style("opacity", "0");
}

/** Position and show a tooltip */
export function showTooltip(
  tooltip: Selection<HTMLDivElement, unknown, HTMLElement, unknown>,
  html: string,
  event: MouseEvent,
) {
  tooltip
    .html(html)
    .style("opacity", "1")
    .style("left", `${event.pageX + 12}px`)
    .style("top", `${event.pageY - 10}px`);
}

/** Move a visible tooltip */
export function moveTooltip(
  tooltip: Selection<HTMLDivElement, unknown, HTMLElement, unknown>,
  event: MouseEvent,
) {
  tooltip
    .style("left", `${event.pageX + 12}px`)
    .style("top", `${event.pageY - 10}px`);
}

/** Hide the tooltip */
export function hideTooltip(
  tooltip: Selection<HTMLDivElement, unknown, HTMLElement, unknown>,
) {
  tooltip.style("opacity", "0");
}
