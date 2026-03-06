import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { X, ChevronsUpDown } from "lucide-react";

interface PlayerSearchResult {
  results: {
    player_id: number;
    name_full: string;
    position: string;
    team: string;
  }[];
  total: number;
}

interface SelectedPlayer {
  player_id: number;
  name: string;
  position: string;
  team: string;
}

interface PlayerPickerProps {
  selected: SelectedPlayer[];
  onChange: (players: SelectedPlayer[]) => void;
  maxPlayers?: number;
}

export type { SelectedPlayer };

export default function PlayerPicker({
  selected,
  onChange,
  maxPlayers = 3,
}: PlayerPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const searchQuery = useQuery({
    queryKey: ["player-search", debouncedSearch],
    queryFn: () =>
      fetchApi<PlayerSearchResult>("/players/search", {
        q: debouncedSearch,
        limit: "10",
      }),
    enabled: debouncedSearch.length >= 2,
  });

  const handleSelect = useCallback(
    (player: PlayerSearchResult["results"][number]) => {
      if (selected.some((p) => p.player_id === player.player_id)) return;
      if (selected.length >= maxPlayers) return;

      onChange([
        ...selected,
        {
          player_id: player.player_id,
          name: player.name_full,
          position: player.position,
          team: player.team,
        },
      ]);
      setSearch("");
      setOpen(false);
    },
    [selected, onChange, maxPlayers],
  );

  const handleRemove = useCallback(
    (playerId: number) => {
      onChange(selected.filter((p) => p.player_id !== playerId));
    },
    [selected, onChange],
  );

  const results = searchQuery.data?.results ?? [];
  const filteredResults = results.filter(
    (r) => !selected.some((s) => s.player_id === r.player_id),
  );

  return (
    <div className="space-y-3">
      {/* Selected players as badges */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((player) => (
            <Badge
              key={player.player_id}
              variant="secondary"
              className="gap-1 pr-1 text-sm"
            >
              {player.name}
              <span className="text-muted-foreground ml-1">
                {player.position} - {player.team}
              </span>
              <button
                type="button"
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                onClick={() => handleRemove(player.player_id)}
              >
                <X className="size-3" />
                <span className="sr-only">Remove {player.name}</span>
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Combobox for searching players */}
      {selected.length < maxPlayers && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              Search for a player...
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Type a player name..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                {debouncedSearch.length < 2 ? (
                  <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
                ) : searchQuery.isLoading ? (
                  <CommandEmpty>Searching...</CommandEmpty>
                ) : filteredResults.length === 0 ? (
                  <CommandEmpty>No players found.</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {filteredResults.map((player) => (
                      <CommandItem
                        key={player.player_id}
                        value={String(player.player_id)}
                        onSelect={() => handleSelect(player)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">
                            {player.name_full}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {player.position} - {player.team}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {selected.length >= maxPlayers && (
        <p className="text-xs text-muted-foreground">
          Maximum of {maxPlayers} players selected. Remove one to add another.
        </p>
      )}
    </div>
  );
}
