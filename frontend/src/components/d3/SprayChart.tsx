import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { SprayChartPoint } from "@/types/player";

interface Props {
  data: SprayChartPoint[];
  width?: number;
  height?: number;
}

const EVENT_COLORS: Record<string, string> = {
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

function eventColor(event: string): string {
  return EVENT_COLORS[event] ?? "#64748b";
}

function eventLabel(event: string): string {
  return event
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function SprayChart({
  data,
  width = 500,
  height = 500,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Statcast coordinates: hc_x ~0-250, hc_y ~0-250
    // Home plate at approximately (125, 200)
    // y-axis is inverted (lower y = further from batter)
    const xScale = d3.scaleLinear().domain([0, 250]).range([0, w]);
    const yScale = d3.scaleLinear().domain([0, 250]).range([0, h]);

    const homeX = xScale(125);
    const homeY = yScale(200);

    // Draw field background
    const fieldGroup = g.append("g").attr("class", "field");

    // Foul lines from home plate outward
    // LF foul line: goes to upper-left
    // RF foul line: goes to upper-right
    // In Statcast coords, the field fans out from (125, 200)
    // LF foul line roughly goes toward (0, 50), RF toward (250, 50)
    const lfEnd = { x: xScale(-90), y: yScale(25) };
    const rfEnd = { x: xScale(340), y: yScale(25) };

    // Outfield arc
    const arcRadius = Math.hypot(rfEnd.x - homeX, rfEnd.y - homeY);

    // Draw fair territory as a path
    fieldGroup
      .append("path")
      .attr(
        "d",
        `M ${homeX} ${homeY}
         L ${lfEnd.x} ${lfEnd.y}
         A ${arcRadius} ${arcRadius} 0 0 1 ${rfEnd.x} ${rfEnd.y}
         Z`,
      )
      .attr("fill", "#16a34a")
      .attr("fill-opacity", 0.08)
      .attr("stroke", "#16a34a")
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", 1.5);

    // Foul lines
    fieldGroup
      .append("line")
      .attr("x1", homeX)
      .attr("y1", homeY)
      .attr("x2", lfEnd.x)
      .attr("y2", lfEnd.y)
      .attr("stroke", "#d4d4d8")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,3");

    fieldGroup
      .append("line")
      .attr("x1", homeX)
      .attr("y1", homeY)
      .attr("x2", rfEnd.x)
      .attr("y2", rfEnd.y)
      .attr("stroke", "#d4d4d8")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,3");

    // Infield diamond
    // Approximate base positions in Statcast coordinates
    const bases = {
      home: { x: 125, y: 200 },
      first: { x: 155, y: 175 },
      second: { x: 125, y: 155 },
      third: { x: 95, y: 175 },
    };

    const diamondPoints = [bases.home, bases.first, bases.second, bases.third]
      .map((b) => `${xScale(b.x)},${yScale(b.y)}`)
      .join(" ");

    fieldGroup
      .append("polygon")
      .attr("points", diamondPoints)
      .attr("fill", "none")
      .attr("stroke", "#a1a1aa")
      .attr("stroke-width", 1.5);

    // Base markers
    Object.values(bases).forEach((base) => {
      fieldGroup
        .append("rect")
        .attr("x", xScale(base.x) - 4)
        .attr("y", yScale(base.y) - 4)
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", "#fafafa")
        .attr("stroke", "#a1a1aa")
        .attr("stroke-width", 1)
        .attr("transform", `rotate(45,${xScale(base.x)},${yScale(base.y)})`);
    });

    // Compute launch speed range for opacity
    const speeds = data
      .map((d) => d.launch_speed)
      .filter((v): v is number => v != null);
    const speedExtent = d3.extent(speeds) as [number, number];
    const opacityScale = d3
      .scaleLinear()
      .domain(speedExtent[0] != null ? speedExtent : [60, 115])
      .range([0.3, 1])
      .clamp(true);

    // Tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "spray-chart-tooltip")
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

    // Batted ball scatter plot
    const dots = g.append("g").attr("class", "dots");

    dots
      .selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", (d) => xScale(d.hc_x))
      .attr("cy", (d) => yScale(d.hc_y))
      .attr("r", 4)
      .attr("fill", (d) => eventColor(d.events))
      .attr("fill-opacity", (d) =>
        d.launch_speed != null ? opacityScale(d.launch_speed) : 0.5,
      )
      .attr("stroke", (d) => eventColor(d.events))
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("r", 7).attr("stroke-width", 2);
        tooltip
          .html(
            `<strong>${eventLabel(d.events)}</strong><br/>` +
              `Exit Velo: ${d.launch_speed != null ? `${d.launch_speed.toFixed(1)} mph` : "N/A"}<br/>` +
              `Launch Angle: ${d.launch_angle != null ? `${d.launch_angle.toFixed(1)}deg` : "N/A"}` +
              (d.bb_type ? `<br/>Type: ${eventLabel(d.bb_type)}` : ""),
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
      .on("mouseleave", function () {
        d3.select(this).attr("r", 4).attr("stroke-width", 0.5);
        tooltip.style("opacity", 0);
      });

    // Legend
    const legendEntries = [
      { label: "Home Run", color: EVENT_COLORS.home_run },
      { label: "Triple", color: EVENT_COLORS.triple },
      { label: "Double", color: EVENT_COLORS.double },
      { label: "Single", color: EVENT_COLORS.single },
      { label: "Out", color: EVENT_COLORS.field_out },
    ];

    const legend = g
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${w - 80}, 0)`);

    legendEntries.forEach((entry, i) => {
      const row = legend
        .append("g")
        .attr("transform", `translate(0, ${i * 18})`);
      row
        .append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 5)
        .attr("fill", entry.color);
      row
        .append("text")
        .attr("x", 12)
        .attr("y", 4)
        .attr("font-size", "11px")
        .attr("fill", "currentColor")
        .text(entry.label);
    });

    return () => {
      tooltip.remove();
    };
  }, [data, width, height]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No spray chart data available
      </div>
    );
  }

  return <svg ref={svgRef} />;
}
