import { useEffect, useRef, memo } from "react";
import { select } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { extent } from "d3-array";
import { symbol, symbolDiamond, symbolTriangle, symbolSquare, symbolCircle } from "d3-shape";
import type { SprayChartPoint } from "@/types/player";
import { useContainerSize } from "@/hooks/use-container-size";
import { EVENT_COLORS, eventColor, createTooltip, showTooltip, moveTooltip, hideTooltip } from "@/lib/chart-utils";

interface Props {
  data: SprayChartPoint[];
}

// Shapes to differentiate events for colorblind users
const EVENT_SHAPES: Record<string, string> = {
  home_run: "diamond",
  triple: "triangle",
  double: "square",
  single: "circle",
};

function eventLabel(event: string): string {
  return event
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Draw a d3 symbol at (x, y). Returns a <path> selection. */
function drawShape(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  g: any,
  x: number,
  y: number,
  shape: string,
  size: number,
  fill: string,
  opacity: number,
) {
  const symbolType =
    shape === "diamond" ? symbolDiamond :
    shape === "triangle" ? symbolTriangle :
    shape === "square" ? symbolSquare :
    symbolCircle;

  const area = Math.PI * size * size * (shape === "circle" ? 1 : 1.6);
  const pathData = symbol().type(symbolType).size(area)();

  return g.append("path")
    .attr("d", pathData)
    .attr("transform", `translate(${x},${y})`)
    .attr("fill", fill)
    .attr("fill-opacity", opacity)
    .attr("stroke", fill)
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", 0.5);
}

export default memo(function SprayChart({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: containerRef, width: containerWidth } = useContainerSize(500);
  const width = containerWidth || 500;
  const height = width;

  useEffect(() => {
    if (!svgRef.current || !data.length || !width) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = scaleLinear().domain([0, 250]).range([0, w]);
    const yScale = scaleLinear().domain([0, 250]).range([0, h]);

    const homeX = xScale(125);
    const homeY = yScale(200);

    // Draw field background
    const fieldGroup = g.append("g").attr("class", "field");

    const lfEnd = { x: xScale(-90), y: yScale(25) };
    const rfEnd = { x: xScale(340), y: yScale(25) };
    const arcRadius = Math.hypot(rfEnd.x - homeX, rfEnd.y - homeY);

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
      .attr("x1", homeX).attr("y1", homeY)
      .attr("x2", lfEnd.x).attr("y2", lfEnd.y)
      .attr("stroke", "currentColor").attr("stroke-opacity", 0.2)
      .attr("stroke-width", 1).attr("stroke-dasharray", "4,3");

    fieldGroup
      .append("line")
      .attr("x1", homeX).attr("y1", homeY)
      .attr("x2", rfEnd.x).attr("y2", rfEnd.y)
      .attr("stroke", "currentColor").attr("stroke-opacity", 0.2)
      .attr("stroke-width", 1).attr("stroke-dasharray", "4,3");

    // Infield diamond
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
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", 1.5);

    // Base markers
    Object.values(bases).forEach((base) => {
      fieldGroup
        .append("rect")
        .attr("x", xScale(base.x) - 4)
        .attr("y", yScale(base.y) - 4)
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", "var(--background, #fafafa)")
        .attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1)
        .attr("transform", `rotate(45,${xScale(base.x)},${yScale(base.y)})`);
    });

    // Compute launch speed range for opacity
    const speeds = data.map((d) => d.launch_speed).filter((v): v is number => v != null);
    const speedExtent = extent(speeds) as [number, number];
    const opacityScale = scaleLinear()
      .domain(speedExtent[0] != null ? speedExtent : [60, 115])
      .range([0.3, 1])
      .clamp(true);

    // Tooltip
    const tooltip = createTooltip();

    // Batted ball scatter plot with shapes
    const dots = g.append("g").attr("class", "dots");

    data.forEach((d) => {
      const shape = EVENT_SHAPES[d.events] ?? "circle";
      const color = eventColor(d.events);
      const opacity = d.launch_speed != null ? opacityScale(d.launch_speed) : 0.5;
      const cx = xScale(d.hc_x);
      const cy = yScale(d.hc_y);

      const el = drawShape(dots, cx, cy, shape, 4, color, opacity);

      el.style("cursor", "pointer");

      el.on("mouseenter", (_event: MouseEvent) => {
          el.attr("stroke-width", 2);
          showTooltip(
            tooltip,
            `<strong>${eventLabel(d.events)}</strong><br/>` +
              `Exit Velo: ${d.launch_speed != null ? `${d.launch_speed.toFixed(1)} mph` : "N/A"}<br/>` +
              `Launch Angle: ${d.launch_angle != null ? `${d.launch_angle.toFixed(1)}deg` : "N/A"}` +
              (d.bb_type ? `<br/>Type: ${eventLabel(d.bb_type)}` : ""),
            _event,
          );
        })
        .on("mousemove", (_event: MouseEvent) => {
          moveTooltip(tooltip, _event);
        })
        .on("mouseleave", () => {
          el.attr("stroke-width", 0.5);
          hideTooltip(tooltip);
        });
    });

    // Legend
    const legendEntries = [
      { label: "Home Run", color: EVENT_COLORS.home_run, shape: "diamond" },
      { label: "Triple", color: EVENT_COLORS.triple, shape: "triangle" },
      { label: "Double", color: EVENT_COLORS.double, shape: "square" },
      { label: "Single", color: EVENT_COLORS.single, shape: "circle" },
      { label: "Out", color: EVENT_COLORS.field_out, shape: "circle" },
    ];

    const legend = g
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${w - 80}, 0)`);

    legendEntries.forEach((entry, i) => {
      const row = legend
        .append("g")
        .attr("transform", `translate(0, ${i * 18})`);
      drawShape(row, 0, 0, entry.shape, 5, entry.color, 1);
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

  return (
    <div ref={containerRef} className="w-full max-w-[500px]">
      <svg
        ref={svgRef}
        role="img"
        aria-label={`Spray chart showing ${data.length} batted balls plotted on a baseball field`}
      />
    </div>
  );
});
