'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Separator } from '@/components/ui/separator';
import {
  Game,
  FilterRule,
  BacktestResult,
  applyFilters,
  backtest,
  getNumberStats,
  getHeatmapData,
  getNumberFrequency,
  ROWS,
  COLS,
} from '@/lib/keno';
import PlayIcon from 'lucide-react/dist/esm/icons/play';
import RefreshCwIcon from 'lucide-react/dist/esm/icons/refresh-cw';
import TrendingUpIcon from 'lucide-react/dist/esm/icons/trending-up';
import TrendingDownIcon from 'lucide-react/dist/esm/icons/trending-down';

type Theme = 'default' | 'midnight' | 'sunset' | 'forest' | 'ocean' | 'purple';

const THEMES: Record<Theme, { name: string; bg: string; card: string; text: string; accent: string }> = {
  default: { name: 'Default', bg: 'bg-slate-50', card: 'bg-white', text: 'text-slate-900', accent: 'bg-blue-500' },
  midnight: { name: 'Midnight', bg: 'bg-slate-950', card: 'bg-slate-900', text: 'text-slate-100', accent: 'bg-indigo-500' },
  sunset: { name: 'Sunset', bg: 'bg-orange-50', card: 'bg-orange-100/50', text: 'text-orange-950', accent: 'bg-orange-500' },
  forest: { name: 'Forest', bg: 'bg-emerald-950', card: 'bg-emerald-900', text: 'text-emerald-100', accent: 'bg-emerald-500' },
  ocean: { name: 'Ocean', bg: 'bg-cyan-950', card: 'bg-cyan-900', text: 'text-cyan-100', accent: 'bg-cyan-500' },
  purple: { name: 'Purple', bg: 'bg-purple-950', card: 'bg-purple-900', text: 'text-purple-100', accent: 'bg-purple-500' },
};

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>('midnight');
  const [maxNumbers, setMaxNumbers] = useState(20);
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [playableNumbers, setPlayableNumbers] = useState<number[]>([]);

  // Initialize rules
  useEffect(() => {
    setRules([
      {
        id: 'hit_last_2',
        name: 'Hit in Last 2 Games',
        type: 'hit_range',
        enabled: false,
        params: { hitInLast: true, lastCount: 2, eliminate: true },
      },
      {
        id: 'hit_2_of_3',
        name: 'Hit 2+ Times in Last 3 Games',
        type: 'custom',
        enabled: false,
        params: { hitCount: 2, inGames: 3, eliminateIfHit: true },
      },
      {
        id: 'hit_4_of_8',
        name: 'Hit 4+ Times in Last 8 Games',
        type: 'custom',
        enabled: false,
        params: { hitCount: 4, inGames: 8, eliminateIfHit: true },
      },
      {
        id: 'hit_6_of_10',
        name: 'Hit 6+ Times in Last 10 Games',
        type: 'custom',
        enabled: false,
        params: { hitCount: 6, inGames: 10, eliminateIfHit: true },
      },
      {
        id: 'must_hit_5',
        name: 'Must Have Hit in Last 5 Games',
        type: 'hit_range',
        enabled: false,
        params: { mustHitInLast: true, mustHitCount: 5 },
      },
      {
        id: 'position_1_3_4',
        name: 'Pattern 1-3-4 Elimination',
        type: 'custom',
        enabled: false,
        params: { pattern: '134', patternPositions: [1, 3, 4] },
      },
      {
        id: 'hot_row_col',
        name: 'Hot Row/Col (4+ hits)',
        type: 'row_col',
        enabled: false,
        params: { hotRows: true, hotCols: true, rowThreshold: 4, colThreshold: 4 },
      },
      {
        id: 'neighbor_hit',
        name: 'Require Neighbor Hit',
        type: 'neighbor',
        enabled: false,
        params: { requireNeighborHit: true },
      },
      {
        id: 'custom_range',
        name: 'Custom Game Range',
        type: 'hit_range',
        enabled: false,
        params: { customCheckboxes: true, checkboxes: Array(10).fill(false) },
      },
    ]);
  }, []);

  // Load games
  useEffect(() => {
    fetch('/api/games')
      .then((res) => res.json())
      .then((data: Game[]) => {
        setGames(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load games:', err);
        setLoading(false);
      });
  }, []);

  // Run backtest when rules change
  const runAnalysis = useCallback(() => {
    if (games.length === 0) return;

    const result = backtest(games, rules, maxNumbers);
    setBacktestResult(result);
    setPlayableNumbers(result.playable_numbers);
  }, [games, rules, maxNumbers]);

  useEffect(() => {
    if (games.length > 0) {
      runAnalysis();
    }
  }, [runAnalysis]);

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  const updateRuleParam = (id: string, param: string, value: any) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === id
          ? { ...rule, params: { ...rule.params, [param]: value } }
          : rule
      )
    );
  };

  const toggleCustomCheckbox = (ruleId: string, index: number) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id === ruleId && rule.params.checkboxes) {
          const newCheckboxes = [...rule.params.checkboxes];
          newCheckboxes[index] = !newCheckboxes[index];
          return {
            ...rule,
            params: { ...rule.params, checkboxes: newCheckboxes },
          };
        }
        return rule;
      })
    );
  };

  const currentTheme = THEMES[theme];
  const heatmapData = games.length > 0 ? getHeatmapData(games) : [];
  const numberFreq = games.length > 0 ? getNumberFrequency(games) : {};

  const KenoBoard = ({ numbers, highlight }: { numbers?: number[]; highlight?: number[] }) => {
    return (
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((num) => {
          const isHit = numbers?.includes(num) || false;
          const isHighlight = highlight?.includes(num) || false;
          const freq = numberFreq[num] || 0;
          const heat = Math.min(freq / 10, 1);

          return (
            <div
              key={num}
              className={`
                aspect-square flex items-center justify-center text-xs font-medium rounded
                ${currentTheme.card}
                ${isHighlight ? 'ring-2 ring-green-500 ring-offset-1' : ''}
                ${isHit ? 'bg-green-500 text-white' : ''}
                transition-all
              `}
              title={`#${num}: ${freq} hits`}
            >
              {num}
            </div>
          );
        })}
      </div>
    );
  };

  const HeatmapView = () => {
    return (
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((num) => {
          const r = Math.floor((num - 1) / 10);
          const c = (num - 1) % 10;
          const heat = heatmapData[r]?.[c] || 0;
          const intensity = Math.min(heat / 5, 1);

          const bgColors = {
            default: `rgba(59, 130, 246, ${intensity})`,
            midnight: `rgba(99, 102, 241, ${intensity})`,
            sunset: `rgba(249, 115, 22, ${intensity})`,
            forest: `rgba(16, 185, 129, ${intensity})`,
            ocean: `rgba(6, 182, 212, ${intensity})`,
            purple: `rgba(168, 85, 247, ${intensity})`,
          };

          return (
            <div
              key={num}
              className={`aspect-square flex items-center justify-center text-xs font-medium rounded ${currentTheme.card}`}
              style={{ backgroundColor: bgColors[theme] }}
              title={`#${num}: ${heat} hits`}
            >
              {num}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${currentTheme.bg}`}>
        <div className="text-center">
          <RefreshCwIcon className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className={`${currentTheme.text}`}>Loading games...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${currentTheme.bg} ${currentTheme.text} p-4 md:p-8`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Last Dance Keno Dashboard</h1>
            <p className="text-sm opacity-70">Real-time strategy backtesting with {games.length} games loaded</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
              <SelectTrigger className="w-40">
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
            <Button onClick={runAnalysis} size="sm">
              <RefreshCwIcon className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters Panel */}
          <Card className={`${currentTheme.card} ${currentTheme.text}`}>
            <CardHeader>
              <CardTitle>Strategy Filters</CardTitle>
              <CardDescription>Configure elimination rules</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <div key={rule.id} className="space-y-2 p-3 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={() => toggleRule(rule.id)}
                          />
                          <Label className="text-sm font-medium">{rule.name}</Label>
                        </div>
                      </div>

                      {/* Custom checkboxes for game range */}
                      {rule.enabled && rule.params.customCheckboxes && (
                        <div className="mt-2 pl-6">
                          <Label className="text-xs opacity-70">Select games to eliminate:</Label>
                          <div className="grid grid-cols-10 gap-1 mt-1">
                            {rule.params.checkboxes?.map((checked: boolean, idx: number) => (
                              <div key={idx} className="flex items-center gap-1">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleCustomCheckbox(rule.id, idx)}
                                />
                                <span className="text-xs">{idx + 1}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Slider for last count */}
                      {rule.enabled && rule.params.hitInLast && (
                        <div className="mt-2 pl-6 space-y-1">
                          <Label className="text-xs opacity-70">
                            Look back {rule.params.lastCount} games
                          </Label>
                          <Slider
                            value={[rule.params.lastCount || 1]}
                            onValueChange={([v]) => updateRuleParam(rule.id, 'lastCount', v)}
                            min={1}
                            max={10}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      )}

                      {/* Slider for custom hit count */}
                      {rule.enabled && rule.params.hitCount !== undefined && (
                        <div className="mt-2 pl-6 space-y-1">
                          <Label className="text-xs opacity-70">
                            {rule.params.eliminateIfHit ? 'Eliminate if' : 'Keep only if'} hit {rule.params.hitCount}+ times in {rule.params.inGames} games
                          </Label>
                          <div className="flex gap-2">
                            <Slider
                              value={[rule.params.hitCount]}
                              onValueChange={([v]) => updateRuleParam(rule.id, 'hitCount', v)}
                              min={1}
                              max={10}
                              step={1}
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              value={rule.params.inGames}
                              onChange={(e) => updateRuleParam(rule.id, 'inGames', parseInt(e.target.value) || 5)}
                              className="w-16 h-8"
                              min={1}
                              max={20}
                            />
                          </div>
                        </div>
                      )}

                      {/* Must hit in last */}
                      {rule.enabled && rule.params.mustHitInLast && (
                        <div className="mt-2 pl-6 space-y-1">
                          <Label className="text-xs opacity-70">
                            Must hit in last {rule.params.mustHitCount} games
                          </Label>
                          <Slider
                            value={[rule.params.mustHitCount || 5]}
                            onValueChange={([v]) => updateRuleParam(rule.id, 'mustHitCount', v)}
                            min={1}
                            max={20}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      )}

                      {/* Row/Col threshold */}
                      {rule.enabled && rule.params.hotRows && (
                        <div className="mt-2 pl-6 space-y-1">
                          <Label className="text-xs opacity-70">
                            Threshold: {rule.params.rowThreshold}+ hits
                          </Label>
                          <Slider
                            value={[rule.params.rowThreshold || 4]}
                            onValueChange={([v]) => {
                              updateRuleParam(rule.id, 'rowThreshold', v);
                              updateRuleParam(rule.id, 'colThreshold', v);
                            }}
                            min={2}
                            max={8}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className={`${currentTheme.card} ${currentTheme.text}`}>
                <CardHeader className="pb-2">
                  <CardDescription>Playable Numbers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{playableNumbers.length}</div>
                </CardContent>
              </Card>
              <Card className={`${currentTheme.card} ${currentTheme.text}`}>
                <CardHeader className="pb-2">
                  <CardDescription>Avg Hits/Game</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">
                    {backtestResult?.hit_rate.toFixed(2) || '0.00'}
                  </div>
                </CardContent>
              </Card>
              <Card className={`${currentTheme.card} ${currentTheme.text}`}>
                <CardHeader className="pb-2">
                  <CardDescription>Games Analyzed</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {backtestResult?.games_analyzed || 0}
                  </div>
                </CardContent>
              </Card>
              <Card className={`${currentTheme.card} ${currentTheme.text}`}>
                <CardHeader className="pb-2">
                  <CardDescription>Hit Rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-500">
                    {backtestResult
                      ? `${((backtestResult.hit_rate / 20) * 100).toFixed(1)}%`
                      : '0%'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Max Numbers Slider */}
            <Card className={`${currentTheme.card} ${currentTheme.text}`}>
              <CardHeader>
                <CardTitle>Maximum Playable Numbers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
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
                    className="w-20"
                    min={5}
                    max={40}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tabs for Boards */}
            <Card className={`${currentTheme.card} ${currentTheme.text}`}>
              <CardHeader>
                <CardTitle>Board View</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="prediction">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="prediction">Prediction</TabsTrigger>
                    <TabsTrigger value="heatmap">Heatmap (20)</TabsTrigger>
                    <TabsTrigger value="last">Last Game</TabsTrigger>
                  </TabsList>
                  <TabsContent value="prediction" className="mt-4">
                    <KenoBoard highlight={playableNumbers} />
                    <div className="mt-4 flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 rounded ring-2 ring-green-500 ring-offset-1" />
                      <span>Playable ({playableNumbers.length} numbers)</span>
                    </div>
                  </TabsContent>
                  <TabsContent value="heatmap" className="mt-4">
                    <HeatmapView />
                    <div className="mt-4 text-sm opacity-70">
                      Heat intensity based on hits in last 20 games
                    </div>
                  </TabsContent>
                  <TabsContent value="last" className="mt-4">
                    <KenoBoard numbers={games[0]?.numbers} />
                    <div className="mt-4 flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 rounded bg-green-500" />
                      <span>Last game draw (Game #{games[0]?.game_id})</span>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Playable Numbers List */}
            <Card className={`${currentTheme.card} ${currentTheme.text}`}>
              <CardHeader>
                <CardTitle>Playable Numbers</CardTitle>
                <CardDescription>Numbers that passed all filters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {playableNumbers.map((num) => (
                    <Badge key={num} variant="secondary" className="text-sm px-3 py-1">
                      {num}
                    </Badge>
                  ))}
                </div>
                {playableNumbers.length === 0 && (
                  <p className="text-center opacity-50 py-4">No playable numbers. Adjust filters.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
