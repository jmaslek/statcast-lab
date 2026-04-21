import { useEffect, useRef } from "react";
import { select, pointer } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { area, line, curveStepAfter } from "d3-shape";
import { axisLeft } from "d3-axis";
import { useContainerSize } from "@/hooks/use-container-size";
import { createTooltip, showTooltip, hideTooltip } from "@/lib/chart-utils";
import type { PitchDetail } from "@/hooks/use-games";

interface Props {
  pitches: PitchDetail[];
  homeTeam: string;
  awayTeam: string;
}

export default function WinProbabilityChart({ pitches, homeTeam, awayTeam }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: containerRef, width: containerWidth } = useContainerSize(700);
  const width = containerWidth || 700;
  const height = width * 0.4;

  useEffect(() => {
    if (!svgRef.current || !pitches.length || !width) return;

    // Filter to pitches with WPA data
    const wpaData = pitches
      .filter((p) => p.home_win_exp != null)
      .map((p, i) => ({
        index: i,
        wp: p.home_win_exp! * 100,
        inning: p.inning,
        topbot: p.inning_topbot,
        events: p.events,
        batterName: p.batter_name,
        pitcherName: p.pitcher_name,
      }));

    if (wpaData.length === 0) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 35, left: 45 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = scaleLinear().domain([0, wpaData.length - 1]).range([0, w]);
    const yScale = scaleLinear().domain([0, 100]).range([h, 0]);

    // 50% reference line
    g.append("line")
      .attr("x1", 0).attr("y1", yScale(50))
      .attr("x2", w).attr("y2", yScale(50))
      .attr("stroke", "currentColor").attr("stroke-opacity", 0.2)
      .attr("stroke-dasharray", "4,3");

    // Grid lines at 25% and 75%
    [25, 75].forEach((pct) => {
      g.append("line")
        .attr("x1", 0).attr("y1", yScale(pct))
        .attr("x2", w).attr("y2", yScale(pct))
        .attr("stroke", "currentColor").attr("stroke-opacity", 0.08);
    });

    // Area fill above/below 50%
    const area50Above = area<typeof wpaData[0]>()
      .x((d) => xScale(d.index))
      .y0(yScale(50))
      .y1((d) => Math.min(yScale(50), yScale(d.wp)))
      .curve(curveStepAfter);

    const area50Below = area<typeof wpaData[0]>()
      .x((d) => xScale(d.index))
      .y0(yScale(50))
      .y1((d) => Math.max(yScale(50), yScale(d.wp)))
      .curve(curveStepAfter);

    g.append("path")
      .datum(wpaData)
      .attr("d", area50Above)
      .attr("fill", "#22c55e")
      .attr("fill-opacity", 0.1);

    g.append("path")
      .datum(wpaData)
      .attr("d", area50Below)
      .attr("fill", "#3b82f6")
      .attr("fill-opacity", 0.1);

    // WPA line
    const lineFn = line<typeof wpaData[0]>()
      .x((d) => xScale(d.index))
      .y((d) => yScale(d.wp))
      .curve(curveStepAfter);

    g.append("path")
      .datum(wpaData)
      .attr("fill", "none")
      .attr("stroke", "currentColor")
      .attr("stroke-width", 1.5)
      .attr("d", lineFn);

    // Tooltip
    const tooltip = createTooltip();

    // Invisible hover rect
    g.append("rect")
      .attr("width", w).attr("height", h)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mousemove", (event: MouseEvent) => {
        const [mx] = pointer(event, g.node());
        const idx = Math.round(xScale.invert(mx));
        const d = wpaData[Math.max(0, Math.min(idx, wpaData.length - 1))];
        if (!d) return;

        showTooltip(
          tooltip,
          `<strong>${d.wp.toFixed(1)}%</strong> ${homeTeam} win prob<br/>` +
            `${d.topbot === "Top" ? "Top" : "Bot"} ${d.inning}` +
            (d.events ? `<br/>${d.events.replace(/_/g, " ")}` : "") +
            (d.batterName ? `<br/>${d.batterName}` : ""),
          event,
        );
      })
      .on("mouseleave", () => hideTooltip(tooltip));

    // Axes
    // X axis: inning markers
    const inningStarts: { inning: number; idx: number }[] = [];
    let lastInning = 0;
    wpaData.forEach((d) => {
      if (d.inning !== lastInning) {
        inningStarts.push({ inning: d.inning, idx: d.index });
        lastInning = d.inning;
      }
    });

    inningStarts.forEach(({ inning, idx }) => {
      g.append("line")
        .attr("x1", xScale(idx)).attr("y1", 0)
        .attr("x2", xScale(idx)).attr("y2", h)
        .attr("stroke", "currentColor").attr("stroke-opacity", 0.06);

      g.append("text")
        .attr("x", xScale(idx) + 4).attr("y", h + 14)
        .attr("font-size", "10px").attr("fill", "currentColor")
        .attr("fill-opacity", 0.5).text(String(inning));
    });

    // Y axis
    const yAxis = axisLeft(yScale).ticks(5).tickFormat((d) => `${d}%`);
    g.append("g").call(yAxis).selectAll("text").attr("fill", "currentColor");

    // Team labels
    g.append("text")
      .attr("x", w - 4).attr("y", 12)
      .attr("text-anchor", "end").attr("font-size", "10px")
      .attr("fill", "#22c55e").attr("fill-opacity", 0.7)
      .text(`${homeTeam} Win`);

    g.append("text")
      .attr("x", w - 4).attr("y", h - 4)
      .attr("text-anchor", "end").attr("font-size", "10px")
      .attr("fill", "#3b82f6").attr("fill-opacity", 0.7)
      .text(`${awayTeam} Win`);

    return () => { tooltip.remove(); };
  }, [pitches, width, height, homeTeam, awayTeam]);

  const hasWpa = pitches.some((p) => p.home_win_exp != null);

  if (!hasWpa) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        No win probability data available for this game
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg
        ref={svgRef}
        role="img"
        aria-label={`Win probability chart for ${awayTeam} at ${homeTeam}`}
      />
    </div>
  );
}
