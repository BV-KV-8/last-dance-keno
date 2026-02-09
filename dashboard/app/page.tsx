'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Game,
  FilterRule,
  BacktestResult,
  applyFilters,
  backtest,
  getRow,
  getCol,
  getNeighbors,
  mirrorNum,
  getHeatmapData,
  getNumberFrequency,
} from '@/lib/keno';
import { RefreshCwIcon, PlayIcon, BarChart3Icon, SettingsIcon, TrendingUpIcon, TargetIcon } from 'lucide-react';

type Theme = 'default' | 'midnight' | 'sunset' | 'forest' | 'ocean' | 'purple' | 'rose' | 'amber';

const THEMES: Record<Theme, { name: string; bg: string; card: string; text: string; accent: string; border: string; muted: string }> = {
  default: { name: 'Default', bg: 'bg-slate-50', card: 'bg-white', text: 'text-slate-900', accent: 'bg-blue-500', border: 'border-slate-200', muted: 'text-slate-600' },
  midnight: { name: 'Midnight', bg: 'bg-slate-950', card: 'bg-slate-900', text: 'text-slate-100', accent: 'bg-indigo-500', border: 'border-slate-700', muted: 'text-slate-400' },
  sunset: { name: 'Sunset', bg: 'bg-orange-950', card: 'bg-orange-900/50', text: 'text-orange-100', accent: 'bg-orange-500', border: 'border-orange-800', muted: 'text-orange-300' },
  forest: { name: 'Forest', bg: 'bg-emerald-950', card: 'bg-emerald-900/50', text: 'text-emerald-100', accent: 'bg-emerald-500', border: 'border-emerald-800', muted: 'text-emerald-300' },
  ocean: { name: 'Ocean', bg: 'bg-cyan-950', card: 'bg-cyan-900/50', text: 'text-cyan-100', accent: 'bg-cyan-500', border: 'border-cyan-800', muted: 'text-cyan-300' },
  purple: { name: 'Purple', bg: 'bg-purple-950', card: 'bg-purple-900/50', text: 'text-purple-100', accent: 'bg-purple-500', border: 'border-purple-800', muted: 'text-purple-300' },
  rose: { name: 'Rose', bg: 'bg-rose-950', card: 'bg-rose-900/50', text: 'text-rose-100', accent: 'bg-rose-500', border: 'border-rose-800', muted: 'text-rose-300' },
  amber: { name: 'Amber', bg: 'bg-amber-950', card: 'bg-amber-900/50', text: 'text-amber-100', accent: 'bg-amber-500', border: 'border-amber-800', muted: 'text-amber-300' },
};

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>('midnight');
  const [maxNumbers, setMaxNumbers] = useState(20);
  const [backtestGames, setBacktestGames] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('custom');

  // Main state - using individual flags for better reactivity
  const [filters, setFilters] = useState({
    // Hit-based eliminations
    eliminateHitLast1: false,
    eliminateHitLast2: false,
    eliminateHitLast3: false,
    eliminateHitLast5: false,
    eliminateHitLast10: false,

    // Custom hit range
    enableCustomHitRange: false,
    customHitRangeCount: 3,
    customHitRangeLookback: 5,

    // Keep only if hit in range
    keepIfHitInLast: false,
    keepIfHitLookback: 10,
    keepIfHitMinCount: 1,

    // Position-based eliminations
    eliminatePos1: false,
    eliminatePos2: false,
    eliminatePos3: false,
    eliminatePos4: false,
    eliminatePos5: false,
    eliminatePosLast: false,

    // Row/Column eliminations
    eliminateHotRows: false,
    hotRowThreshold: 3,
    eliminateHotCols: false,
    hotColThreshold: 3,

    // Neighbor-based
    eliminateNoNeighbor: false,

    // Custom game checkboxes
    enableCustomGames: false,
    customGames: Array(20).fill(false),

    // Pattern eliminations
    eliminateMirrored: false,
    eliminateRowRepeaters: false,
    eliminateColRepeaters: false,

    // Decade/Zone eliminations
    eliminateColdDecades: false,
    eliminateHotDecades: false,
  });

  // Load games
  useEffect(() => {
    let mounted = true;
    fetch('/api/games')
      .then((res) => res.json())
      .then((data: Game[]) => {
        if (mounted) {
          setGames(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load games:', err);
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  // Build rules from filters - memoized for performance
  const rules = useMemo((): FilterRule[] => {
    const rules: FilterRule[] = [];

    // Hit in last X games
    if (filters.eliminateHitLast1) {
      rules.push({ id: 'last1', name: 'Hit Last 1', type: 'hit_range', enabled: true, params: { hitInLast: true, lastCount: 1, eliminate: true } });
    }
    if (filters.eliminateHitLast2) {
      rules.push({ id: 'last2', name: 'Hit Last 2', type: 'hit_range', enabled: true, params: { hitInLast: true, lastCount: 2, eliminate: true } });
    }
    if (filters.eliminateHitLast3) {
      rules.push({ id: 'last3', name: 'Hit Last 3', type: 'hit_range', enabled: true, params: { hitInLast: true, lastCount: 3, eliminate: true } });
    }
    if (filters.eliminateHitLast5) {
      rules.push({ id: 'last5', name: 'Hit Last 5', type: 'hit_range', enabled: true, params: { hitInLast: true, lastCount: 5, eliminate: true } });
    }
    if (filters.eliminateHitLast10) {
      rules.push({ id: 'last10', name: 'Hit Last 10', type: 'hit_range', enabled: true, params: { hitInLast: true, lastCount: 10, eliminate: true } });
    }

    // Custom hit range
    if (filters.enableCustomHitRange) {
      rules.push({
        id: 'customHit',
        name: `Hit ${filters.customHitRangeCount}+ in ${filters.customHitRangeLookback}`,
        type: 'custom',
        enabled: true,
        params: { hitCount: filters.customHitRangeCount, inGames: filters.customHitRangeLookback, eliminateIfHit: true }
      });
    }

    // Keep only if hit in last X
    if (filters.keepIfHitInLast) {
      rules.push({
        id: 'keepHit',
        name: `Keep if hit ${filters.keepIfHitMinCount}+ in ${filters.keepIfHitLookback}`,
        type: 'custom',
        enabled: true,
        params: { hitCount: filters.keepIfHitMinCount, inGames: filters.keepIfHitLookback, eliminateIfHit: false }
      });
    }

    // Position eliminations
    const positions: number[] = [];
    if (filters.eliminatePos1) positions.push(1);
    if (filters.eliminatePos2) positions.push(2);
    if (filters.eliminatePos3) positions.push(3);
    if (filters.eliminatePos4) positions.push(4);
    if (filters.eliminatePos5) positions.push(5);
    if (filters.eliminatePosLast) positions.push(20);
    if (positions.length > 0) {
      rules.push({ id: 'positions', name: 'Positions', type: 'position', enabled: true, params: { positions } });
    }

    // Row/Column hot
    if (filters.eliminateHotRows || filters.eliminateHotCols) {
      rules.push({
        id: 'hotRowCol',
        name: 'Hot Row/Col',
        type: 'row_col',
        enabled: true,
        params: {
          hotRows: filters.eliminateHotRows,
          hotCols: filters.eliminateHotCols,
          rowThreshold: filters.hotRowThreshold,
          colThreshold: filters.hotColThreshold
        }
      });
    }

    // Neighbor
    if (filters.eliminateNoNeighbor) {
      rules.push({ id: 'neighbor', name: 'No Neighbor', type: 'neighbor', enabled: true, params: { requireNeighborHit: true } });
    }

    // Custom games checkboxes
    if (filters.enableCustomGames && filters.customGames.some((c) => c)) {
      rules.push({
        id: 'customGames',
        name: 'Custom Games',
        type: 'hit_range',
        enabled: true,
        params: { customCheckboxes: true, checkboxes: filters.customGames }
      });
    }

    // Mirrored
    if (filters.eliminateMirrored) {
      rules.push({ id: 'mirrored', name: 'Mirrored', type: 'custom', enabled: true, params: { eliminateMirrored: true } });
    }

    // Row repeaters
    if (filters.eliminateRowRepeaters) {
      rules.push({ id: 'rowRepeaters', name: 'Row Repeaters', type: 'custom', enabled: true, params: { eliminateRowRepeaters: true } });
    }

    // Col repeaters
    if (filters.eliminateColRepeaters) {
      rules.push({ id: 'colRepeaters', name: 'Col Repeaters', type: 'custom', enabled: true, params: { eliminateColRepeaters: true } });
    }

    return rules;
  }, [filters]);

  // Calculate playable numbers - memoized
  const playableNumbers = useMemo(() => {
    if (games.length === 0) return [];
    return applyFilters(games, rules, maxNumbers);
  }, [games, rules, maxNumbers]);

  // Backtest results - memoized
  const backtestResult = useMemo((): BacktestResult | null => {
    if (games.length === 0) return null;

    const results: number[] = [];
    let totalHits = 0;
    let totalPlayable = 0;
    const gamesToTest = Math.min(backtestGames, games.length - 1);

    for (let i = 1; i <= gamesToTest; i++) {
      const predictionGames = games.slice(i);
      const targetGame = games[i - 1];

      const playable = applyFilters(predictionGames, rules, maxNumbers);
      const playableSet = new Set(playable);

      const hits = targetGame.numbers.filter((num) => playableSet.has(num)).length;

      totalHits += hits;
      totalPlayable += playable.length;
      results.push(hits);
    }

    return {
      strategy: 'custom',
      total_games: results.length,
      playable_numbers: playableNumbers,
      hits: totalHits,
      misses: results.length * 20 - totalHits,
      hit_rate: totalHits / results.length,
      avg_playable: totalPlayable / results.length,
      games_analyzed: results.length,
    };
  }, [games, rules, maxNumbers, backtestGames, playableNumbers]);

  // Update filter helper
  const updateFilter = <K extends keyof typeof filters>(key: K, value: typeof filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const currentTheme = THEMES[theme];
  const heatmapData = useMemo(() => games.length > 0 ? getHeatmapData(games) : [], [games]);
  const numberFreq = useMemo(() => games.length > 0 ? getNumberFrequency(games) : {}, [games]);

  // Keno Board Component
  const KenoBoard = ({ numbers, highlight, showStats }: { numbers?: number[]; highlight?: number[]; showStats?: boolean }) => {
    return (
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((num) => {
          const isHit = numbers?.includes(num) || false;
          const isHighlight = highlight?.includes(num) || false;
          const freq = numberFreq[num] || 0;
          const heat = Math.min(freq / Math.max(games.length * 0.05, 1), 1);

          // Calculate row/col for stat display
          const row = getRow(num);
          const col = getCol(num);

          return (
            <div
              key={num}
              className={`
                relative aspect-square flex items-center justify-center text-xs font-medium rounded
                ${currentTheme.card} ${currentTheme.border} border
                ${isHighlight ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-offset-400' : ''}
                ${isHit ? 'bg-green-600 text-white' : ''}
                transition-all hover:scale-105 cursor-pointer
              `}
              title={`#${num} | Row ${row} Col ${col} | Freq: ${freq}`}
            >
              {num}
              {showStats && games.length > 0 && (
                <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full" style={{
                  opacity: heat,
                  backgroundColor: currentTheme.accent
                }} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Heatmap Component
  const HeatmapView = () => {
    return (
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((num) => {
          const r = Math.floor((num - 1) / 10);
          const c = (num - 1) % 10;
          const heat = heatmapData[r]?.[c] || 0;
          const intensity = Math.min(heat / 6, 1);
          const row = getRow(num);
          const col = getCol(num);

          const bgColors: Record<Theme, string> = {
            default: `rgba(59, 130, 246, ${intensity})`,
            midnight: `rgba(99, 102, 241, ${intensity})`,
            sunset: `rgba(249, 115, 22, ${intensity})`,
            forest: `rgba(16, 185, 129, ${intensity})`,
            ocean: `rgba(6, 182, 212, ${intensity})`,
            purple: `rgba(168, 85, 247, ${intensity})`,
            rose: `rgba(244, 63, 94, ${intensity})`,
            amber: `rgba(245, 158, 11, ${intensity})`,
          };

          return (
            <div
              key={num}
              className={`aspect-square flex items-center justify-center text-xs font-medium rounded ${currentTheme.card} ${currentTheme.border} border hover:scale-105 transition-transform cursor-pointer`}
              style={{ backgroundColor: intensity > 0.1 ? bgColors[theme] : undefined }}
              title={`#${num} R${row}C${col}: ${heat} hits`}
            >
              <span className={intensity > 0.5 ? 'text-white font-bold' : ''}>{num}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${currentTheme.bg}`}>
        <div className="text-center space-y-4">
          <RefreshCwIcon className="w-12 h-12 animate-spin mx-auto text-blue-500" />
          <p className={currentTheme.text}>Loading {backtestGames} historical games...</p>
        </div>
      </div>
    );
  }

  const lastGame = games[0];

  return (
    <div className={`min-h-screen ${currentTheme.bg} ${currentTheme.text} p-2 md:p-4`}>
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* Header */}
        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 rounded-xl ${currentTheme.card} ${currentTheme.border} border`}>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <TargetIcon className="w-8 h-8 text-blue-500" />
              Last Dance Keno Dashboard
            </h1>
            <p className={`text-sm ${currentTheme.muted} mt-1`}>
              {games.length} games loaded • {playableNumbers.length} playable numbers • {backtestResult?.games_analyzed || 0} games backtested
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(THEMES).map(([key, t]) => (
                  <SelectItem key={key} value={key}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <Label className="text-sm">Auto</Label>
            </div>
            <Button onClick={() => window.location.reload()} size="sm" variant="outline">
              <RefreshCwIcon className="w-4 h-4 mr-2" />
              Reload
            </Button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* Filters Panel - Left Side */}
          <div className="xl:col-span-1 space-y-4">
            <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <SettingsIcon className="w-5 h-5" />
                  Elimination Filters
                </CardTitle>
                <CardDescription>Toggle rules to eliminate numbers</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[700px] pr-4">
                  <div className="space-y-4">
                    {/* Hit in Last X Games */}
                    <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                      <Label className="text-sm font-semibold mb-2 block">Hit in Last X Games (Eliminate)</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 5, 10].map((n) => (
                          <div key={n} className="flex items-center gap-1">
                            <Switch
                              checked={filters[`eliminateHitLast${n}` as keyof typeof filters] as boolean}
                              onCheckedChange={(c) => updateFilter(`eliminateHitLast${n}` as keyof typeof filters, c)}
                            />
                            <Label className="text-xs">{n}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Custom Hit Range */}
                    <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-semibold">Custom Hit Range</Label>
                        <Switch checked={filters.enableCustomHitRange} onCheckedChange={(c) => updateFilter('enableCustomHitRange', c)} />
                      </div>
                      {filters.enableCustomHitRange && (
                        <div className="space-y-3 mt-2">
                          <div>
                            <Label className="text-xs">Hit {filters.customHitRangeCount}+ times</Label>
                            <Slider
                              value={[filters.customHitRangeCount]}
                              onValueChange={([v]) => updateFilter('customHitRangeCount', v)}
                              min={1}
                              max={10}
                              step={1}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">In last {filters.customHitRangeLookback} games</Label>
                            <Slider
                              value={[filters.customHitRangeLookback]}
                              onValueChange={([v]) => updateFilter('customHitRangeLookback', v)}
                              min={1}
                              max={20}
                              step={1}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Keep If Hit In Last */}
                    <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-semibold">Keep Only If Hit (Keep Mode)</Label>
                        <Switch checked={filters.keepIfHitInLast} onCheckedChange={(c) => updateFilter('keepIfHitInLast', c)} />
                      </div>
                      {filters.keepIfHitInLast && (
                        <div className="space-y-3 mt-2">
                          <div>
                            <Label className="text-xs">Min {filters.keepIfHitMinCount} hits</Label>
                            <Slider
                              value={[filters.keepIfHitMinCount]}
                              onValueChange={([v]) => updateFilter('keepIfHitMinCount', v)}
                              min={1}
                              max={10}
                              step={1}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">In last {filters.keepIfHitLookback} games</Label>
                            <Slider
                              value={[filters.keepIfHitLookback]}
                              onValueChange={([v]) => updateFilter('keepIfHitLookback', v)}
                              min={1}
                              max={20}
                              step={1}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Position Eliminations */}
                    <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                      <Label className="text-sm font-semibold mb-2 block">Eliminate by Position (Last Game)</Label>
                      <div className="grid grid-cols-6 gap-2">
                        {[1, 2, 3, 4, 5, 20].map((pos) => (
                          <div key={pos} className="flex items-center gap-1">
                            <Switch
                              checked={pos === 1 ? filters.eliminatePos1 :
                                       pos === 2 ? filters.eliminatePos2 :
                                       pos === 3 ? filters.eliminatePos3 :
                                       pos === 4 ? filters.eliminatePos4 :
                                       pos === 5 ? filters.eliminatePos5 : filters.eliminatePosLast}
                              onCheckedChange={(c) => {
                                if (pos === 1) updateFilter('eliminatePos1', c);
                                else if (pos === 2) updateFilter('eliminatePos2', c);
                                else if (pos === 3) updateFilter('eliminatePos3', c);
                                else if (pos === 4) updateFilter('eliminatePos4', c);
                                else if (pos === 5) updateFilter('eliminatePos5', c);
                                else updateFilter('eliminatePosLast', c);
                              }}
                            />
                            <Label className="text-xs">{pos === 20 ? 'Last' : `#${pos}`}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Row/Column Eliminations */}
                    <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                      <Label className="text-sm font-semibold mb-2 block">Hot Row/Column Elimination</Label>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Hot Rows (≥{filters.hotRowThreshold} hits)</Label>
                          <Switch checked={filters.eliminateHotRows} onCheckedChange={(c) => updateFilter('eliminateHotRows', c)} />
                        </div>
                        {filters.eliminateHotRows && (
                          <Slider
                            value={[filters.hotRowThreshold]}
                            onValueChange={([v]) => updateFilter('hotRowThreshold', v)}
                            min={1}
                            max={6}
                            step={1}
                          />
                        )}
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Hot Cols (≥{filters.hotColThreshold} hits)</Label>
                          <Switch checked={filters.eliminateHotCols} onCheckedChange={(c) => updateFilter('eliminateHotCols', c)} />
                        </div>
                        {filters.eliminateHotCols && (
                          <Slider
                            value={[filters.hotColThreshold]}
                            onValueChange={([v]) => updateFilter('hotColThreshold', v)}
                            min={1}
                            max={6}
                            step={1}
                          />
                        )}
                      </div>
                    </div>

                    {/* Neighbor Elimination */}
                    <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Eliminate No Neighbor Hit</Label>
                        <Switch checked={filters.eliminateNoNeighbor} onCheckedChange={(c) => updateFilter('eliminateNoNeighbor', c)} />
                      </div>
                      <p className={`text-xs ${currentTheme.muted} mt-1`}>Numbers whose neighbors didn&rsquo;t hit last game</p>
                    </div>

                    {/* Custom Game Checkboxes */}
                    <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-semibold">Custom Game Selection</Label>
                        <Switch checked={filters.enableCustomGames} onCheckedChange={(c) => updateFilter('enableCustomGames', c)} />
                      </div>
                      {filters.enableCustomGames && (
                        <div className="grid grid-cols-10 gap-1 mt-2">
                          {filters.customGames.map((checked, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-1">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  const newCustom = [...filters.customGames];
                                  newCustom[idx] = !!c;
                                  updateFilter('customGames', newCustom);
                                }}
                              />
                              <span className="text-xs">{idx + 1}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pattern Eliminations */}
                    <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                      <Label className="text-sm font-semibold mb-2 block">Pattern Eliminations</Label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Eliminate Mirrored (81-n)</Label>
                          <Switch checked={filters.eliminateMirrored} onCheckedChange={(c) => updateFilter('eliminateMirrored', c)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Eliminate Row Repeaters</Label>
                          <Switch checked={filters.eliminateRowRepeaters} onCheckedChange={(c) => updateFilter('eliminateRowRepeaters', c)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Eliminate Col Repeaters</Label>
                          <Switch checked={filters.eliminateColRepeaters} onCheckedChange={(c) => updateFilter('eliminateColRepeaters', c)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Results Panel - Right Side */}
          <div className="xl:col-span-3 space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Playable</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">{playableNumbers.length}</div>
                </CardContent>
              </Card>
              <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Avg Hits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-500">
                    {backtestResult?.hit_rate.toFixed(2) || '0.00'}
                  </div>
                </CardContent>
              </Card>
              <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Hit Rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-500">
                    {backtestResult ? `${((backtestResult.hit_rate / 20) * 100).toFixed(1)}%` : '0%'}
                  </div>
                </CardContent>
              </Card>
              <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Total Hits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-500">
                    {backtestResult?.hits || 0}
                  </div>
                </CardContent>
              </Card>
              <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Avg Pool</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-cyan-500">
                    {backtestResult?.avg_playable.toFixed(1) || '0'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Settings Row */}
            <div className={`flex flex-wrap items-center gap-4 p-4 rounded-xl ${currentTheme.card} ${currentTheme.border} border`}>
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <Label className="text-sm font-semibold">Max Playable:</Label>
                <Slider
                  value={[maxNumbers]}
                  onValueChange={([v]) => setMaxNumbers(v)}
                  min={5}
                  max={40}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={maxNumbers}
                  onChange={(e) => setMaxNumbers(parseInt(e.target.value) || 20)}
                  className="w-16 h-8"
                  min={5}
                  max={40}
                />
              </div>
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <Label className="text-sm font-semibold">Backtest Games:</Label>
                <Slider
                  value={[backtestGames]}
                  onValueChange={([v]) => setBacktestGames(v)}
                  min={10}
                  max={500}
                  step={10}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-12">{backtestGames}</span>
              </div>
            </div>

            {/* Board Tabs */}
            <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
              <CardHeader>
                <CardTitle>Board View</CardTitle>
                <CardDescription>
                  Last Game: #{lastGame?.game_id} • {lastGame?.date} {lastGame?.time}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="prediction">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="prediction">Prediction ({playableNumbers.length})</TabsTrigger>
                    <TabsTrigger value="heatmap">Heatmap (20)</TabsTrigger>
                    <TabsTrigger value="last">Last Game</TabsTrigger>
                    <TabsTrigger value="stats">Stats</TabsTrigger>
                  </TabsList>
                  <TabsContent value="prediction" className="mt-4">
                    <KenoBoard highlight={playableNumbers} />
                    <div className={`mt-4 flex items-center gap-4 text-sm ${currentTheme.muted}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded ring-2 ring-green-400 ring-offset-1" />
                        <span>Playable ({playableNumbers.length})</span>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="heatmap" className="mt-4">
                    <HeatmapView />
                    <div className={`mt-4 text-sm ${currentTheme.muted}`}>
                      Heat intensity based on hits in last 20 games
                    </div>
                  </TabsContent>
                  <TabsContent value="last" className="mt-4">
                    <KenoBoard numbers={lastGame?.numbers} />
                    <div className={`mt-4 flex items-center gap-2 text-sm ${currentTheme.muted}`}>
                      <div className="w-4 h-4 rounded bg-green-600" />
                      <span>Last game draw - Game #{lastGame?.game_id}</span>
                    </div>
                  </TabsContent>
                  <TabsContent value="stats" className="mt-4">
                    <KenoBoard showStats />
                    <div className={`mt-4 text-sm ${currentTheme.muted}`}>
                      Dot opacity shows hit frequency across all {games.length} games
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Playable Numbers List */}
            <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
              <CardHeader>
                <CardTitle>Playable Numbers</CardTitle>
                <CardDescription>
                  {playableNumbers.length} numbers passed all filters • Sorted ascending
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {playableNumbers.map((num) => {
                    const row = getRow(num);
                    const col = getCol(num);
                    const freq = numberFreq[num] || 0;
                    const pct = games.length > 0 ? ((freq / games.length) * 100).toFixed(1) : '0';

                    return (
                      <Badge
                        key={num}
                        variant="secondary"
                        className={`text-sm px-3 py-1 cursor-pointer hover:scale-105 transition-transform ${currentTheme.card} ${currentTheme.border} border`}
                        title={`R${row}C${col} | ${freq} hits (${pct}%)`}
                      >
                        {num}
                        <span className={`ml-1 text-xs ${currentTheme.muted}`}>({pct}%)</span>
                      </Badge>
                    );
                  })}
                </div>
                {playableNumbers.length === 0 && (
                  <p className={`text-center ${currentTheme.muted} py-8`}>
                    No playable numbers - adjust filters to see results
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Backtest Breakdown */}
            <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3Icon className="w-5 h-5" />
                  Backtest Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className={`text-sm ${currentTheme.muted}`}>Games Analyzed</div>
                    <div className="text-xl font-bold">{backtestResult?.games_analyzed || 0}</div>
                  </div>
                  <div>
                    <div className={`text-sm ${currentTheme.muted}`}>Total Hits</div>
                    <div className="text-xl font-bold text-green-500">{backtestResult?.hits || 0}</div>
                  </div>
                  <div>
                    <div className={`text-sm ${currentTheme.muted}`}>Total Misses</div>
                    <div className="text-xl font-bold text-red-500">{backtestResult?.misses || 0}</div>
                  </div>
                  <div>
                    <div className={`text-sm ${currentTheme.muted}`}>Avg Playable Pool</div>
                    <div className="text-xl font-bold">{backtestResult?.avg_playable.toFixed(1) || 0}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
