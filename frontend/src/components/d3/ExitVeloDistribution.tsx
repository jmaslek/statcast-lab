import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface VeloData {
  launch_speed: number;
}

interface ComparisonGroup {
  label: string;
  data: VeloData[];
}

interface Props {
  data: VeloData[];
  comparisons?: ComparisonGroup[];
  width?: number;
  height?: number;
}

const COLORS = [
  "#3b82f6", // blue (primary)
  "#f97316", // orange
  "#22c55e", // green
  "#a855f7", // purple
  "#eab308", // yellow
];

export default function ExitVeloDistribution({
  data,
  comparisons,
  width = 600,
  height = 380,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 30, right: 20, bottom: 50, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Histogram config
    const binMin = 40;
    const binMax = 120;
    const binStep = 2;
    const thresholds: number[] = [];
    for (let v = binMin; v <= binMax; v += binStep) {
      thresholds.push(v);
    }

    const xScale = d3.scaleLinear().domain([binMin, binMax]).range([0, w]);

    // Create histogram generator
    const histogram = d3
      .bin<VeloData, number>()
      .value((d) => d.launch_speed)
      .domain([binMin, binMax])
      .thresholds(thresholds);

    // Compute bins for primary data
    const primaryBins = histogram(data);

    // Compute bins for comparisons
    const compBins = (comparisons ?? []).map((comp) => ({
      label: comp.label,
      bins: histogram(comp.data),
    }));

    // Determine max count for y-axis
    const allBins = [primaryBins, ...compBins.map((c) => c.bins)];
    const maxCount = d3.max(allBins.flat(), (bin) => bin.length) ?? 1;

    const yScale = d3
      .scaleLinear()
      .domain([0, maxCount * 1.1])
      .range([h, 0]);

    // Grid lines
    const yTicks = yScale.ticks(6);
    yTicks.forEach((tick) => {
      g.append("line")
        .attr("x1", 0)
        .attr("y1", yScale(tick))
        .attr("x2", w)
        .attr("y2", yScale(tick))
        .attr("stroke", "currentColor")
        .attr("stroke-opacity", 0.08)
        .attr("stroke-width", 1);
    });

    // Draw comparison histograms first (behind primary)
    compBins.forEach((comp, idx) => {
      const color = COLORS[(idx + 1) % COLORS.length];
      g.append("g")
        .selectAll("rect")
        .data(comp.bins)
        .join("rect")
        .attr("x", (d) => xScale(d.x0 ?? binMin) + 1)
        .attr("y", (d) => yScale(d.length))
        .attr("width", (d) =>
          Math.max(0, xScale(d.x1 ?? binMax) - xScale(d.x0 ?? binMin) - 2),
        )
        .attr("height", (d) => h - yScale(d.length))
        .attr("fill", color)
        .attr("fill-opacity", 0.3)
        .attr("stroke", color)
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", 0.5);
    });

    // Draw primary histogram
    g.append("g")
      .selectAll("rect")
      .data(primaryBins)
      .join("rect")
      .attr("x", (d) => xScale(d.x0 ?? binMin) + 1)
      .attr("y", (d) => yScale(d.length))
      .attr("width", (d) =>
        Math.max(0, xScale(d.x1 ?? binMax) - xScale(d.x0 ?? binMin) - 2),
      )
      .attr("height", (d) => h - yScale(d.length))
      .attr("fill", COLORS[0])
      .attr("fill-opacity", 0.45)
      .attr("stroke", COLORS[0])
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", 0.5);

    // Hard-hit reference line at 95 mph
    const hardHitX = xScale(95);
    g.append("line")
      .attr("x1", hardHitX)
      .attr("y1", 0)
      .attr("x2", hardHitX)
      .attr("y2", h)
      .attr("stroke", "#ef4444")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "6,4")
      .attr("stroke-opacity", 0.8);

    g.append("text")
      .attr("x", hardHitX + 4)
      .attr("y", 12)
      .attr("font-size", "10px")
      .attr("fill", "#ef4444")
      .attr("fill-opacity", 0.9)
      .text("95 mph (Hard Hit)");

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(10);
    const yAxis = d3.axisLeft(yScale).ticks(6);

    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(xAxis)
      .selectAll("text")
      .attr("fill", "currentColor");

    g.append("g").call(yAxis).selectAll("text").attr("fill", "currentColor");

    // Axis labels
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h + 40)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "currentColor")
      .text("Exit Velocity (mph)");

    g.append("text")
      .attr("x", -h / 2)
      .attr("y", -38)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "currentColor")
      .attr("transform", "rotate(-90)")
      .text("Count");

    // Legend (if comparisons exist)
    if (comparisons && comparisons.length > 0) {
      const legendData = [
        { label: "Player", color: COLORS[0] },
        ...comparisons.map((c, i) => ({
          label: c.label,
          color: COLORS[(i + 1) % COLORS.length],
        })),
      ];

      const legend = g
        .append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${w - 100}, 0)`);

      legendData.forEach((entry, i) => {
        const row = legend
          .append("g")
          .attr("transform", `translate(0, ${i * 18})`);
        row
          .append("rect")
          .attr("x", 0)
          .attr("y", -6)
          .attr("width", 12)
          .attr("height", 12)
          .attr("fill", entry.color)
          .attr("fill-opacity", 0.6);
        row
          .append("text")
          .attr("x", 18)
          .attr("y", 4)
          .attr("font-size", "11px")
          .attr("fill", "currentColor")
          .text(entry.label);
      });
    }
  }, [data, comparisons, width, height]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[350px] text-muted-foreground">
        No exit velocity data available
      </div>
    );
  }

  return <svg ref={svgRef} />;
}
