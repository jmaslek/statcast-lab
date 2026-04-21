/** Shared constants */

export const SEASONS = Array.from({ length: 12 }, (_, i) => 2026 - i); // 2026..2015 (newest first)
export const DEFAULT_SEASON = 2026;

export const TEAMS = [
  "ATH", "ATL", "AZ", "BAL", "BOS", "CHC", "CIN", "CLE", "COL", "CWS",
  "DET", "HOU", "KC", "LAA", "LAD", "MIA", "MIL", "MIN", "NYM", "NYY",
  "PHI", "PIT", "SD", "SEA", "SF", "STL", "TB", "TEX", "TOR", "WSH",
];

/** Centralized staleTime values for react-query hooks (ms) */
export const STALE_TIME = {
  /** Live game / frequently updating data (5 min) */
  LIVE: 5 * 60 * 1000,
  /** Search results, user-initiated queries (10 min) */
  SEARCH: 10 * 60 * 1000,
  /** Career stats, percentiles, player profiles (30 min) */
  CAREER: 30 * 60 * 1000,
  /** Reference data: RE matrix, linear weights, park factors (1 hour) */
  REFERENCE: 60 * 60 * 1000,
} as const;
