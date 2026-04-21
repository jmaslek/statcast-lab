import { useEffect, useRef } from "react";
import { select } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { mean } from "d3-array";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAbsEvents } from "@/hooks/use-leaderboard";
import type { AbsChallengeEvent } from "@/types/stats";
import { useContainerSize } from "@/hooks/use-container-size";
import { createTooltip, showTooltip, moveTooltip, hideTooltip } from "@/lib/chart-utils";

interface Props {
  entityName: string;
  season: number;
  challengeType: string;
  onClose: () => void;
}

const roleMap: Record<string, string> = {
  batter: "batter",
  pitcher: "pitcher",
  catcher: "catcher",
  "batting-team": "batter",
};

export default function AbsChallengeDetail({
  entityName,
  season,
  challengeType,
  onClose,
}: Props) {
  const role = roleMap[challengeType] ?? "batter";
  const { data, isLoading, isError } = useAbsEvents({
    name: entityName,
    season,
    role,
  });

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (isError) return <div className="text-destructive">Failed to load challenge events.</div>;
  if (!data?.events.length) return <div className="text-muted-foreground">No individual challenge events found.</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {entityName} - {data.total} Challenge{data.total !== 1 ? "s" : ""}
          </CardTitle>
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
        {data.events.length < data.total && (
          <p className="text-xs text-muted-foreground mt-1">
            Showing {data.events.length} of {data.total} — Baseball Savant only provides recent individual challenge events. Season totals in the leaderboard are complete.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex justify-center">
            <ChallengeZonePlot events={data.events} />
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">Date</th>
                  <th className="text-left py-2 px-2 font-medium">Inn</th>
                  <th className="text-left py-2 px-2 font-medium">Count</th>
                  <th className="text-left py-2 px-2 font-medium">vs</th>
                  <th className="text-left py-2 px-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((ev) => (
                  <tr key={ev.play_id} className="border-b last:border-0">
                    <td className="py-1.5 px-2 tabular-nums">{ev.game_date}</td>
                    <td className="py-1.5 px-2">{ev.inning}</td>
                    <td className="py-1.5 px-2 tabular-nums">{ev.count}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">
                      {role === "batter" ? ev.pitcher_name : ev.batter_name}
                    </td>
                    <td className="py-1.5 px-2">
                      <span
                        className={
                          ev.is_overturned
                            ? "text-green-600 dark:text-green-400 font-medium"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {ev.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChallengeZonePlot({ events }: { events: AbsChallengeEvent[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { ref: containerRef, width: containerWidth } = useContainerSize(320);
  const width = containerWidth || 320;
  const height = width * 1.25;

  useEffect(() => {
    if (!svgRef.current || !events.length || !width) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 30, right: 20, bottom: 30, left: 20 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Use average strike zone dimensions
    const avgTop = mean(events, (e) => e.sz_top) ?? 3.5;
    const avgBot = mean(events, (e) => e.sz_bot) ?? 1.5;
    const halfPlate = 17 / 2 / 12; // plate width in feet

    // Scale: plate_x is in feet from center, plate_z is in feet
    const xPad = 0.8;
    const yPad = 0.5;
    const xScale = scaleLinear().domain([-halfPlate - xPad, halfPlate + xPad]).range([0, w]);
    const yScale = scaleLinear().domain([avgBot - yPad, avgTop + yPad]).range([h, 0]);

    // Strike zone box
    g.append("rect")
      .attr("x", xScale(-halfPlate))
      .attr("y", yScale(avgTop))
      .attr("width", xScale(halfPlate) - xScale(-halfPlate))
      .attr("height", yScale(avgBot) - yScale(avgTop))
      .attr("fill", "none")
      .attr("stroke", "currentColor")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.5);

    // Grid lines inside zone
    const thirds = [1 / 3, 2 / 3];
    thirds.forEach((t) => {
      const xPos = xScale(-halfPlate + t * halfPlate * 2);
      const yPos = yScale(avgBot + t * (avgTop - avgBot));
      g.append("line")
        .attr("x1", xPos).attr("y1", yScale(avgTop))
        .attr("x2", xPos).attr("y2", yScale(avgBot))
        .attr("stroke", "currentColor").attr("stroke-opacity", 0.15);
      g.append("line")
        .attr("x1", xScale(-halfPlate)).attr("y1", yPos)
        .attr("x2", xScale(halfPlate)).attr("y2", yPos)
        .attr("stroke", "currentColor").attr("stroke-opacity", 0.15);
    });

    // Home plate
    const plateW = xScale(halfPlate) - xScale(-halfPlate);
    const plateY = yScale(avgBot) + 10;
    const plateCx = xScale(0);
    g.append("polygon")
      .attr("points", [
        [plateCx - plateW / 2, plateY],
        [plateCx + plateW / 2, plateY],
        [plateCx + plateW / 2, plateY + 8],
        [plateCx, plateY + 16],
        [plateCx - plateW / 2, plateY + 8],
      ].map((p) => p.join(",")).join(" "))
      .attr("fill", "currentColor")
      .attr("fill-opacity", 0.1)
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.3);

    const tooltip = createTooltip();

    // Plot challenge pitches
    g.selectAll("circle")
      .data(events)
      .join("circle")
      .attr("cx", (d) => xScale(d.plate_x))
      .attr("cy", (d) => yScale(d.plate_z))
      .attr("r", 10)
      .attr("fill", (d) => d.is_overturned ? "#22c55e" : "#ef4444")
      .attr("fill-opacity", 0.7)
      .attr("stroke", (d) => d.is_overturned ? "#16a34a" : "#dc2626")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        select(this).attr("r", 14).attr("fill-opacity", 1);
        showTooltip(
          tooltip,
          `<strong>${d.game_date}</strong> - Inn ${d.inning}<br/>` +
            `${d.batter_name} vs ${d.pitcher_name}<br/>` +
            `Count: ${d.count} | Ump: ${d.original_call}<br/>` +
            `<strong>${d.result}</strong><br/>` +
            `Edge dist: ${d.edge_dist.toFixed(2)}"`,
          event,
        );
      })
      .on("mousemove", function (event) { moveTooltip(tooltip, event); })
      .on("mouseleave", function () {
        select(this).attr("r", 10).attr("fill-opacity", 0.7);
        hideTooltip(tooltip);
      });

    // Title
    g.append("text")
      .attr("x", w / 2).attr("y", -10).attr("text-anchor", "middle")
      .attr("font-size", "12px").attr("font-weight", "600")
      .attr("fill", "currentColor")
      .text("Challenge Locations (catcher view)");

    // Legend
    const legend = g.append("g").attr("transform", `translate(${w / 2 - 60}, ${h + 15})`);
    legend.append("circle").attr("cx", 0).attr("cy", 0).attr("r", 5).attr("fill", "#22c55e");
    legend.append("text").attr("x", 8).attr("y", 4).attr("font-size", "10px").attr("fill", "currentColor").text("Overturned");
    legend.append("circle").attr("cx", 80).attr("cy", 0).attr("r", 5).attr("fill", "#ef4444");
    legend.append("text").attr("x", 88).attr("y", 4).attr("font-size", "10px").attr("fill", "currentColor").text("Confirmed");

    return () => { tooltip.remove(); };
  }, [events, width, height]);

  return (
    <div ref={containerRef} className="w-full max-w-[320px]">
      <svg ref={svgRef} role="img" aria-label="ABS challenge locations on strike zone" />
    </div>
  );
}
