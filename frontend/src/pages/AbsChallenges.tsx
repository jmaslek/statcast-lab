import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import AbsChallengeDetail from "@/components/AbsChallengeDetail";
import { fmtPct } from "@/lib/format";
import { SEASONS, DEFAULT_SEASON } from "@/lib/constants";
import { useAbsLeaderboard } from "@/hooks/use-leaderboard";
import type { AbsChallengeRow } from "@/types/stats";

function makeAbsColumns(onClickName: (name: string) => void): ColumnDef<AbsChallengeRow, unknown>[] {
  return [
    { accessorKey: "name", header: "Name", cell: (info) => {
      const name = info.getValue() as string;
      return <button className="text-primary underline-offset-4 hover:underline font-medium" onClick={() => onClickName(name)}>{name}</button>;
    }},
    { accessorKey: "team", header: "Team" },
    { accessorKey: "challenges", header: "Chal" },
    { accessorKey: "overturns", header: "OT" },
    { accessorKey: "confirms", header: "Conf" },
    { accessorKey: "overturn_pct", header: "OT%", cell: (info) => fmtPct(info.getValue() as number) },
    { accessorKey: "k_flips", header: "K Flip" },
    { accessorKey: "bb_flips", header: "BB Flip" },
  ];
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export default function AbsChallenges() {
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [challengeType, setChallengeType] = useState("batter");
  const [sort, setSort] = useState("challenges");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const seasonId = "abs-season";

  function handleSort(newField: string, newDesc: boolean) {
    if (newField === sort) {
      setSortDesc(newDesc);
    } else {
      setSort(newField);
      setSortDesc(true);
    }
  }

  const absData = useAbsLeaderboard({
    season,
    challengeType,
    sort,
    desc: sortDesc,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>ABS Challenges</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Type</label>
            <Select value={challengeType} onValueChange={setChallengeType}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="batter">Batters</SelectItem>
                <SelectItem value="pitcher">Pitchers</SelectItem>
                <SelectItem value="catcher">Catchers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={seasonId} className="text-sm font-medium">Season</label>
            <Select value={String(season)} onValueChange={(v) => setSeason(Number(v))}>
              <SelectTrigger id={seasonId} className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEASONS.map((s) => (<SelectItem key={s} value={String(s)}>{s}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {selectedPlayer && (
        <AbsChallengeDetail
          entityName={selectedPlayer}
          season={season}
          challengeType={challengeType}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {absData.isLoading ? (
        <TableSkeleton />
      ) : absData.isError ? (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
          Failed to load ABS data.{" "}
          {absData.error instanceof Error ? absData.error.message : ""}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {absData.data?.total ?? 0} entries found -- click a name to see individual challenges
          </p>
          <LeaderboardTable
            columns={makeAbsColumns(setSelectedPlayer)}
            data={absData.data?.rows ?? []}
            sortField={sort}
            sortDesc={sortDesc}
            onSortChange={handleSort}
          />
        </>
      )}
    </div>
  );
}
