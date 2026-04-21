import { Fragment, useEffect, useRef } from "react";
import { select } from "d3-selection";
import { symbol, symbolCircle, symbolDiamond, symbolTriangle, symbolSquare } from "d3-shape";
import type {
  PitcherMovementSet,
  LeagueAverageMovement,
} from "@/types/player";
import { useContainerSize } from "@/hooks/use-container-size";
import { pitchColor, createTooltip, showTooltip, moveTooltip, hideTooltip } from "@/lib/chart-utils";
import { CHART_COLORS } from "@/lib/chart-utils";

interface Props {
  pitchers: PitcherMovementSet[];
  leagueAverages?: LeagueAverageMovement[];
}

/** Shape markers to distinguish pitchers on the overlay */
const SHAPES = [symbolCircle, symbolDiamond, symbolTriangle, symbolSquare];

export default function ArsenalComparisonPlot({
  pitchers,
  leagueAverages,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: containerRef, width: containerWidth } = useContainerSize(560);
  const width = containerWidth || 560;
  const height = width;

  useEffect(() => {
    if (!svgRef.current || !pitchers.length || !width) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const cx = w / 2;
    const cy = h / 2;

    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const maxRadius = 24;
    const pxPerInch = Math.min(w, h) / 2 / maxRadius;

    const xScale = (inches: number) => cx + inches * pxPerInch;
    const yScale = (inches: number) => cy - inches * pxPerInch;

    // Hatch patterns for league averages
    const defs = svg.append("defs");
    const allPitchTypes = new Set<string>();
    pitchers.forEach((p) => p.points.forEach((pt) => allPitchTypes.add(pt.pitch_type)));

    allPitchTypes.forEach((pt) => {
      const color = pitchColor(pt);
      const pattern = defs
        .append("pattern")
        .attr("id", `hatch-cmp-${pt}`)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 6)
        .attr("height", 6);
      pattern
        .append("path")
        .attr("d", "M0,6 L6,0")
        .attr("stroke", color)
        .attr("stroke-width", 1.2)
        .attr("stroke-opacity", 0.5);
    });

    // Polar grid
    const ringRadii = [6, 12, 18, 24];
    ringRadii.forEach((r) => {
      g.append("circle")
        .attr("cx", cx).attr("cy", cy).attr("r", r * pxPerInch)
        .attr("fill", "none").attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.12);

      g.append("text")
        .attr("x", cx + r * pxPerInch + 3).attr("y", cy - 3)
        .attr("font-size", "9px").attr("fill", "currentColor")
        .attr("fill-opacity", 0.4).text(`${r}"`);
    });

    // Crosshair
    g.append("line")
      .attr("x1", cx).attr("y1", 0).attr("x2", cx).attr("y2", h)
      .attr("stroke", "currentColor").attr("stroke-opacity", 0.2);
    g.append("line")
      .attr("x1", 0).attr("y1", cy).attr("x2", w).attr("y2", cy)
      .attr("stroke", "currentColor").attr("stroke-opacity", 0.2);

    // Labels
    g.append("text")
      .attr("x", cx).attr("y", 8).attr("text-anchor", "middle")
      .attr("font-size", "10px").attr("font-weight", "600")
      .attr("fill", "currentColor").attr("fill-opacity", 0.5)
      .text("MORE RISE");
    g.append("text")
      .attr("x", cx).attr("y", h - 2).attr("text-anchor", "middle")
      .attr("font-size", "10px").attr("font-weight", "600")
      .attr("fill", "currentColor").attr("fill-opacity", 0.5)
      .text("MORE DROP");

    // League average ellipses
    if (leagueAverages?.length) {
      leagueAverages.forEach((la) => {
        if (!allPitchTypes.has(la.pitch_type)) return;
        g.append("ellipse")
          .attr("cx", xScale(la.avg_pfx_x))
          .attr("cy", yScale(la.avg_pfx_z))
          .attr("rx", la.std_pfx_x * pxPerInch)
          .attr("ry", la.std_pfx_z * pxPerInch)
          .attr("fill", `url(#hatch-cmp-${la.pitch_type})`)
          .attr("fill-opacity", 0.2)
          .attr("stroke", pitchColor(la.pitch_type))
          .attr("stroke-opacity", 0.3)
          .attr("stroke-dasharray", "4,3");
      });
    }

    const tooltip = createTooltip();

    // Draw each pitcher's points with distinct shapes
    pitchers.forEach((pitcher, pIdx) => {
      const shape = symbol().type(SHAPES[pIdx % SHAPES.length]).size(40);

      g.append("g")
        .selectAll("path")
        .data(pitcher.points)
        .join("path")
        .attr("d", shape)
        .attr("transform", (d) => `translate(${xScale(d.pfx_x)},${yScale(d.pfx_z)})`)
        .attr("fill", (d) => pitchColor(d.pitch_type))
        .attr("fill-opacity", 0.55)
        .attr("stroke", CHART_COLORS[pIdx % CHART_COLORS.length])
        .attr("stroke-width", 0.8)
        .attr("stroke-opacity", 0.8)
        .style("cursor", "pointer")
        .on("mouseenter", function (event, d) {
          select(this).attr("fill-opacity", 1);
          showTooltip(
            tooltip,
            `<strong>${pitcher.name}</strong><br/>` +
              `${d.pitch_name ?? d.pitch_type}<br/>` +
              `Horiz: ${d.pfx_x.toFixed(1)}" | Vert: ${d.pfx_z.toFixed(1)}"<br/>` +
              `Velo: ${d.release_speed != null ? `${d.release_speed.toFixed(1)} mph` : "N/A"}`,
            event,
          );
        })
        .on("mousemove", function (event) {
          moveTooltip(tooltip, event);
        })
        .on("mouseleave", function () {
          select(this).attr("fill-opacity", 0.55);
          hideTooltip(tooltip);
        });
    });

    return () => {
      tooltip.remove();
    };
  }, [pitchers, leagueAverages, width, height]);

  if (!pitchers.length || pitchers.every((p) => !p.points.length)) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        Select two pitchers to compare
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} className="w-full max-w-[560px]">
        <svg
          ref={svgRef}
          role="img"
          aria-label="Arsenal comparison movement plot"
        />
      </div>

      {/* Legend */}
      <div className="flex gap-6 justify-center mt-3">
        {pitchers.map((p, i) => (
          <div key={p.pitcher_id} className="flex items-center gap-2 text-sm">
            <svg width="16" height="16" viewBox="-8 -8 16 16">
              <path
                d={symbol().type(SHAPES[i % SHAPES.length]).size(80)() ?? ""}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.7}
              />
            </svg>
            <span className="font-medium">{p.name}</span>
          </div>
        ))}
      </div>

      {/* Side-by-side pitch metrics table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium">Pitch</th>
              {pitchers.map((p) => (
                <th key={p.pitcher_id} colSpan={4} className="text-center py-2 px-3 font-medium border-l">
                  {p.name}
                </th>
              ))}
            </tr>
            <tr className="border-b text-xs text-muted-foreground">
              <th />
              {pitchers.map((p) => (
                <Fragment key={p.pitcher_id}>
                  <th className="py-1 px-2 text-right border-l">Usage</th>
                  <th className="py-1 px-2 text-right">Velo</th>
                  <th className="py-1 px-2 text-right">H. Break</th>
                  <th className="py-1 px-2 text-right">V. Break</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {getAllPitchTypes(pitchers).map((pt) => (
              <tr key={pt} className="border-b last:border-0">
                <td className="py-2 px-3 flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: pitchColor(pt) }}
                  />
                  <span className="font-medium">{getPitchName(pitchers, pt)}</span>
                </td>
                {pitchers.map((p) => {
                  const ps = p.pitch_summary.find((s) => s.pitch_type === pt);
                  const avgMove = getAvgMovement(p, pt);
                  return (
                    <Fragment key={p.pitcher_id}>
                      <td className="py-2 px-2 text-right tabular-nums border-l">
                        {ps ? `${ps.usage_pct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {ps?.avg_speed != null ? ps.avg_speed.toFixed(1) : "—"}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {avgMove ? `${avgMove.x.toFixed(1)}"` : "—"}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {avgMove ? `${avgMove.z.toFixed(1)}"` : "—"}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getAllPitchTypes(pitchers: PitcherMovementSet[]): string[] {
  const types = new Set<string>();
  pitchers.forEach((p) => p.pitch_summary.forEach((s) => types.add(s.pitch_type)));
  return Array.from(types).sort();
}

function getPitchName(pitchers: PitcherMovementSet[], pitchType: string): string {
  for (const p of pitchers) {
    const s = p.pitch_summary.find((ps) => ps.pitch_type === pitchType);
    if (s?.pitch_name) return s.pitch_name;
  }
  return pitchType;
}

function getAvgMovement(pitcher: PitcherMovementSet, pitchType: string) {
  const pts = pitcher.points.filter((p) => p.pitch_type === pitchType);
  if (!pts.length) return null;
  const x = pts.reduce((s, p) => s + p.pfx_x, 0) / pts.length;
  const z = pts.reduce((s, p) => s + p.pfx_z, 0) / pts.length;
  return { x, z };
}
