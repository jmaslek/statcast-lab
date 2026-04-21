import { useEffect, useRef } from "react";
import { select } from "d3-selection";
import { scaleLinear, scaleSequential } from "d3-scale";
import { max } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { format } from "d3-format";
import { interpolateYlOrRd } from "d3-scale-chromatic";
import type { ZonePoint } from "@/types/player";
import { useContainerSize } from "@/hooks/use-container-size";
import { getChartTheme } from "@/lib/chart-utils";

interface Props {
  data: ZonePoint[];
  metric?: "whiff" | "called_strike" | "hard_hit" | "usage";
}

const METRIC_DESCRIPTIONS: Record<string, string[]> = {
  whiff: ["swinging_strike", "swinging_strike_blocked", "foul_tip"],
  called_strike: ["called_strike"],
  hard_hit: [],
  usage: [],
};

export default function StrikeZoneHeatmap({
  data,
  metric = "usage",
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: containerRef, width: containerWidth } = useContainerSize(400);
  const width = containerWidth || 400;
  const height = width * 1.2;

  useEffect(() => {
    if (!svgRef.current || !data.length || !width) return;

    const theme = getChartTheme();
    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 30, right: 30, bottom: 50, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xDomain = [-2, 2] as const;
    const yDomain = [0, 5] as const;

    const xScale = scaleLinear().domain(xDomain).range([0, w]);
    const yScale = scaleLinear().domain(yDomain).range([h, 0]);

    // Grid binning
    const numBinsX = 20;
    const numBinsY = 25;
    const binWidth = (xDomain[1] - xDomain[0]) / numBinsX;
    const binHeight = (yDomain[1] - yDomain[0]) / numBinsY;

    const bins: { x: number; y: number; total: number; metric: number }[] = [];

    for (let i = 0; i < numBinsX; i++) {
      for (let j = 0; j < numBinsY; j++) {
        const bx = xDomain[0] + i * binWidth;
        const by = yDomain[0] + j * binHeight;

        const inBin = data.filter(
          (d) =>
            d.plate_x >= bx &&
            d.plate_x < bx + binWidth &&
            d.plate_z >= by &&
            d.plate_z < by + binHeight,
        );

        if (inBin.length === 0) continue;

        let metricValue: number;
        if (metric === "usage") {
          metricValue = inBin.length;
        } else if (metric === "whiff") {
          const matchDescs = METRIC_DESCRIPTIONS.whiff;
          const swings = inBin.filter(
            (d) =>
              d.description.includes("swing") ||
              d.description.includes("foul") ||
              d.description.includes("hit_into_play") ||
              matchDescs.some((m) => d.description.includes(m)),
          );
          const whiffs = inBin.filter((d) =>
            matchDescs.some((m) => d.description.includes(m)),
          );
          metricValue = swings.length > 0 ? whiffs.length / swings.length : 0;
        } else if (metric === "called_strike") {
          const called = inBin.filter((d) =>
            d.description.includes("called_strike"),
          );
          metricValue =
            inBin.length > 0 ? called.length / inBin.length : 0;
        } else {
          metricValue = inBin.length;
        }

        bins.push({
          x: bx,
          y: by,
          total: inBin.length,
          metric: metricValue,
        });
      }
    }

    const maxMetric = max(bins, (b) => b.metric) ?? 1;
    const colorScale = scaleSequential(interpolateYlOrRd)
      .domain([0, maxMetric]);

    // Draw heatmap bins
    g.append("g")
      .attr("class", "heatmap-bins")
      .selectAll("rect")
      .data(bins)
      .join("rect")
      .attr("x", (d) => xScale(d.x))
      .attr("y", (d) => yScale(d.y + binHeight))
      .attr("width", xScale(xDomain[0] + binWidth) - xScale(xDomain[0]))
      .attr("height", yScale(yDomain[0]) - yScale(yDomain[0] + binHeight))
      .attr("fill", (d) => colorScale(d.metric))
      .attr("fill-opacity", 0.75)
      .attr("rx", 1);

    // Strike zone rectangle - using currentColor for theme awareness
    const zoneLeft = xScale(-0.83);
    const zoneRight = xScale(0.83);
    const zoneTop = yScale(3.5);
    const zoneBottom = yScale(1.5);

    g.append("rect")
      .attr("x", zoneLeft)
      .attr("y", zoneTop)
      .attr("width", zoneRight - zoneLeft)
      .attr("height", zoneBottom - zoneTop)
      .attr("fill", "none")
      .attr("stroke", "currentColor")
      .attr("stroke-width", 2.5)
      .attr("stroke-opacity", 0.9);

    // Inner grid lines
    const zoneW = (0.83 - -0.83) / 3;
    const zoneH = (3.5 - 1.5) / 3;

    for (let i = 1; i < 3; i++) {
      g.append("line")
        .attr("x1", xScale(-0.83 + i * zoneW))
        .attr("y1", zoneTop)
        .attr("x2", xScale(-0.83 + i * zoneW))
        .attr("y2", zoneBottom)
        .attr("stroke", "currentColor")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.4);
      g.append("line")
        .attr("x1", zoneLeft)
        .attr("y1", yScale(1.5 + i * zoneH))
        .attr("x2", zoneRight)
        .attr("y2", yScale(1.5 + i * zoneH))
        .attr("stroke", "currentColor")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.4);
    }

    // Home plate shape
    const plateCenter = xScale(0);
    const plateY = yScale(0.2);
    const plateHalfW = (xScale(0.83) - xScale(-0.83)) / 2;
    const plateH = yScale(0) - yScale(0.35);

    const platePath = [
      [plateCenter - plateHalfW, plateY],
      [plateCenter + plateHalfW, plateY],
      [plateCenter + plateHalfW, plateY + plateH * 0.5],
      [plateCenter, plateY + plateH],
      [plateCenter - plateHalfW, plateY + plateH * 0.5],
    ]
      .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`)
      .join(" ");

    g.append("path")
      .attr("d", platePath + " Z")
      .attr("fill", theme.border)
      .attr("stroke", theme.mutedForeground)
      .attr("stroke-width", 1.5);

    // Axes
    const xAxis = axisBottom(xScale).ticks(5).tickFormat(format(".1f"));
    const yAxis = axisLeft(yScale).ticks(6).tickFormat(format(".1f"));

    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(xAxis)
      .selectAll("text")
      .attr("fill", "currentColor");

    g.append("g")
      .call(yAxis)
      .selectAll("text")
      .attr("fill", "currentColor");

    // Axis labels
    g.append("text")
      .attr("x", w / 2).attr("y", h + 40)
      .attr("text-anchor", "middle").attr("font-size", "12px")
      .attr("fill", "currentColor").text("Horizontal Position (ft)");

    g.append("text")
      .attr("x", -h / 2).attr("y", -38)
      .attr("text-anchor", "middle").attr("font-size", "12px")
      .attr("fill", "currentColor").attr("transform", "rotate(-90)")
      .text("Height (ft)");

    // Title
    const metricNames: Record<string, string> = {
      usage: "Pitch Location Density",
      whiff: "Whiff Rate by Zone",
      called_strike: "Called Strike Rate by Zone",
      hard_hit: "Hard Hit Density by Zone",
    };

    g.append("text")
      .attr("x", w / 2).attr("y", -10)
      .attr("text-anchor", "middle").attr("font-size", "13px")
      .attr("font-weight", "600").attr("fill", "currentColor")
      .text(metricNames[metric] ?? "Strike Zone");
  }, [data, metric, width, height]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No strike zone data available
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full max-w-[400px]">
      <svg
        ref={svgRef}
        role="img"
        aria-label={`Strike zone heatmap showing ${metric} for ${data.length} pitches`}
      />
    </div>
  );
}
