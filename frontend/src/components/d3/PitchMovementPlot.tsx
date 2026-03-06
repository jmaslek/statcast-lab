import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type {
  MovementPoint,
  LeagueAverageMovement,
  PitchTypeSummary,
} from "@/types/player";

interface Props {
  data: MovementPoint[];
  leagueAverages?: LeagueAverageMovement[];
  pitchSummary?: PitchTypeSummary[];
  pThrows?: string;
  width?: number;
  height?: number;
}

const PITCH_COLORS: Record<string, string> = {
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

function pitchColor(pitchType: string): string {
  return PITCH_COLORS[pitchType] ?? "#94a3b8";
}

export default function PitchMovementPlot({
  data,
  leagueAverages,
  pitchSummary,
  pThrows,
  width = 520,
  height = 520,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
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

    // Determine scale: fixed at 24" max radius
    const maxRadius = 24;
    const pxPerInch = Math.min(w, h) / 2 / maxRadius;

    const xScale = (inches: number) => cx + inches * pxPerInch;
    const yScale = (inches: number) => cy - inches * pxPerInch;

    // Defs for hatch patterns
    const defs = svg.append("defs");
    const pitchTypes = Array.from(new Set(data.map((d) => d.pitch_type)));

    pitchTypes.forEach((pt) => {
      const color = pitchColor(pt);
      const pattern = defs
        .append("pattern")
        .attr("id", `hatch-${pt}`)
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

    // Polar grid: concentric circles
    const ringRadii = [6, 12, 18, 24];
    ringRadii.forEach((r) => {
      g.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", r * pxPerInch)
        .attr("fill", "none")
        .attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.12)
        .attr("stroke-width", 1);

      // Label on right side of each ring
      g.append("text")
        .attr("x", cx + r * pxPerInch + 3)
        .attr("y", cy - 3)
        .attr("font-size", "9px")
        .attr("fill", "currentColor")
        .attr("fill-opacity", 0.4)
        .text(`${r}"`);
    });

    // Crosshair lines through origin
    g.append("line")
      .attr("x1", cx)
      .attr("y1", 0)
      .attr("x2", cx)
      .attr("y2", h)
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.2)
      .attr("stroke-width", 1);

    g.append("line")
      .attr("x1", 0)
      .attr("y1", cy)
      .attr("x2", w)
      .attr("y2", cy)
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.2)
      .attr("stroke-width", 1);

    // Directional labels
    g.append("text")
      .attr("x", cx)
      .attr("y", 8)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("fill", "currentColor")
      .attr("fill-opacity", 0.5)
      .text("MORE RISE");

    g.append("text")
      .attr("x", cx)
      .attr("y", h - 2)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("fill", "currentColor")
      .attr("fill-opacity", 0.5)
      .text("MORE DROP");

    const armSide = pThrows === "L" ? "Toward 3B" : "Toward 3B";
    const gloveSide = pThrows === "L" ? "Toward 1B" : "Toward 1B";

    g.append("text")
      .attr("x", 4)
      .attr("y", cy - 6)
      .attr("text-anchor", "start")
      .attr("font-size", "9px")
      .attr("fill", "currentColor")
      .attr("fill-opacity", 0.45)
      .text(`◀ ${gloveSide}`);

    g.append("text")
      .attr("x", w - 4)
      .attr("y", cy - 6)
      .attr("text-anchor", "end")
      .attr("font-size", "9px")
      .attr("fill", "currentColor")
      .attr("fill-opacity", 0.45)
      .text(`${armSide} ▶`);

    // League average ellipses (behind dots)
    if (leagueAverages?.length) {
      const ellipseGroup = g.append("g").attr("class", "league-ellipses");
      leagueAverages.forEach((la) => {
        if (!pitchTypes.includes(la.pitch_type)) return;
        ellipseGroup
          .append("ellipse")
          .attr("cx", xScale(la.avg_pfx_x))
          .attr("cy", yScale(la.avg_pfx_z))
          .attr("rx", la.std_pfx_x * pxPerInch)
          .attr("ry", la.std_pfx_z * pxPerInch)
          .attr("fill", `url(#hatch-${la.pitch_type})`)
          .attr("fill-opacity", 0.25)
          .attr("stroke", pitchColor(la.pitch_type))
          .attr("stroke-opacity", 0.35)
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4,3");
      });
    }

    // Velocity scale for point size
    const veloExtent = d3.extent(
      data.filter((d) => d.release_speed != null),
      (d) => d.release_speed!,
    ) as [number, number];
    const sizeScale = d3
      .scaleLinear()
      .domain(veloExtent[0] != null ? veloExtent : [70, 100])
      .range([3, 6])
      .clamp(true);

    // Tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "movement-tooltip")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "hsl(0 0% 9% / 0.92)")
      .style("color", "#fafafa")
      .style("padding", "6px 10px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("line-height", "1.5")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.3)")
      .style("opacity", 0)
      .style("z-index", "9999");

    // Scatter dots
    g.append("g")
      .attr("class", "dots")
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", (d) => xScale(d.pfx_x))
      .attr("cy", (d) => yScale(d.pfx_z))
      .attr("r", (d) =>
        d.release_speed != null ? sizeScale(d.release_speed) : 4,
      )
      .attr("fill", (d) => pitchColor(d.pitch_type))
      .attr("fill-opacity", 0.7)
      .attr("stroke", (d) => pitchColor(d.pitch_type))
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("r", 8).attr("fill-opacity", 1);
        tooltip
          .html(
            `<strong>${d.pitch_name ?? d.pitch_type}</strong><br/>` +
              `Horiz: ${d.pfx_x.toFixed(1)}" | Vert: ${d.pfx_z.toFixed(1)}"<br/>` +
              `Velo: ${d.release_speed != null ? `${d.release_speed.toFixed(1)} mph` : "N/A"}`,
          )
          .style("opacity", 1)
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY - 10}px`);
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY - 10}px`);
      })
      .on("mouseleave", function (_event, d) {
        d3.select(this)
          .attr(
            "r",
            d.release_speed != null ? sizeScale(d.release_speed) : 4,
          )
          .attr("fill-opacity", 0.7);
        tooltip.style("opacity", 0);
      });

    return () => {
      tooltip.remove();
    };
  }, [data, leagueAverages, width, height, pThrows]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No pitch movement data available
      </div>
    );
  }

  // Build pitch name lookup for the table
  const pitchNames = new Map<string, string>();
  data.forEach((d) => {
    if (d.pitch_name && !pitchNames.has(d.pitch_type)) {
      pitchNames.set(d.pitch_type, d.pitch_name);
    }
  });

  return (
    <div>
      <svg ref={svgRef} />
      {pitchSummary && pitchSummary.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-medium">Pitch</th>
                <th className="text-right py-2 px-3 font-medium">Usage%</th>
                <th className="text-right py-2 px-3 font-medium">Count</th>
                <th className="text-right py-2 px-3 font-medium">Velo</th>
                <th className="text-right py-2 px-3 font-medium">Lg Velo</th>
              </tr>
            </thead>
            <tbody>
              {pitchSummary
                .sort((a, b) => b.usage_pct - a.usage_pct)
                .map((ps) => (
                  <tr key={ps.pitch_type} className="border-b last:border-0">
                    <td className="py-2 px-3 flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: pitchColor(ps.pitch_type) }}
                      />
                      <span className="font-medium">
                        {ps.pitch_name ??
                          pitchNames.get(ps.pitch_type) ??
                          ps.pitch_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {ps.usage_pct.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {ps.count}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {ps.avg_speed != null ? ps.avg_speed.toFixed(1) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                      {ps.league_avg_speed != null
                        ? ps.league_avg_speed.toFixed(1)
                        : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
