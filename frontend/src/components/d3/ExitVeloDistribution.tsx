import { useEffect, useRef } from "react";
import { select } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { bin, max } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { useContainerSize } from "@/hooks/use-container-size";
import { CHART_COLORS } from "@/lib/chart-utils";

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
}

export default function ExitVeloDistribution({
  data,
  comparisons,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: containerRef, width: containerWidth } = useContainerSize(600);
  const width = containerWidth || 600;
  const height = width * 0.63;

  useEffect(() => {
    if (!svgRef.current || !data.length || !width) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 30, right: 20, bottom: 50, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const binMin = 40;
    const binMax = 120;
    const binStep = 2;
    const thresholds: number[] = [];
    for (let v = binMin; v <= binMax; v += binStep) {
      thresholds.push(v);
    }

    const xScale = scaleLinear().domain([binMin, binMax]).range([0, w]);

    const histogram = bin<VeloData, number>()
      .value((d) => d.launch_speed)
      .domain([binMin, binMax])
      .thresholds(thresholds);

    const primaryBins = histogram(data);
    const compBins = (comparisons ?? []).map((comp) => ({
      label: comp.label,
      bins: histogram(comp.data),
    }));

    const allBins = [primaryBins, ...compBins.map((c) => c.bins)];
    const maxCount = max(allBins.flat(), (b) => b.length) ?? 1;

    const yScale = scaleLinear()
      .domain([0, maxCount * 1.1])
      .range([h, 0]);

    // Grid lines
    const yTicks = yScale.ticks(6);
    yTicks.forEach((tick) => {
      g.append("line")
        .attr("x1", 0).attr("y1", yScale(tick))
        .attr("x2", w).attr("y2", yScale(tick))
        .attr("stroke", "currentColor").attr("stroke-opacity", 0.08);
    });

    // Draw comparison histograms first
    compBins.forEach((comp, idx) => {
      const color = CHART_COLORS[(idx + 1) % CHART_COLORS.length];
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
        .attr("fill", color).attr("fill-opacity", 0.3)
        .attr("stroke", color).attr("stroke-opacity", 0.5)
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
      .attr("fill", CHART_COLORS[0]).attr("fill-opacity", 0.45)
      .attr("stroke", CHART_COLORS[0]).attr("stroke-opacity", 0.7)
      .attr("stroke-width", 0.5);

    // Hard-hit reference line at 95 mph
    const hardHitX = xScale(95);
    g.append("line")
      .attr("x1", hardHitX).attr("y1", 0)
      .attr("x2", hardHitX).attr("y2", h)
      .attr("stroke", "#ef4444").attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "6,4").attr("stroke-opacity", 0.8);

    g.append("text")
      .attr("x", hardHitX + 4).attr("y", 12)
      .attr("font-size", "10px").attr("fill", "#ef4444")
      .attr("fill-opacity", 0.9).text("95 mph (Hard Hit)");

    // Axes
    const xAxis = axisBottom(xScale).ticks(10);
    const yAxis = axisLeft(yScale).ticks(6);

    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(xAxis).selectAll("text").attr("fill", "currentColor");

    g.append("g").call(yAxis).selectAll("text").attr("fill", "currentColor");

    g.append("text")
      .attr("x", w / 2).attr("y", h + 40).attr("text-anchor", "middle")
      .attr("font-size", "12px").attr("fill", "currentColor")
      .text("Exit Velocity (mph)");

    g.append("text")
      .attr("x", -h / 2).attr("y", -38).attr("text-anchor", "middle")
      .attr("font-size", "12px").attr("fill", "currentColor")
      .attr("transform", "rotate(-90)").text("Count");

    // Legend
    if (comparisons && comparisons.length > 0) {
      const legendData = [
        { label: "Player", color: CHART_COLORS[0] },
        ...comparisons.map((c, i) => ({
          label: c.label,
          color: CHART_COLORS[(i + 1) % CHART_COLORS.length],
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
        row.append("rect")
          .attr("x", 0).attr("y", -6)
          .attr("width", 12).attr("height", 12)
          .attr("fill", entry.color).attr("fill-opacity", 0.6);
        row.append("text")
          .attr("x", 18).attr("y", 4)
          .attr("font-size", "11px").attr("fill", "currentColor")
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

  return (
    <div ref={containerRef} className="w-full max-w-[600px]">
      <svg
        ref={svgRef}
        role="img"
        aria-label={`Exit velocity distribution histogram for ${data.length} batted balls`}
      />
    </div>
  );
}
