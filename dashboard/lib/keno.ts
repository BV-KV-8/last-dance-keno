export interface Game {
  game_id: number;
  date: string;
  time: string;
  numbers: number[];
}

export interface FilterRule {
  id: string;
  name: string;
  type: 'hit_range' | 'position' | 'row_col' | 'neighbor' | 'custom';
  enabled: boolean;
  params: Record<string, any>;
}

export interface StrategyConfig {
  name: string;
  rules: FilterRule[];
  maxNumbers: number;
}

export interface BacktestResult {
  strategy: string;
  total_games: number;
  playable_numbers: number[];
  hits: number;
  misses: number;
  hit_rate: number;
  avg_playable: number;
  games_analyzed: number;
}

export const ROWS = 8;
export const COLS = 10;

export function getRow(num: number): number {
  return Math.floor((num - 1) / 10) + 1;
}

export function getCol(num: number): number {
  return ((num - 1) % 10) + 1;
}

export function getNeighbors(num: number): Set<number> {
  const row = getRow(num);
  const col = getCol(num);
  const neighbors = new Set<number>();

  for (let r = Math.max(1, row - 1); r <= Math.min(8, row + 1); r++) {
    for (let c = Math.max(1, col - 1); c <= Math.min(10, col + 1); c++) {
      const neighbor = (r - 1) * 10 + c;
      if (neighbor !== num && neighbor >= 1 && neighbor <= 80) {
        neighbors.add(neighbor);
      }
    }
  }

  return neighbors;
}

export function mirrorNum(num: number): number {
  return 81 - num;
}

export function applyFilters(
  games: Game[],
  rules: FilterRule[],
  maxNumbers: number = 20
): number[] {
  if (games.length < 2) return Array.from({ length: 80 }, (_, i) => i + 1);

  let playable = new Set<number>();
  const eliminated = new Set<number>();

  // Start with all numbers playable
  for (let i = 1; i <= 80; i++) {
    playable.add(i);
  }

  const lastGame = games[0];
  const recentGames = games.slice(0, 10); // Last 10 games for most rules

  // Build history for each number
  const history: Record<number, number[]> = {};
  for (let i = 1; i <= 80; i++) {
    history[i] = [];
  }

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    game.numbers.forEach((num) => {
      history[num].push(i);
    });
  }

  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.type) {
      case 'hit_range':
        // Eliminate numbers that hit in the last X games
        if (rule.params.hitInLast) {
          const lookback = rule.params.lastCount || 1;
          recentGames.slice(0, lookback).forEach((game) => {
            game.numbers.forEach((num) => {
              if (rule.params.eliminate !== false) {
                eliminated.add(num);
              }
            });
          });
        }
        // Eliminate numbers that DIDN'T hit in last X games
        if (rule.params.mustHitInLast) {
          const lookback = rule.params.mustHitCount || 5;
          const hittingNumbers = new Set<number>();
          recentGames.slice(0, lookback).forEach((game) => {
            game.numbers.forEach((num) => hittingNumbers.add(num));
          });
          for (let i = 1; i <= 80; i++) {
            if (!hittingNumbers.has(i)) {
              eliminated.add(i);
            }
          }
        }
        // Custom checkboxes for specific game positions
        if (rule.params.customCheckboxes) {
          const checkboxes = rule.params.checkboxes || [];
          checkboxes.forEach((checked: boolean, idx: number) => {
            if (checked && idx < recentGames.length) {
              const game = recentGames[idx];
              game.numbers.forEach((num) => {
                eliminated.add(num);
              });
            }
          });
        }
        break;

      case 'position':
        // Eliminate numbers that hit in specific positions last game
        if (rule.params.positions && rule.params.positions.length > 0) {
          rule.params.positions.forEach((pos: number) => {
            if (pos > 0 && pos <= lastGame.numbers.length) {
              eliminated.add(lastGame.numbers[pos - 1]);
            }
          });
        }
        break;

      case 'row_col':
        // Eliminate numbers in hot rows/cols
        if (rule.params.hotRows || rule.params.hotCols) {
          const rowCount: Record<number, number> = {};
          const colCount: Record<number, number> = {};

          lastGame.numbers.forEach((num) => {
            const r = getRow(num);
            const c = getCol(num);
            rowCount[r] = (rowCount[r] || 0) + 1;
            colCount[c] = (colCount[c] || 0) + 1;
          });

          if (rule.params.hotRows) {
            const threshold = rule.params.rowThreshold || 4;
            Object.entries(rowCount).forEach(([row, count]) => {
              if (count >= threshold) {
                for (let c = 1; c <= 10; c++) {
                  eliminated.add((parseInt(row) - 1) * 10 + c);
                }
              }
            });
          }

          if (rule.params.hotCols) {
            const threshold = rule.params.colThreshold || 4;
            Object.entries(colCount).forEach(([col, count]) => {
              if (count >= threshold) {
                for (let r = 1; r <= 8; r++) {
                  eliminated.add((r - 1) * 10 + parseInt(col));
                }
              }
            });
          }
        }
        break;

      case 'neighbor':
        // Eliminate numbers whose neighbors didn't hit
        if (rule.params.requireNeighborHit) {
          const lastHits = new Set(lastGame.numbers);
          for (let i = 1; i <= 80; i++) {
            const neighbors = getNeighbors(i);
            const hasNeighborHit = [...neighbors].some((n) => lastHits.has(n));
            if (!hasNeighborHit) {
              eliminated.add(i);
            }
          }
        }
        break;

      case 'custom':
        // Hit X times in Y games
        if (rule.params.hitCount !== undefined && rule.params.inGames !== undefined) {
          const hitCount = rule.params.hitCount;
          const inGames = rule.params.inGames;
          const eliminateIfHit = rule.params.eliminateIfHit !== false;

          for (let i = 1; i <= 80; i++) {
            const hits = history[i].filter((gameIdx) => gameIdx < inGames).length;
            if (eliminateIfHit && hits >= hitCount) {
              eliminated.add(i);
            } else if (!eliminateIfHit && hits < hitCount) {
              eliminated.add(i);
            }
          }
        }
        // Pattern elimination (1-3-4 pattern)
        if (rule.params.pattern && rule.params.pattern === '134') {
          const positions = rule.params.patternPositions || [1, 3, 4];
          positions.forEach((pos: number) => {
            if (pos > 0 && pos <= lastGame.numbers.length) {
              eliminated.add(lastGame.numbers[pos - 1]);
            }
          });
        }
        // Eliminate mirrored numbers (81-n)
        if (rule.params.eliminateMirrored) {
          const lastHits = new Set(lastGame.numbers);
          lastHits.forEach((num) => {
            eliminated.add(mirrorNum(num));
          });
        }
        // Eliminate row repeaters
        if (rule.params.eliminateRowRepeaters) {
          const lastRows = lastGame.numbers.map(getRow);
          const rowCounts: Record<number, number> = {};
          lastRows.forEach((r) => { rowCounts[r] = (rowCounts[r] || 0) + 1; });
          // Eliminate numbers in rows that had 2+ hits last game
          Object.entries(rowCounts).forEach(([row, count]) => {
            if (count >= 2) {
              for (let c = 1; c <= 10; c++) {
                eliminated.add((parseInt(row) - 1) * 10 + c);
              }
            }
          });
        }
        // Eliminate column repeaters
        if (rule.params.eliminateColRepeaters) {
          const lastCols = lastGame.numbers.map(getCol);
          const colCounts: Record<number, number> = {};
          lastCols.forEach((c) => { colCounts[c] = (colCounts[c] || 0) + 1; });
          // Eliminate numbers in cols that had 2+ hits last game
          Object.entries(colCounts).forEach(([col, count]) => {
            if (count >= 2) {
              for (let r = 1; r <= 8; r++) {
                eliminated.add((r - 1) * 10 + parseInt(col));
              }
            }
          });
        }
        break;
    }
  }

  // Remove eliminated from playable
  eliminated.forEach((num) => playable.delete(num));

  // Limit to maxNumbers
  const result = Array.from(playable);
  if (result.length > maxNumbers) {
    return result.slice(0, maxNumbers);
  }

  return result;
}

export function backtest(
  games: Game[],
  rules: FilterRule[],
  maxNumbers: number = 20
): BacktestResult {
  const results: number[] = [];
  let totalHits = 0;
  let totalPlayable = 0;

  // Test on historical data (skip first game as it's our prediction target)
  for (let i = 1; i < Math.min(games.length, 101); i++) {
    const predictionGames = games.slice(i);
    const targetGame = games[i - 1];

    const playable = applyFilters(predictionGames, rules, maxNumbers);
    const playableSet = new Set(playable);

    const hits = targetGame.numbers.filter((num) => playableSet.has(num)).length;

    totalHits += hits;
    totalPlayable += playable.length;
    results.push(hits);
  }

  const avgHits = totalHits / results.length;
  const avgPlayable = totalPlayable / results.length;

  return {
    strategy: 'custom',
    total_games: results.length,
    playable_numbers: applyFilters(games, rules, maxNumbers),
    hits: totalHits,
    misses: results.length * 20 - totalHits,
    hit_rate: avgHits,
    avg_playable: avgPlayable,
    games_analyzed: results.length,
  };
}

export function getNumberStats(games: Game[], num: number): {
  hits: number;
  lastHit: number;
  avgGap: number;
  currentGap: number;
} {
  let hits = 0;
  let lastHit = -1;
  let totalGap = 0;
  let gapCount = 0;

  for (let i = 0; i < games.length; i++) {
    if (games[i].numbers.includes(num)) {
      hits++;
      if (lastHit !== -1) {
        totalGap += lastHit - i;
        gapCount++;
      }
      lastHit = i;
    }
  }

  const currentGap = lastHit !== -1 ? lastHit : games.length;
  const avgGap = gapCount > 0 ? totalGap / gapCount : 0;

  return { hits, lastHit, avgGap, currentGap };
}

export function getHeatmapData(games: Game[]): number[][] {
  const heatmap: number[][] = [];
  for (let r = 0; r < 8; r++) {
    heatmap[r] = [];
    for (let c = 0; c < 10; c++) {
      heatmap[r][c] = 0;
    }
  }

  games.slice(0, 20).forEach((game) => {
    game.numbers.forEach((num) => {
      const r = getRow(num) - 1;
      const c = getCol(num) - 1;
      heatmap[r][c]++;
    });
  });

  return heatmap;
}

export function getNumberFrequency(games: Game[]): Record<number, number> {
  const freq: Record<number, number> = {};
  for (let i = 1; i <= 80; i++) {
    freq[i] = 0;
  }

  games.forEach((game) => {
    game.numbers.forEach((num) => {
      freq[num]++;
    });
  });

  return freq;
}
