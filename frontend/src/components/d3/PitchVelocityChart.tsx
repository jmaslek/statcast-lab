import { useEffect, useRef } from "react";
import { select } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { extent } from "d3-array";
import { axisLeft } from "d3-axis";
import { useContainerSize } from "@/hooks/use-container-size";
import { pitchColor, createTooltip, showTooltip, moveTooltip, hideTooltip } from "@/lib/chart-utils";
import type { PitchDetail } from "@/hooks/use-games";

interface Props {
  pitches: PitchDetail[];
}

export default function PitchVelocityChart({ pitches }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: containerRef, width: containerWidth } = useContainerSize(700);
  const width = containerWidth || 700;
  const height = width * 0.35;

  useEffect(() => {
    if (!svgRef.current || !pitches.length || !width) return;

    const veloData = pitches
      .filter((p) => p.release_speed != null && p.pitch_type)
      .map((p, i) => ({
        index: i,
        velo: p.release_speed!,
        pitchType: p.pitch_type!,
        pitcherName: p.pitcher_name,
        inning: p.inning,
        topbot: p.inning_topbot,
      }));

    if (veloData.length === 0) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 15, right: 20, bottom: 35, left: 45 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = scaleLinear().domain([0, veloData.length - 1]).range([0, w]);

    const veloExtent = extent(veloData, (d) => d.velo) as [number, number];
    const pad = (veloExtent[1] - veloExtent[0]) * 0.1 || 2;
    const yScale = scaleLinear()
      .domain([veloExtent[0] - pad, veloExtent[1] + pad])
      .range([h, 0]);

    // Grid
    const yTicks = yScale.ticks(5);
    yTicks.forEach((tick) => {
      g.append("line")
        .attr("x1", 0).attr("y1", yScale(tick))
        .attr("x2", w).attr("y2", yScale(tick))
        .attr("stroke", "currentColor").attr("stroke-opacity", 0.08);
    });

    // Inning markers
    let lastInning = 0;
    veloData.forEach((d) => {
      if (d.inning !== lastInning) {
        g.append("line")
          .attr("x1", xScale(d.index)).attr("y1", 0)
          .attr("x2", xScale(d.index)).attr("y2", h)
          .attr("stroke", "currentColor").attr("stroke-opacity", 0.06);
        g.append("text")
          .attr("x", xScale(d.index) + 4).attr("y", h + 14)
          .attr("font-size", "10px").attr("fill", "currentColor")
          .attr("fill-opacity", 0.5).text(String(d.inning));
        lastInning = d.inning;
      }
    });

    // Tooltip
    const tooltip = createTooltip();

    // Dots
    g.selectAll("circle")
      .data(veloData)
      .join("circle")
      .attr("cx", (d) => xScale(d.index))
      .attr("cy", (d) => yScale(d.velo))
      .attr("r", 2.5)
      .attr("fill", (d) => pitchColor(d.pitchType))
      .attr("fill-opacity", 0.7)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        select(this).attr("r", 5).attr("fill-opacity", 1);
        showTooltip(
          tooltip,
          `<strong>${d.velo.toFixed(1)} mph</strong><br/>` +
            `${d.pitchType} &middot; ${d.topbot === "Top" ? "Top" : "Bot"} ${d.inning}` +
            (d.pitcherName ? `<br/>${d.pitcherName}` : ""),
          event,
        );
      })
      .on("mousemove", function (event) { moveTooltip(tooltip, event); })
      .on("mouseleave", function () {
        select(this).attr("r", 2.5).attr("fill-opacity", 0.7);
        hideTooltip(tooltip);
      });

    // Y axis
    const yAxis = axisLeft(yScale).ticks(5).tickFormat((d) => `${d}`);
    g.append("g").call(yAxis).selectAll("text").attr("fill", "currentColor");

    g.append("text")
      .attr("x", -h / 2).attr("y", -35)
      .attr("text-anchor", "middle").attr("font-size", "11px")
      .attr("fill", "currentColor").attr("transform", "rotate(-90)")
      .text("Velocity (mph)");

    // Legend (pitch types in this game)
    const types = Array.from(new Set(veloData.map((d) => d.pitchType)));
    const legend = g.append("g")
      .attr("transform", `translate(${w - types.length * 55}, ${-8})`);

    types.forEach((pt, i) => {
      const lg = legend.append("g").attr("transform", `translate(${i * 55}, 0)`);
      lg.append("circle").attr("cx", 0).attr("cy", 0).attr("r", 4)
        .attr("fill", pitchColor(pt));
      lg.append("text").attr("x", 7).attr("y", 4)
        .attr("font-size", "10px").attr("fill", "currentColor").text(pt);
    });

    return () => { tooltip.remove(); };
  }, [pitches, width, height]);

  const hasVelo = pitches.some((p) => p.release_speed != null);

  if (!hasVelo) {
    return (
      <div className="flex items-center justify-center h-[150px] text-muted-foreground text-sm">
        No velocity data available
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg
        ref={svgRef}
        role="img"
        aria-label={`Pitch velocity chart showing ${pitches.length} pitches over the game`}
      />
    </div>
  );
}
