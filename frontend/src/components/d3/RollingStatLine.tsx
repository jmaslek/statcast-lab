import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface DataPoint {
  date: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  statName: string;
  leagueAvg?: number;
  width?: number;
  height?: number;
}

export default function RollingStatLine({
  data,
  statName,
  leagueAvg,
  width = 600,
  height = 350,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 35, right: 20, bottom: 40, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Parse dates
    const parsedData = data.map((d) => ({
      date: new Date(d.date),
      value: d.value,
    }));

    const xExtent = d3.extent(parsedData, (d) => d.date) as [Date, Date];
    const yExtent = d3.extent(parsedData, (d) => d.value) as [
      number,
      number,
    ];

    // Pad y axis
    const yPad = (yExtent[1] - yExtent[0]) * 0.1 || 0.05;
    const yMin = Math.min(yExtent[0] - yPad, leagueAvg ?? Infinity);
    const yMax = Math.max(yExtent[1] + yPad, leagueAvg ?? -Infinity);

    const xScale = d3.scaleTime().domain(xExtent).range([0, w]);
    const yScale = d3
      .scaleLinear()
      .domain([yMin - yPad * 0.5, yMax + yPad * 0.5])
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

    // Line generator
    const line = d3
      .line<{ date: Date; value: number }>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Draw line
    g.append("path")
      .datum(parsedData)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2.5)
      .attr("d", line);

    // League average reference line
    if (leagueAvg != null) {
      g.append("line")
        .attr("x1", 0)
        .attr("y1", yScale(leagueAvg))
        .attr("x2", w)
        .attr("y2", yScale(leagueAvg))
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "8,4")
        .attr("stroke-opacity", 0.7);

      g.append("text")
        .attr("x", w - 4)
        .attr("y", yScale(leagueAvg) - 6)
        .attr("text-anchor", "end")
        .attr("font-size", "10px")
        .attr("fill", "#ef4444")
        .attr("fill-opacity", 0.8)
        .text(`Lg Avg: ${leagueAvg.toFixed(3)}`);
    }

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(d3.timeMonth.every(1))
      .tickFormat((d) => d3.timeFormat("%b")(d as Date));
    const yAxis = d3.axisLeft(yScale).ticks(6);

    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(xAxis)
      .selectAll("text")
      .attr("fill", "currentColor");

    g.append("g").call(yAxis).selectAll("text").attr("fill", "currentColor");

    // Title
    g.append("text")
      .attr("x", w / 2)
      .attr("y", -15)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "600")
      .attr("fill", "currentColor")
      .text(statName);

    // Axis labels
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h + 35)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "currentColor")
      .text("Date");

    g.append("text")
      .attr("x", -h / 2)
      .attr("y", -38)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "currentColor")
      .attr("transform", "rotate(-90)")
      .text(statName);
  }, [data, statName, leagueAvg, width, height]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No data available
      </div>
    );
  }

  return <svg ref={svgRef} />;
}
