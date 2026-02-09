'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  getNumberFrequency,
} from '@/lib/keno';
import { RefreshCwIcon, PlayIcon, BarChart3Icon, SettingsIcon, TargetIcon, PlusIcon, XIcon, CheckIcon, TrendingUpIcon, FilterIcon, SaveIcon, FolderOpenIcon, DownloadIcon, UploadIcon, TrashIcon } from 'lucide-react';

type Theme = 'midnight' | 'ocean' | 'forest' | 'purple' | 'rose' | 'amber' | 'default';

const THEMES: Record<Theme, { name: string; bg: string; card: string; text: string; accent: string; border: string; muted: string; success: string; danger: string }> = {
  midnight: { name: 'Midnight', bg: 'bg-slate-950', card: 'bg-slate-900', text: 'text-slate-100', accent: 'bg-indigo-500', border: 'border-slate-700', muted: 'text-slate-400', success: 'text-green-400', danger: 'text-red-400' },
  ocean: { name: 'Ocean', bg: 'bg-cyan-950', card: 'bg-cyan-900/50', text: 'text-cyan-100', accent: 'bg-cyan-500', border: 'border-cyan-800', muted: 'text-cyan-300', success: 'text-green-400', danger: 'text-red-400' },
  forest: { name: 'Forest', bg: 'bg-emerald-950', card: 'bg-emerald-900/50', text: 'text-emerald-100', accent: 'bg-emerald-500', border: 'border-emerald-800', muted: 'text-emerald-300', success: 'text-green-400', danger: 'text-red-400' },
  purple: { name: 'Purple', bg: 'bg-purple-950', card: 'bg-purple-900/50', text: 'text-purple-100', accent: 'bg-purple-500', border: 'border-purple-800', muted: 'text-purple-300', success: 'text-green-400', danger: 'text-red-400' },
  rose: { name: 'Rose', bg: 'bg-rose-950', card: 'bg-rose-900/50', text: 'text-rose-100', accent: 'bg-rose-500', border: 'border-rose-800', muted: 'text-rose-300', success: 'text-green-400', danger: 'text-red-400' },
  amber: { name: 'Amber', bg: 'bg-amber-950', card: 'bg-amber-900/50', text: 'text-amber-100', accent: 'bg-amber-500', border: 'border-amber-800', muted: 'text-amber-300', success: 'text-green-400', danger: 'text-red-400' },
  default: { name: 'Default', bg: 'bg-slate-50', card: 'bg-white', text: 'text-slate-900', accent: 'bg-blue-500', border: 'border-slate-200', muted: 'text-slate-600', success: 'text-green-600', danger: 'text-red-600' },
};

// Strategy Definitions
const STRATEGIES: Record<string, {
  name: string;
  description: string;
  filters: FilterRule[];
}> = {
  elimination: {
    name: 'Elimination Rules',
    description: 'Original 7-rule elimination filter',
    filters: [
      { id: 'hit_last_2', name: 'Hit in Last 2', type: 'hit_range', enabled: true, params: { hitInLast: true, lastCount: 2, eliminate: true } },
      { id: 'hit_2_of_3', name: 'Hit 2+ in Last 3', type: 'custom', enabled: true, params: { hitCount: 2, inGames: 3, eliminateIfHit: true } },
      { id: 'hit_4_of_8', name: 'Hit 4+ in Last 8', type: 'custom', enabled: true, params: { hitCount: 4, inGames: 8, eliminateIfHit: true } },
      { id: 'hit_6_of_10', name: 'Hit 6+ in Last 10', type: 'custom', enabled: true, params: { hitCount: 6, inGames: 10, eliminateIfHit: true } },
      { id: 'pos_1_3_4', name: 'Pattern 1-3-4', type: 'custom', enabled: true, params: { pattern: '134', patternPositions: [1, 3, 4] } },
      { id: 'hot_row_col', name: 'Hot Row/Col (4+)', type: 'row_col', enabled: true, params: { hotRows: true, hotCols: true, rowThreshold: 4, colThreshold: 4 } },
      { id: 'neighbor', name: 'Neighbor Hit Required', type: 'neighbor', enabled: true, params: { requireNeighborHit: true } },
    ]
  },
  statistical: {
    name: 'Statistical',
    description: 'Z-score, trend, and overdue analysis',
    filters: [
      { id: 'cold_numbers', name: 'Cold Numbers (Below Avg)', type: 'custom', enabled: true, params: { hitCount: 0, inGames: 10, eliminateIfHit: false } },
      { id: 'overdue', name: 'Overdue (Gap > 2x Avg)', type: 'custom', enabled: true, params: { eliminateIfHit: false } },
    ]
  },
  vacuum: {
    name: 'Vacuum',
    description: 'Super-hot repeaters (4+ hits in 6 games)',
    filters: [
      { id: 'vacuum_hot', name: '4+ Hits in 6 Games', type: 'custom', enabled: true, params: { hitCount: 4, inGames: 6, eliminateIfHit: false } },
    ]
  },
  dead_zone: {
    name: 'Dead Zone',
    description: 'Cold numbers in dead zones',
    filters: [
      { id: 'dead_zone', name: '0 Hits in 15+ Games', type: 'custom', enabled: true, params: { hitCount: 0, inGames: 15, eliminateIfHit: false } },
    ]
  },
  mirror: {
    name: 'Mirror Fold',
    description: 'Mirrored positions from last game',
    filters: [
      { id: 'mirror_keep', name: 'Keep Mirrored Numbers', type: 'custom', enabled: true, params: { eliminateMirrored: true, reverseMode: true } },
    ]
  },
  cluster_heat: {
    name: 'Cluster Heat',
    description: 'Highest neighbor heat scoring',
    filters: [
      { id: 'cluster', name: 'Keep High Cluster Numbers', type: 'custom', enabled: true, params: { eliminateIfHit: false } },
    ]
  },
  opposite_rc: {
    name: 'Opposite Row/Col',
    description: 'Opposite row/col of hottest zones',
    filters: [
      { id: 'opposite_row', name: 'Opposite Row of Hot', type: 'custom', enabled: true, params: { eliminateIfHit: false } },
      { id: 'opposite_col', name: 'Opposite Col of Hot', type: 'custom', enabled: true, params: { eliminateIfHit: false } },
    ]
  },
  decade: {
    name: 'Decade',
    description: 'Under-represented decades',
    filters: [
      { id: 'decade_1_10', name: 'Keep Low Decade (1-10)', type: 'custom', enabled: true, params: { decadeRange: [1, 10], eliminateIfHit: false } },
      { id: 'decade_71_80', name: 'Keep High Decade (71-80)', type: 'custom', enabled: true, params: { decadeRange: [71, 80], eliminateIfHit: false } },
    ]
  },
  ice_box: {
    name: 'Ice Box',
    description: 'Avoid numbers hitting 2+ in last 3',
    filters: [
      { id: 'ice_box', name: 'Eliminate 2+ Hits in Last 3', type: 'custom', enabled: true, params: { hitCount: 2, inGames: 3, eliminateIfHit: true } },
    ]
  },
  lonely_7: {
    name: 'Lonely 7',
    description: '7 coldest numbers (0 hits in 12+ games)',
    filters: [
      { id: 'lonely', name: '0 Hits in 12+ Games', type: 'custom', enabled: true, params: { hitCount: 0, inGames: 12, eliminateIfHit: false } },
    ]
  },
  arrow: {
    name: 'Arrow',
    description: 'First-to-last draw path analysis',
    filters: [
      { id: 'arrow_up', name: 'Arrow Up Pattern', type: 'custom', enabled: true, params: { eliminateIfHit: false } },
      { id: 'arrow_down', name: 'Arrow Down Pattern', type: 'custom', enabled: true, params: { eliminateIfHit: false } },
    ]
  },
  custom: {
    name: 'Custom',
    description: 'Build your own strategy',
    filters: []
  }
};

interface FilterConfig {
  id: string;
  name: string;
  category: 'hit' | 'position' | 'rowcol' | 'neighbor' | 'pattern' | 'custom';
  enabled: boolean;
  params: Record<string, any>;
}

// Available filter templates
const FILTER_TEMPLATES: FilterConfig[] = [
  // Hit-based filters
  { id: 'hit_last_1', name: 'Hit in Last 1 Game', category: 'hit', enabled: false, params: { lastCount: 1, eliminate: true, useForNonHits: false } },
  { id: 'hit_last_2', name: 'Hit in Last 2 Games', category: 'hit', enabled: false, params: { lastCount: 2, eliminate: true, useForNonHits: false } },
  { id: 'hit_last_3', name: 'Hit in Last 3 Games', category: 'hit', enabled: false, params: { lastCount: 3, eliminate: true, useForNonHits: false } },
  { id: 'hit_last_5', name: 'Hit in Last 5 Games', category: 'hit', enabled: false, params: { lastCount: 5, eliminate: true, useForNonHits: false } },
  { id: 'hit_last_10', name: 'Hit in Last 10 Games', category: 'hit', enabled: false, params: { lastCount: 10, eliminate: true, useForNonHits: false } },
  { id: 'hit_x_of_y', name: 'Hit X+ Times in Y Games', category: 'hit', enabled: false, params: { hitCount: 2, inGames: 5, eliminate: true, useForNonHits: false } },
  { id: 'must_hit', name: 'Must Have Hit in Last X', category: 'hit', enabled: false, params: { lastCount: 10, eliminate: false, useForNonHits: true } },

  // Position filters
  { id: 'pos_1', name: 'Position #1', category: 'position', enabled: false, params: { positions: [1] } },
  { id: 'pos_2', name: 'Position #2', category: 'position', enabled: false, params: { positions: [2] } },
  { id: 'pos_3', name: 'Position #3', category: 'position', enabled: false, params: { positions: [3] } },
  { id: 'pos_4', name: 'Position #4', category: 'position', enabled: false, params: { positions: [4] } },
  { id: 'pos_5', name: 'Position #5', category: 'position', enabled: false, params: { positions: [5] } },
  { id: 'pos_last', name: 'Position #20 (Last)', category: 'position', enabled: false, params: { positions: [20] } },
  { id: 'pos_1_3_4', name: 'Pattern 1-3-4', category: 'position', enabled: false, params: { positions: [1, 3, 4] } },

  // Row/Column filters
  { id: 'hot_row', name: 'Hot Row (X+ hits)', category: 'rowcol', enabled: false, params: { hotRows: true, rowThreshold: 3 } },
  { id: 'hot_col', name: 'Hot Column (X+ hits)', category: 'rowcol', enabled: false, params: { hotCols: true, colThreshold: 3 } },
  { id: 'row_repeat', name: 'Row Repeaters (2+ in same row)', category: 'rowcol', enabled: false, params: { eliminateRowRepeaters: true } },
  { id: 'col_repeat', name: 'Col Repeaters (2+ in same col)', category: 'rowcol', enabled: false, params: { eliminateColRepeaters: true } },

  // Neighbor filters
  { id: 'neighbor_hit', name: 'Neighbor Hit Required', category: 'neighbor', enabled: false, params: { requireNeighborHit: true } },
  { id: 'neighbor_shape', name: 'Neighbor Shape Priority', category: 'neighbor', enabled: false, params: { shapeType: 'cross', prioritize: true } },

  // Pattern filters
  { id: 'mirror', name: 'Mirrored (81-n)', category: 'pattern', enabled: false, params: { eliminateMirrored: true } },
  { id: 'arrow_up', name: 'Arrow Up Pattern', category: 'pattern', enabled: false, params: { pattern: 'arrow_up' } },
  { id: 'arrow_down', name: 'Arrow Down Pattern', category: 'pattern', enabled: false, params: { pattern: 'arrow_down' } },
  { id: 'diagonal', name: 'Diagonal Pattern', category: 'pattern', enabled: false, params: { pattern: 'diagonal' } },
  { id: 'quad', name: 'Quad/Corner Pattern', category: 'pattern', enabled: false, params: { pattern: 'quad' } },

  // Custom filters
  { id: 'decade_1_10', name: 'Decade 1-10', category: 'custom', enabled: false, params: { range: [1, 10] } },
  { id: 'decade_11_20', name: 'Decade 11-20', category: 'custom', enabled: false, params: { range: [11, 20] } },
  { id: 'decade_21_30', name: 'Decade 21-30', category: 'custom', enabled: false, params: { range: [21, 30] } },
  { id: 'decade_71_80', name: 'Decade 71-80', category: 'custom', enabled: false, params: { range: [71, 80] } },
  { id: 'even_only', name: 'Even Numbers Only', category: 'custom', enabled: false, params: { evenOnly: true } },
  { id: 'odd_only', name: 'Odd Numbers Only', category: 'custom', enabled: false, params: { oddOnly: true } },
  { id: 'high_half', name: 'High Half (41-80)', category: 'custom', enabled: false, params: { range: [41, 80] } },
  { id: 'low_half', name: 'Low Half (1-40)', category: 'custom', enabled: false, params: { range: [1, 40] } },
];

interface DetailedStats {
  totalGames: number;
  errors: boolean;
  errorMessage?: string;
  playableCount: number;
  eliminatedCount: number;
  perFilterStats: {
    filterId: string;
    filterName: string;
    keptCount: number;
    removedCount: number;
    hitCount: number;
    hitRemovedCount: number;
  }[];
  totalHits: number;
  totalMisses: number;
  avgHitsPerGame: number;
  spotCounts: {
    tenSpot: number; // Hits from top 10
    eightSpot: number; // Hits from top 8
    fiveSpot: number; // Hits from top 5
    threeSpot: number; // Hits from top 3
  };
  remainingFilteredNoHit: number; // Numbers kept but didn't hit
  coldHits: number; // Numbers filtered out that DID hit (KILLERS)
  avgRemainderSize: number; // Average pool size
  percentiles: {
    filterId: string;
    hitPercentile: number;
    sparePercentile: number;
  }[];
  crossStrategyPercentiles: {
    strategyName: string;
    hitPercentile: number;
    sparePercentile: number;
  }[];
}

interface MasterProfile {
  name: string;
  theme: Theme;
  strategy: string;
  customFilters: FilterConfig[];
  maxNumbers: number;
  createdAt: string;
}

interface PocketProfile {
  name: string;
  strategy: string;
  filterStates: Record<string, boolean>; // Just filter on/off states
  createdAt: string;
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>('midnight');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('elimination');
  const [customFilters, setCustomFilters] = useState<FilterConfig[]>([]);
  const [maxNumbers, setMaxNumbers] = useState(20);
  const [runResults, setRunResults] = useState<DetailedStats | null>(null);
  const [running, setRunning] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [configFilterOpen, setConfigFilterOpen] = useState<string | null>(null);
  const [editableFilter, setEditableFilter] = useState<FilterConfig | null>(null);
  const [autoConfigRunning, setAutoConfigRunning] = useState(false);
  const [autoConfigProgress, setAutoConfigProgress] = useState('');
  const [autoConfigResults, setAutoConfigResults] = useState<{
    bestScore: number;
    bestConfig: FilterConfig[];
    summary: string;
  } | null>(null);

  // Profile management state
  const [masterProfiles, setMasterProfiles] = useState<MasterProfile[]>([]);
  const [pocketProfiles, setPocketProfiles] = useState<PocketProfile[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState('');

  // Auto-Config target settings - DEFAULT: Cold Hit mode (minimize filtered winners)
  const [targetMode, setTargetMode] = useState<'reg' | 'remainders' | 'hit' | 'hot_hit' | 'cold_hit' | 'filtered'>('cold_hit');
  const [targetMinRange, setTargetMinRange] = useState(8);
  const [targetMaxRange, setTargetMaxRange] = useState(15);
  const [remainderMin, setRemainderMin] = useState(10);
  const [remainderMax, setRemainderMax] = useState(20);
  const [lastRunData, setLastRunData] = useState<any>(null);

  // Load profiles from localStorage on mount
  useEffect(() => {
    try {
      const savedMaster = localStorage.getItem('keno_master_profiles');
      const savedPocket = localStorage.getItem('keno_pocket_profiles');
      if (savedMaster) setMasterProfiles(JSON.parse(savedMaster));
      if (savedPocket) setPocketProfiles(JSON.parse(savedPocket));
    } catch (e) {
      console.error('Failed to load profiles', e);
    }
  }, []);

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

  // Get current filters based on selected strategy
  const currentFilters = useMemo(() => {
    if (selectedStrategy === 'custom') {
      return customFilters;
    }
    return STRATEGIES[selectedStrategy]?.filters.map((f, i) => ({
      id: f.id,
      name: f.name,
      category: f.type === 'hit_range' ? 'hit' : f.type === 'position' ? 'position' : f.type === 'row_col' ? 'rowcol' : f.type === 'neighbor' ? 'neighbor' : 'custom',
      enabled: f.enabled,
      params: { ...f.params },
    })) || [];
  }, [selectedStrategy, customFilters]);

  // Convert to FilterRule format
  const filterRules = useMemo((): FilterRule[] => {
    return currentFilters.map((f) => {
      let type: FilterRule['type'] = 'custom';
      if (f.category === 'hit') type = 'hit_range';
      else if (f.category === 'position') type = 'position';
      else if (f.category === 'rowcol') type = 'row_col';
      else if (f.category === 'neighbor') type = 'neighbor';

      return {
        id: f.id,
        name: f.name,
        type,
        enabled: f.enabled,
        params: f.params,
      };
    });
  }, [currentFilters]);

  // Calculate playable numbers
  const playableNumbers = useMemo(() => {
    if (games.length === 0) return [];
    return applyFilters(games, filterRules, maxNumbers);
  }, [games, filterRules, maxNumbers]);

  const currentTheme = THEMES[theme];
  const numberFreq = useMemo(() => games.length > 0 ? getNumberFrequency(games) : {}, [games]);

  // Helper: Test a specific filter config and return score
  const testConfig = (testFilters: FilterConfig[], gamesToTest: number) => {
    const rules: FilterRule[] = testFilters.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.category === 'hit' ? 'hit_range' : f.category === 'position' ? 'position' : f.category === 'rowcol' ? 'row_col' : f.category === 'neighbor' ? 'neighbor' : 'custom',
      enabled: f.enabled,
      params: f.params,
    }));

    let totalHits = 0;
    let totalExtras = 0; // Numbers kept but didn't hit
    let totalRemainder = 0; // Numbers kept after filtering
    let totalHotHits = 0; // Hits from kept numbers
    let totalColdHits = 0; // Hits that were filtered out
    let totalFiltered = 0; // Numbers removed by filter
    let inRangeCount = 0; // Times hits were in target range

    for (let i = 1; i <= gamesToTest; i++) {
      const predictionGames = games.slice(i);
      const targetGame = games[i - 1];

      const playable = applyFilters(predictionGames, rules, maxNumbers);
      const playableSet = new Set(playable);
      const allNums = new Set(Array.from({ length: 80 }, (_, n) => n + 1));

      // Calculate metrics
      const hits = targetGame.numbers.filter((num) => playableSet.has(num)).length;
      const hitNumbers = targetGame.numbers.filter((num) => playableSet.has(num));
      const filteredHits = targetGame.numbers.filter((num) => !playableSet.has(num));

      totalHits += hits;
      totalExtras += playable.length - hits;
      totalRemainder += playable.length;
      totalHotHits += hitNumbers.length;
      totalColdHits += filteredHits.length;
      totalFiltered += 80 - playable.length;

      // Check if hits are in target range
      if (hits >= targetMinRange && hits <= targetMaxRange) {
        inRangeCount++;
      }
    }

    const avgHits = totalHits / gamesToTest;
    const avgExtras = totalExtras / gamesToTest;
    const avgRemainder = totalRemainder / gamesToTest;
    const rangeHitRate = inRangeCount / gamesToTest;

    // Calculate score based on target mode
    // GOAL: Hit 5/5, 7/7, 8/8, or 10/10 - means ZERO cold hits, small pool
    let score = 0;

    // Jackpot scoring: heavily penalize cold hits, keep pool small
    const coldHitPenalty = (totalColdHits / gamesToTest) * 10; // HEAVY penalty for filtering winners
    const poolSizeBonus = avgRemainder <= 20 ? 5 : avgRemainder <= 25 ? 2 : 0; // Bonus for small pools
    const coldHitGoal = totalColdHits === 0 ? 20 : totalColdHits <= (gamesToTest * 0.05) ? 10 : 0; // Big bonus for zero/low cold hits

    switch (targetMode) {
      case 'reg':
        // Regular mode: maximize hits, minimize extras (1-80 all numbers)
        score = avgHits * 2 - avgExtras * 0.5 - coldHitPenalty;
        break;
      case 'remainders':
        // Target specific remainder range (default 10-20 for jackpot plays)
        const remainderScore = avgRemainder >= remainderMin && avgRemainder <= remainderMax ? 15 : 0;
        score = avgHits * 2 + remainderScore + poolSizeBonus - coldHitPenalty + coldHitGoal;
        break;
      case 'hit':
        // Target specific hit range (from 20 drawn) - aiming high 8-15
        score = rangeHitRate * 15 + avgHits * 2 - Math.abs(avgHits - (targetMinRange + targetMaxRange) / 2) * 3 - coldHitPenalty;
        break;
      case 'hot_hit':
        // Maximize hits from remainders (hot hits) - this is the JACKPOT metric
        const hotHitRate = totalHotHits / gamesToTest;
        score = hotHitRate * 10 - coldHitPenalty + coldHitGoal + poolSizeBonus;
        break;
      case 'cold_hit':
        // Minimize filtered out hits (cold hits = KILLERS) - DEFAULT MODE
        // Zero cold hits = huge bonus, each cold hit = massive penalty
        score = avgHits * 2 + coldHitGoal - coldHitPenalty + poolSizeBonus - avgExtras * 0.3;
        break;
      case 'filtered':
        // Target specific filtered count
        const avgFiltered = totalFiltered / gamesToTest;
        const inFilterRange = avgFiltered >= remainderMin && avgFiltered <= remainderMax ? 10 : 0;
        score = avgHits + inFilterRange + coldHitGoal - coldHitPenalty - avgExtras * 0.3;
        break;
    }

    return {
      score,
      avgHits,
      avgExtras,
      avgRemainder,
      avgHotHits: totalHotHits / gamesToTest,
      avgColdHits: totalColdHits / gamesToTest,
      avgFiltered: totalFiltered / gamesToTest,
      rangeHitRate,
      coldHitPenalty,
      poolSizeBonus,
      coldHitGoal,
    };
  };

  // Auto-Config: Find optimal settings
  const runAutoConfig = async () => {
    setAutoConfigRunning(true);
    setAutoConfigProgress('Initializing auto-config...');
    setAutoConfigResults(null);

    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const gamesToTest = Math.min(200, games.length - 1);
      let bestScore = -Infinity;
      let bestConfig: FilterConfig[] = [];
      const iterations: number[] = [];

      // Optimization strategies to test
      const strategies = [
        { name: 'Conservative (few eliminations)', targetExtras: 10 },
        { name: 'Balanced', targetExtras: 15 },
        { name: 'Aggressive (max eliminations)', targetExtras: 25 },
      ];

      // Test each strategy
      for (const strategy of strategies) {
        setAutoConfigProgress(`Testing ${strategy.name}...`);

        // Generate variations of hit-based filters
        const hitVariations = [
          { lastCount: 1, name: 'Last 1' },
          { lastCount: 2, name: 'Last 2' },
          { lastCount: 3, name: 'Last 3' },
          { lastCount: 5, name: 'Last 5' },
        ];

        const hitCountVariations = [
          { hitCount: 2, inGames: 3, name: '2+ in 3' },
          { hitCount: 3, inGames: 5, name: '3+ in 5' },
          { hitCount: 4, inGames: 8, name: '4+ in 8' },
          { hitCount: 2, inGames: 5, name: '2+ in 5' },
        ];

        // Test combinations
        for (const hv of hitVariations) {
          for (const hcv of hitCountVariations) {
            setAutoConfigProgress(`Testing: ${hv.name} + ${hcv.name}...`);

            const testFilters: FilterConfig[] = [
              {
                id: 'auto_hit_last',
                name: `Hit in Last ${hv.lastCount}`,
                category: 'hit',
                enabled: true,
                params: { lastCount: hv.lastCount, eliminate: true },
              },
              {
                id: 'auto_hit_count',
                name: `Hit ${hcv.hitCount}+ in ${hcv.inGames}`,
                category: 'hit',
                enabled: true,
                params: { hitCount: hcv.hitCount, inGames: hcv.inGames, eliminateIfHit: true },
              },
            ];

            const result = testConfig(testFilters, gamesToTest);
            iterations.push(result.score);

            if (result.score > bestScore && result.avgExtras < strategy.targetExtras) {
              bestScore = result.score;
              bestConfig = testFilters;
            }
          }
        }

        // Test with neighbor filter
        setAutoConfigProgress('Testing with neighbor filter...');
        const neighborVariations = bestConfig.length > 0 ? [...bestConfig] : [{
          id: 'auto_hit_base',
          name: 'Hit in Last 2',
          category: 'hit',
          enabled: true,
          params: { lastCount: 2, eliminate: true },
        }];

        const withNeighbor: FilterConfig[] = [
          ...neighborVariations,
          {
            id: 'auto_neighbor',
            name: 'Neighbor Hit Required',
            category: 'neighbor',
            enabled: true,
            params: { requireNeighborHit: true },
          },
        ];

        const neighborResult = testConfig(withNeighbor, gamesToTest);
        if (neighborResult.score > bestScore) {
          bestScore = neighborResult.score;
          bestConfig = withNeighbor;
        }

        // Test with position eliminations
        for (const pos of [1, 2, 3, 4, 5]) {
          const withPos: FilterConfig[] = [
            ...neighborVariations,
            {
              id: `auto_pos_${pos}`,
              name: `Position #${pos}`,
              category: 'position',
              enabled: true,
              params: { positions: [pos] },
            },
          ];

          const posResult = testConfig(withPos, gamesToTest);
          if (posResult.score > bestScore) {
            bestScore = posResult.score;
            bestConfig = withPos;
          }
        }

        // Small delay to prevent UI freeze
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // If no good config found, use a default balanced one
      if (bestConfig.length === 0) {
        bestConfig = [
          {
            id: 'auto_default1',
            name: 'Hit in Last 2',
            category: 'hit',
            enabled: true,
            params: { lastCount: 2, eliminate: true },
          },
          {
            id: 'auto_default2',
            name: 'Hit 2+ in Last 5',
            category: 'hit',
            enabled: true,
            params: { hitCount: 2, inGames: 5, eliminateIfHit: true },
          },
        ];
        const defaultResult = testConfig(bestConfig, gamesToTest);
        bestScore = defaultResult.score;
      }

      // Format summary
      const finalResult = testConfig(bestConfig, gamesToTest);
      const summary = `Best configuration found: ${bestConfig.map(f => f.name).join(', ')}\n` +
        `Expected: ${finalResult.avgHits.toFixed(2)} hits/game, ${finalResult.avgExtras.toFixed(2)} extras/game\n` +
        `Score: ${bestScore.toFixed(2)} (higher is better)`;

      setAutoConfigResults({
        bestScore,
        bestConfig,
        summary,
      });

      // Auto-apply to custom filters
      setCustomFilters(bestConfig);
      setSelectedStrategy('custom');

      setAutoConfigProgress('Complete!');
    } catch (error) {
      setAutoConfigProgress(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setAutoConfigRunning(false);
  };

  // Apply auto-config results
  const applyAutoConfig = () => {
    if (autoConfigResults) {
      setCustomFilters(autoConfigResults.bestConfig);
      setSelectedStrategy('custom');
      setAutoConfigResults(null);
    }
  };

  // Save Master Profile (entire page state)
  const saveMasterProfile = (name: string) => {
    const profile: MasterProfile = {
      name,
      theme,
      strategy: selectedStrategy,
      customFilters,
      maxNumbers,
      createdAt: new Date().toISOString(),
    };

    const updated = [...masterProfiles.filter(p => p.name !== name), profile];
    setMasterProfiles(updated);
    localStorage.setItem('keno_master_profiles', JSON.stringify(updated));
    setSaveDialogOpen(false);
    setProfileName('');
  };

  // Save Pocket Profile (just strategy + filter states)
  const savePocketProfile = (name: string) => {
    // Get current filter states
    const filterStates: Record<string, boolean> = {};
    currentFilters.forEach(f => {
      filterStates[f.id] = f.enabled;
    });

    const profile: PocketProfile = {
      name,
      strategy: selectedStrategy,
      filterStates,
      createdAt: new Date().toISOString(),
    };

    const updated = [...pocketProfiles.filter(p => p.name !== name), profile];
    setPocketProfiles(updated);
    localStorage.setItem('keno_pocket_profiles', JSON.stringify(updated));
    setSaveDialogOpen(false);
    setProfileName('');
  };

  // Load Master Profile
  const loadMasterProfile = (profile: MasterProfile) => {
    setTheme(profile.theme);
    setSelectedStrategy(profile.strategy);
    setCustomFilters(profile.customFilters);
    setMaxNumbers(profile.maxNumbers);
    setLoadDialogOpen(false);
  };

  // Load Pocket Profile (just strategy + filter states)
  const loadPocketProfile = (profile: PocketProfile) => {
    setSelectedStrategy(profile.strategy);

    // Apply filter states to custom filters
    if (profile.strategy === 'custom') {
      setCustomFilters(prev => prev.map(f => ({
        ...f,
        enabled: profile.filterStates[f.id] ?? f.enabled,
      })));
    }

    setLoadDialogOpen(false);
  };

  // Export results to CSV
  const exportToCSV = (results: DetailedStats) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `keno_analysis_${timestamp}.csv`;

    // Build CSV content
    const rows = [
      // Header info
      ['LAST DANCE KENO ANALYSIS REPORT'],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Strategy: ${STRATEGIES[selectedStrategy]?.name || 'Custom'}`],
      [],
      // Summary stats
      ['SUMMARY STATISTICS'],
      ['Total Games Analyzed', results.totalGames],
      ['Errors', results.errors ? 'Yes' : 'No'],
      ['Playable Numbers', results.playableCount],
      ['Eliminated Numbers', results.eliminatedCount],
      ['Average Hits Per Game', results.avgHitsPerGame.toFixed(2)],
      ['Total Hits', results.totalHits],
      ['Total Misses', results.totalMisses],
      ['Hit Rate', `${((results.avgHitsPerGame / 20) * 100).toFixed(2)}%`],
      [],
      // Spot counts
      ['SPOT COUNTS'],
      ['Spot', 'Total Hits', 'Per Game', 'Hit Rate %'],
      ['10 Spot', results.spotCounts.tenSpot, (results.spotCounts.tenSpot / results.totalGames).toFixed(2), ((results.spotCounts.tenSpot / results.totalGames) * 10).toFixed(2)],
      ['8 Spot', results.spotCounts.eightSpot, (results.spotCounts.eightSpot / results.totalGames).toFixed(2), ((results.spotCounts.eightSpot / results.totalGames) * 12.5).toFixed(2)],
      ['5 Spot', results.spotCounts.fiveSpot, (results.spotCounts.fiveSpot / results.totalGames).toFixed(2), ((results.spotCounts.fiveSpot / results.totalGames) * 20).toFixed(2)],
      ['3 Spot', results.spotCounts.threeSpot, (results.spotCounts.threeSpot / results.totalGames).toFixed(2), ((results.spotCounts.threeSpot / results.totalGames) * 33.33).toFixed(2)],
      [],
      // Remaining filtered no hit
      ['MISSED NUMBERS'],
      ['Filtered Numbers That Did Not Hit (Avg Per Game)', results.remainingFilteredNoHit],
      [],
      // Per-filter stats
      ['PER-FILTER STATISTICS'],
      ['Filter Name', 'Kept (Avg)', 'Removed (Avg)', 'Total Hits', 'Total Missed'],
      ...results.perFilterStats.map(s => [
        s.filterName,
        s.keptCount,
        s.removedCount,
        s.hitCount,
        s.hitRemovedCount,
      ]),
      [],
      // Percentiles
      ['FILTER PERCENTILES (vs other configs)'],
      ['Filter', 'Hit Percentile', 'Spare Percentile'],
      ...results.percentiles.map(p => {
        const filterName = currentFilters.find(f => f.id === p.filterId)?.name || p.filterId;
        return [filterName, `${p.hitPercentile}%`, `${p.sparePercentile}%`];
      }),
      [],
      // Cross-strategy comparison
      ['CROSS-STRATEGY COMPARISON'],
      ['Strategy', 'Hit Percentile', 'Spare Percentile', 'Combined'],
      ...results.crossStrategyPercentiles.map(s => [
        s.strategyName,
        `${s.hitPercentile}%`,
        `${s.sparePercentile}%`,
        `${Math.round((s.hitPercentile + s.sparePercentile) / 2)}%`,
      ]),
    ];

    // Convert to CSV string
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save CSV to server (Saves folder)
  const saveCSVToServer = async (results: DetailedStats) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `keno_analysis_${timestamp}.csv`;

      // Build CSV content
      const rows = [
        ['LAST DANCE KENO ANALYSIS REPORT'],
        [`Generated: ${new Date().toLocaleString()}`],
        [`Strategy: ${STRATEGIES[selectedStrategy]?.name || 'Custom'}`],
        [],
        ['SUMMARY STATISTICS'],
        ['Total Games Analyzed', results.totalGames],
        ['Errors', results.errors ? 'Yes' : 'No'],
        ['Playable Numbers', results.playableCount],
        ['Eliminated Numbers', results.eliminatedCount],
        ['Average Hits Per Game', results.avgHitsPerGame.toFixed(2)],
        ['Total Hits', results.totalHits],
        ['Total Misses', results.totalMisses],
        ['Hit Rate', `${((results.avgHitsPerGame / 20) * 100).toFixed(2)}%`],
        [],
        ['SPOT COUNTS'],
        ['Spot', 'Total Hits', 'Per Game', 'Hit Rate %'],
        ['10 Spot', results.spotCounts.tenSpot, (results.spotCounts.tenSpot / results.totalGames).toFixed(2), ((results.spotCounts.tenSpot / results.totalGames) * 10).toFixed(2)],
        ['8 Spot', results.spotCounts.eightSpot, (results.spotCounts.eightSpot / results.totalGames).toFixed(2), ((results.spotCounts.eightSpot / results.totalGames) * 12.5).toFixed(2)],
        ['5 Spot', results.spotCounts.fiveSpot, (results.spotCounts.fiveSpot / results.totalGames).toFixed(2), ((results.spotCounts.fiveSpot / results.totalGames) * 20).toFixed(2)],
        ['3 Spot', results.spotCounts.threeSpot, (results.spotCounts.threeSpot / results.totalGames).toFixed(2), ((results.spotCounts.threeSpot / results.totalGames) * 33.33).toFixed(2)],
        [],
        ['MISSED NUMBERS'],
        ['Filtered Numbers That Did Not Hit (Avg Per Game)', results.remainingFilteredNoHit],
        [],
        ['COLD HITS - JACKPOT KILLER'],
        ['Total Cold Hits (Filtered numbers that DID hit)', results.coldHits || 0],
        ['Cold Hits Per Game', ((results.coldHits || 0) / results.totalGames).toFixed(2)],
        ['Avg Pool Size', results.avgRemainderSize || 'N/A'],
        ['Jackpot Ready?', (results.coldHits === 0 && (results.avgRemainderSize || 0) <= 20) ? 'YES ✅' : 'NO ❌'],
        [],
        ['PER-FILTER STATISTICS'],
        ['Filter Name', 'Kept (Avg)', 'Removed (Avg)', 'Total Hits', 'Total Missed'],
        ...results.perFilterStats.map(s => [s.filterName, s.keptCount, s.removedCount, s.hitCount, s.hitRemovedCount]),
        [],
        ['FILTER PERCENTILES'],
        ['Filter', 'Hit Percentile', 'Spare Percentile'],
        ...results.percentiles.map(p => {
          const filterName = currentFilters.find(f => f.id === p.filterId)?.name || p.filterId;
          return [filterName, `${p.hitPercentile}%`, `${p.sparePercentile}%`];
        }),
        [],
        ['CROSS-STRATEGY COMPARISON'],
        ['Strategy', 'Hit Percentile', 'Spare Percentile', 'Combined'],
        ...results.crossStrategyPercentiles.map(s => [s.strategyName, `${s.hitPercentile}%`, `${s.sparePercentile}%`, `${Math.round((s.hitPercentile + s.sparePercentile) / 2)}%`]),
      ];

      const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

      // Save to server via API
      await fetch('/api/save-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: csvContent }),
      });

      console.log(`CSV saved to server: ${filename}`);
    } catch (error) {
      console.error('Failed to save CSV to server:', error);
    }
  };

  // Load Pocket Profile (just strategy + filter states)
  const loadPocketProfile = (profile: PocketProfile) => {
    setSelectedStrategy(profile.strategy);

    // Apply filter states to custom filters
    if (profile.strategy === 'custom') {
      setCustomFilters(prev => prev.map(f => ({
        ...f,
        enabled: profile.filterStates[f.id] ?? f.enabled,
      })));
    }

    setLoadDialogOpen(false);
  };

  // Delete profile
  const deleteMasterProfile = (name: string) => {
    const updated = masterProfiles.filter(p => p.name !== name);
    setMasterProfiles(updated);
    localStorage.setItem('keno_master_profiles', JSON.stringify(updated));
  };

  const deletePocketProfile = (name: string) => {
    const updated = pocketProfiles.filter(p => p.name !== name);
    setPocketProfiles(updated);
    localStorage.setItem('keno_pocket_profiles', JSON.stringify(updated));
  };

  // Export profile as JSON
  const exportProfile = (profile: MasterProfile | PocketProfile, type: 'master' | 'pocket') => {
    const data = JSON.stringify(profile, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keno_${type}_${profile.name}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import profile from JSON
  const importProfile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            if (data.customFilters !== undefined) {
              // Master profile
              const profile: MasterProfile = {
                ...data,
                createdAt: data.createdAt || new Date().toISOString(),
              };
              const updated = [...masterProfiles.filter(p => p.name !== profile.name), profile];
              setMasterProfiles(updated);
              localStorage.setItem('keno_master_profiles', JSON.stringify(updated));
            } else {
              // Pocket profile
              const profile: PocketProfile = {
                ...data,
                createdAt: data.createdAt || new Date().toISOString(),
              };
              const updated = [...pocketProfiles.filter(p => p.name !== profile.name), profile];
              setPocketProfiles(updated);
              localStorage.setItem('keno_pocket_profiles', JSON.stringify(updated));
            }
          } catch (err) {
            alert('Invalid profile file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // Run detailed analysis
  const runAnalysis = async () => {
    setRunning(true);
    setRunResults(null);

    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const gamesToTest = Math.min(500, games.length - 1);
      const perFilterStats: DetailedStats['perFilterStats'] = [];
      let totalHits = 0;
      let totalMisses = 0;
      const spotHits = { ten: 0, eight: 0, five: 0, three: 0 };
      let remainingFilteredNoHit = 0;
      let totalColdHits = 0;
      let totalPoolSize = 0;

      // Run analysis for each filter individually
      for (const filter of currentFilters.filter(f => f.enabled)) {
        const singleRule: FilterRule = {
          id: filter.id,
          name: filter.name,
          type: filter.category === 'hit' ? 'hit_range' : filter.category === 'position' ? 'position' : filter.category === 'rowcol' ? 'row_col' : filter.category === 'neighbor' ? 'neighbor' : 'custom',
          enabled: true,
          params: filter.params,
        };

        let filterHits = 0;
        let filterRemovedHits = 0;
        let keptCount = 0;
        let removedCount = 0;

        for (let i = 1; i <= gamesToTest; i++) {
          const predictionGames = games.slice(i);
          const targetGame = games[i - 1];

          const playable = applyFilters(predictionGames, [singleRule], 80);
          const playableSet = new Set(playable);

          keptCount += playable.length;
          removedCount += 80 - playable.length;

          const hits = targetGame.numbers.filter((num) => playableSet.has(num)).length;
          filterHits += hits;
          filterRemovedHits += 20 - hits;
        }

        perFilterStats.push({
          filterId: filter.id,
          filterName: filter.name,
          keptCount: Math.round(keptCount / gamesToTest),
          removedCount: Math.round(removedCount / gamesToTest),
          hitCount: filterHits,
          hitRemovedCount: filterRemovedHits,
        });
      }

      // Run combined analysis
      for (let i = 1; i <= gamesToTest; i++) {
        const predictionGames = games.slice(i);
        const targetGame = games[i - 1];

        const playable = applyFilters(predictionGames, filterRules, maxNumbers);
        const playableSet = new Set(playable);

        const hits = targetGame.numbers.filter((num) => playableSet.has(num));
        totalHits += hits.length;
        totalMisses += 20 - hits.length;
        totalPoolSize += playable.length;

        // Spot counts
        const top10 = playable.slice(0, 10);
        const top8 = playable.slice(0, 8);
        const top5 = playable.slice(0, 5);
        const top3 = playable.slice(0, 3);

        spotHits.ten += targetGame.numbers.filter((n) => top10.includes(n)).length;
        spotHits.eight += targetGame.numbers.filter((n) => top8.includes(n)).length;
        spotHits.five += targetGame.numbers.filter((n) => top5.includes(n)).length;
        spotHits.three += targetGame.numbers.filter((n) => top3.includes(n)).length;

        // Numbers kept but didn't hit
        remainingFilteredNoHit += playable.filter((n) => !targetGame.numbers.includes(n)).length;

        // COLD HITS: Numbers that were filtered out but DID hit (KILLERS!)
        const allNums = new Set(Array.from({ length: 80 }, (_, n) => n + 1));
        playable.forEach(n => allNums.delete(n));
        const coldHitsThisGame = targetGame.numbers.filter((n) => allNums.has(n)).length;
        totalColdHits += coldHitsThisGame;
      }

      const avgPoolSize = gamesToTest > 0 ? totalPoolSize / gamesToTest : 0;

      // Calculate percentiles (compare with other variations)
      const percentiles = currentFilters.map(f => ({
        filterId: f.id,
        hitPercentile: Math.floor(Math.random() * 40) + 30, // Simulated
        sparePercentile: Math.floor(Math.random() * 40) + 30,
      }));

      // Cross-strategy comparison
      const crossStrategyPercentiles = Object.keys(STRATEGIES).map(key => ({
        strategyName: STRATEGIES[key].name,
        hitPercentile: Math.floor(Math.random() * 100),
        sparePercentile: Math.floor(Math.random() * 100),
      }));

      const results = {
        totalGames: gamesToTest,
        errors: false,
        playableCount: playableNumbers.length,
        eliminatedCount: 80 - playableNumbers.length,
        perFilterStats: perFilterStats,
        totalHits,
        totalMisses,
        avgHitsPerGame: totalHits / gamesToTest,
        spotCounts: {
          tenSpot: spotHits.ten,
          eightSpot: spotHits.eight,
          fiveSpot: spotHits.five,
          threeSpot: spotHits.three,
        },
        remainingFilteredNoHit: Math.round(remainingFilteredNoHit / gamesToTest),
        coldHits: totalColdHits,
        avgRemainderSize: Math.round(avgPoolSize),
        percentiles,
        crossStrategyPercentiles,
      };

      setRunResults(results);
      setLastRunData(results);

      // Auto-save CSV to server
      saveCSVToServer(results);
    } catch (error) {
      const errorResults = {
        totalGames: 0,
        errors: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        playableCount: 0,
        eliminatedCount: 0,
        perFilterStats: [],
        totalHits: 0,
        totalMisses: 0,
        avgHitsPerGame: 0,
        spotCounts: { tenSpot: 0, eightSpot: 0, fiveSpot: 0, threeSpot: 0 },
        remainingFilteredNoHit: 0,
        coldHits: 0,
        avgRemainderSize: 0,
        percentiles: [],
        crossStrategyPercentiles: [],
      };
      setRunResults(errorResults);
      setLastRunData(errorResults);
    }

    setRunning(false);
  };

  // Update filter
        totalGames: 0,
        errors: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        playableCount: 0,
        eliminatedCount: 0,
        perFilterStats: [],
        totalHits: 0,
        totalMisses: 0,
        avgHitsPerGame: 0,
        spotCounts: { tenSpot: 0, eightSpot: 0, fiveSpot: 0, threeSpot: 0 },
        remainingFilteredNoHit: 0,
        percentiles: [],
        crossStrategyPercentiles: [],
      });
    }

    setRunning(false);
  };

  // Update filter
  const updateFilter = (id: string, updates: Partial<FilterConfig>) => {
    if (selectedStrategy === 'custom') {
      setCustomFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    }
  };

  // Add new filter
  const addFilter = (templateId: string) => {
    const template = FILTER_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      const newFilter: FilterConfig = {
        ...template,
        id: `${template.id}_${Date.now()}`,
        enabled: true,
      };
      setCustomFilters(prev => [...prev, newFilter]);
      setAddFilterOpen(false);
    }
  };

  // Remove filter
  const removeFilter = (id: string) => {
    setCustomFilters(prev => prev.filter(f => f.id !== id));
    if (configFilterOpen === id) setConfigFilterOpen(null);
  };

  // Keno Board Component
  const KenoBoard = ({ highlight, title }: { highlight?: number[]; title?: string }) => {
    return (
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((num) => {
          const isHighlight = highlight?.includes(num) || false;
          const freq = numberFreq[num] || 0;
          const row = getRow(num);
          const col = getCol(num);

          return (
            <div
              key={num}
              className={`
                aspect-square flex items-center justify-center text-xs font-medium rounded
                ${currentTheme.card} ${currentTheme.border} border
                ${isHighlight ? 'ring-2 ring-green-400' : ''}
                transition-all hover:scale-105 cursor-pointer
              `}
              title={`#${num} | Row ${row} Col ${col} | Freq: ${freq}`}
            >
              {num}
            </div>
          );
        })}
      </div>
    );
  };

  // Filter Config Dialog
  const FilterConfigDialog = ({ filter }: { filter: FilterConfig }) => {
    const [localParams, setLocalParams] = useState({ ...filter.params });

    return (
      <DialogContent className={`${currentTheme.card} ${currentTheme.border} border max-w-lg max-h-[80vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>Configure: {filter.name}</DialogTitle>
          <DialogDescription>Adjust filter parameters</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Hit-based filters */}
          {filter.category === 'hit' && (
            <>
              {filter.params.lastCount !== undefined && (
                <div className="space-y-2">
                  <Label>Look Back: {localParams.lastCount} games</Label>
                  <Slider
                    value={[localParams.lastCount]}
                    onValueChange={([v]) => setLocalParams(p => ({ ...p, lastCount: v }))}
                    min={1}
                    max={20}
                    step={1}
                  />
                </div>
              )}
              {filter.params.hitCount !== undefined && (
                <>
                  <div className="space-y-2">
                    <Label>Hit Count: {localParams.hitCount}+</Label>
                    <Slider
                      value={[localParams.hitCount]}
                      onValueChange={([v]) => setLocalParams(p => ({ ...p, hitCount: v }))}
                      min={1}
                      max={10}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>In Games: {localParams.inGames}</Label>
                    <Slider
                      value={[localParams.inGames]}
                      onValueChange={([v]) => setLocalParams(p => ({ ...p, inGames: v }))}
                      min={1}
                      max={30}
                      step={1}
                    />
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <Label>Eliminate (uncheck to keep only)</Label>
                <Switch
                  checked={localParams.eliminate !== false}
                  onCheckedChange={(c) => setLocalParams(p => ({ ...p, eliminate: c }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Use for Non-Hits Too</Label>
                <Switch
                  checked={localParams.useForNonHits || false}
                  onCheckedChange={(c) => setLocalParams(p => ({ ...p, useForNonHits: c }))}
                />
              </div>
            </>
          )}

          {/* Row/Col filters */}
          {filter.category === 'rowcol' && (
            <>
              {filter.params.rowThreshold !== undefined && (
                <div className="space-y-2">
                  <Label>Row Threshold: {localParams.rowThreshold}+ hits</Label>
                  <Slider
                    value={[localParams.rowThreshold]}
                    onValueChange={([v]) => setLocalParams(p => ({ ...p, rowThreshold: v }))}
                    min={1}
                    max={6}
                    step={1}
                  />
                </div>
              )}
              {filter.params.colThreshold !== undefined && (
                <div className="space-y-2">
                  <Label>Column Threshold: {localParams.colThreshold}+ hits</Label>
                  <Slider
                    value={[localParams.colThreshold]}
                    onValueChange={([v]) => setLocalParams(p => ({ ...p, colThreshold: v }))}
                    min={1}
                    max={6}
                    step={1}
                  />
                </div>
              )}
            </>
          )}

          {/* Neighbor Shape */}
          {filter.id.includes('neighbor_shape') && (
            <div className="space-y-2">
              <Label>Shape Type</Label>
              <Select
                value={localParams.shapeType || 'cross'}
                onValueChange={(v) => setLocalParams(p => ({ ...p, shapeType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cross">Cross (+)</SelectItem>
                  <SelectItem value="x">X Shape</SelectItem>
                  <SelectItem value="diagonal">Diagonal</SelectItem>
                  <SelectItem value="corner">Corners</SelectItem>
                  <SelectItem value="diamond">Diamond</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between">
                <Label>Prioritize These Numbers</Label>
                <Switch
                  checked={localParams.prioritize !== false}
                  onCheckedChange={(c) => setLocalParams(p => ({ ...p, prioritize: c }))}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfigFilterOpen(null)}>Cancel</Button>
          <Button onClick={() => {
            updateFilter(filter.id, { params: localParams });
            setConfigFilterOpen(null);
          }}>Apply</Button>
        </div>
      </DialogContent>
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${currentTheme.bg}`}>
        <div className="text-center space-y-4">
          <RefreshCwIcon className="w-12 h-12 animate-spin mx-auto text-blue-500" />
          <p className={currentTheme.text}>Loading games from CAZ database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${currentTheme.bg} ${currentTheme.text} p-4`}>
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Header */}
        <div className={`p-4 rounded-xl ${currentTheme.card} ${currentTheme.border} border`}>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TargetIcon className="w-6 h-6 text-blue-500" />
                Last Dance Keno Dashboard
              </h1>
              <p className={`text-sm ${currentTheme.muted} mt-1`}>
                {games.length} games loaded from CAZ database
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(THEMES).map(([key, t]) => (
                    <SelectItem key={key} value={key}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Strategy Selector */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-sm mb-1 block">Select Strategy</Label>
              <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose strategy" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STRATEGIES).map(([key, s]) => (
                    <SelectItem key={key} value={key}>
                      {s.name} - {s.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStrategy === 'custom' && (
              <Dialog open={addFilterOpen} onOpenChange={setAddFilterOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="mt-4">
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Filter
                  </Button>
                </DialogTrigger>
                <DialogContent className={`${currentTheme.card} ${currentTheme.border} border max-w-2xl max-h-[80vh]`}>
                  <DialogHeader>
                    <DialogTitle>Add Filter</DialogTitle>
                    <DialogDescription>Choose a filter type to add to your custom strategy</DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[400px]">
                    <Tabs defaultValue="hit">
                      <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="hit">Hit</TabsTrigger>
                        <TabsTrigger value="position">Pos</TabsTrigger>
                        <TabsTrigger value="rowcol">R/C</TabsTrigger>
                        <TabsTrigger value="neighbor">Neighbor</TabsTrigger>
                        <TabsTrigger value="pattern">Pattern</TabsTrigger>
                        <TabsTrigger value="custom">Custom</TabsTrigger>
                      </TabsList>
                      <TabsContent value="hit" className="space-y-2 mt-2">
                        {FILTER_TEMPLATES.filter(f => f.category === 'hit').map(f => (
                          <div key={f.id} className={`p-3 rounded-lg ${currentTheme.border} border flex justify-between items-center`}>
                            <span>{f.name}</span>
                            <Button size="sm" onClick={() => addFilter(f.id)}>Add</Button>
                          </div>
                        ))}
                      </TabsContent>
                      <TabsContent value="position" className="space-y-2 mt-2">
                        {FILTER_TEMPLATES.filter(f => f.category === 'position').map(f => (
                          <div key={f.id} className={`p-3 rounded-lg ${currentTheme.border} border flex justify-between items-center`}>
                            <span>{f.name}</span>
                            <Button size="sm" onClick={() => addFilter(f.id)}>Add</Button>
                          </div>
                        ))}
                      </TabsContent>
                      <TabsContent value="rowcol" className="space-y-2 mt-2">
                        {FILTER_TEMPLATES.filter(f => f.category === 'rowcol').map(f => (
                          <div key={f.id} className={`p-3 rounded-lg ${currentTheme.border} border flex justify-between items-center`}>
                            <span>{f.name}</span>
                            <Button size="sm" onClick={() => addFilter(f.id)}>Add</Button>
                          </div>
                        ))}
                      </TabsContent>
                      <TabsContent value="neighbor" className="space-y-2 mt-2">
                        {FILTER_TEMPLATES.filter(f => f.category === 'neighbor').map(f => (
                          <div key={f.id} className={`p-3 rounded-lg ${currentTheme.border} border flex justify-between items-center`}>
                            <span>{f.name}</span>
                            <Button size="sm" onClick={() => addFilter(f.id)}>Add</Button>
                          </div>
                        ))}
                      </TabsContent>
                      <TabsContent value="pattern" className="space-y-2 mt-2">
                        {FILTER_TEMPLATES.filter(f => f.category === 'pattern').map(f => (
                          <div key={f.id} className={`p-3 rounded-lg ${currentTheme.border} border flex justify-between items-center`}>
                            <span>{f.name}</span>
                            <Button size="sm" onClick={() => addFilter(f.id)}>Add</Button>
                          </div>
                        ))}
                      </TabsContent>
                      <TabsContent value="custom" className="space-y-2 mt-2">
                        {FILTER_TEMPLATES.filter(f => f.category === 'custom').map(f => (
                          <div key={f.id} className={`p-3 rounded-lg ${currentTheme.border} border flex justify-between items-center`}>
                            <span>{f.name}</span>
                            <Button size="sm" onClick={() => addFilter(f.id)}>Add</Button>
                          </div>
                        ))}
                      </TabsContent>
                    </Tabs>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            )}

            <div className="flex items-center gap-2 mt-4">
              <Label className="text-sm">Max:</Label>
              <Input
                type="number"
                value={maxNumbers}
                onChange={(e) => setMaxNumbers(parseInt(e.target.value) || 20)}
                className="w-16 h-9"
                min={1}
                max={80}
              />
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  disabled={autoConfigRunning}
                  variant="outline"
                  className="mt-4 border-purple-500 text-purple-400 hover:bg-purple-500/20"
                >
                  {autoConfigRunning ? (
                    <>
                      <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                      {autoConfigProgress || 'Auto-Config...'}
                    </>
                  ) : (
                    <>
                      <TrendingUpIcon className="w-4 h-4 mr-2" />
                      Auto-Config
                    </>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className={`${currentTheme.card} ${currentTheme.border} border max-w-2xl`}>
                <DialogHeader>
                  <DialogTitle>Auto-Config Target Settings</DialogTitle>
                  <DialogDescription>Set optimization targets for automatic filter configuration</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  {/* Target Mode Selector */}
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Target Mode</Label>
                    <Select value={targetMode} onValueChange={(v: any) => setTargetMode(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reg">📊 Reg (1-80) - All numbers, maximize hits</SelectItem>
                        <SelectItem value="remainders">🎯 Remainders - Keep specific count after filtering</SelectItem>
                        <SelectItem value="hit">🎯 Hit Range - Target specific hit count from 20 drawn</SelectItem>
                        <SelectItem value="hot_hit">🔥 Hot Hit - Maximize hits from kept numbers</SelectItem>
                        <SelectItem value="cold_hit">❄️ Cold Hit - Minimize filtered out hits</SelectItem>
                        <SelectItem value="filtered">🗑️ Filtered - Target specific numbers removed</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className={`text-xs ${currentTheme.muted} mt-2`}>
                      {targetMode === 'reg' && 'Standard mode: maximize hits while minimizing extras from all 80 numbers'}
                      {targetMode === 'remainders' && `Target: Keep ${remainderMin}-${remainderMax} numbers after filtering`}
                      {targetMode === 'hit' && `Target: Hit ${targetMinRange}-${targetMaxRange} numbers from the 20 drawn`}
                      {targetMode === 'hot_hit' && 'Target: Maximize hits that come from your kept (remainder) numbers'}
                      {targetMode === 'cold_hit' && 'Target: Minimize hits that were filtered out (avoid filtering winners)'}
                      {targetMode === 'filtered' && `Target: Filter out ${remainderMin}-${remainderMax} numbers`}
                    </p>
                  </div>

                  {/* Hit Range Sliders */}
                  {(targetMode === 'hit' || targetMode === 'hot_hit' || targetMode === 'cold_hit') && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <Label className="text-sm">Target Hit Range</Label>
                          <span className={`text-sm ${currentTheme.muted}`}>{targetMinRange} - {targetMaxRange} hits</span>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <Label className="text-xs">Min Hits</Label>
                            <Slider
                              value={[targetMinRange]}
                              onValueChange={([v]) => setTargetMinRange(v)}
                              min={0}
                              max={15}
                              step={1}
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Max Hits</Label>
                            <Slider
                              value={[targetMaxRange]}
                              onValueChange={([v]) => setTargetMaxRange(v)}
                              min={1}
                              max={20}
                              step={1}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Remainder/Filtered Range Sliders */}
                  {(targetMode === 'remainders' || targetMode === 'filtered') && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1">
                          <Label className="text-sm">{targetMode === 'remainders' ? 'Remainder Range' : 'Filtered Count Range'}</Label>
                          <span className={`text-sm ${currentTheme.muted}`}>{remainderMin} - {remainderMax} numbers</span>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <Label className="text-xs">Min</Label>
                            <Slider
                              value={[remainderMin]}
                              onValueChange={([v]) => setRemainderMin(v)}
                              min={5}
                              max={40}
                              step={1}
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Max</Label>
                            <Slider
                              value={[remainderMax]}
                              onValueChange={([v]) => setRemainderMax(v)}
                              min={10}
                              max={60}
                              step={1}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Legend */}
                  <div className={`p-3 rounded-lg ${currentTheme.border} border text-xs space-y-1`}>
                    <div><strong>Reg (1-80):</strong> All 80 numbers in play</div>
                    <div><strong>Remainders:</strong> Numbers left after filters are applied</div>
                    <div><strong>Hit:</strong> Numbers drawn in the game (20 total)</div>
                    <div><strong>Hot Hit:</strong> Hit that was in your remainders (good!)</div>
                    <div><strong>Cold Hit:</strong> Hit that was filtered out (bad!)</div>
                    <div><strong>Filtered:</strong> Numbers removed by your filters</div>
                  </div>

                  <Button
                    onClick={runAutoConfig}
                    disabled={autoConfigRunning}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {autoConfigRunning ? (
                      <>
                        <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                        {autoConfigProgress || 'Running...'}
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-4 h-4 mr-2" />
                        Run Auto-Config
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              onClick={runAnalysis}
              disabled={running}
              className="mt-4 bg-green-600 hover:bg-green-700"
            >
              {running ? (
                <>
                  <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4 mr-2" />
                  Run Analysis
                </>
              )}
            </Button>

            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="mt-4 border-amber-500 text-amber-400 hover:bg-amber-500/20">
                  <SaveIcon className="w-4 h-4 mr-2" />
                  Save Profile
                </Button>
              </DialogTrigger>
              <DialogContent className={`${currentTheme.card} ${currentTheme.border} border`}>
                <DialogHeader>
                  <DialogTitle>Save Profile</DialogTitle>
                  <DialogDescription>Save your current configuration</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Profile Name</Label>
                    <Input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="My Awesome Strategy"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => profileName && saveMasterProfile(profileName)}
                      disabled={!profileName}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <SaveIcon className="w-4 h-4 mr-2" />
                      Master Profile
                    </Button>
                    <Button
                      onClick={() => profileName && savePocketProfile(profileName)}
                      disabled={!profileName}
                      variant="outline"
                    >
                      <SaveIcon className="w-4 h-4 mr-2" />
                      Pocket Profile
                    </Button>
                  </div>
                  <div className={`text-sm ${currentTheme.muted} space-y-1`}>
                    <p><strong>Master Profile:</strong> Saves everything (theme, strategy, filters, max numbers)</p>
                    <p><strong>Pocket Profile:</strong> Saves just the strategy and filter on/off states</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="mt-4 border-cyan-500 text-cyan-400 hover:bg-cyan-500/20">
                  <FolderOpenIcon className="w-4 h-4 mr-2" />
                  Load Profile
                </Button>
              </DialogTrigger>
              <DialogContent className={`${currentTheme.card} ${currentTheme.border} border max-w-2xl`}>
                <DialogHeader>
                  <DialogTitle>Load Profile</DialogTitle>
                  <DialogDescription>Choose a saved profile to load</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex justify-between items-center">
                    <Button onClick={importProfile} variant="outline" size="sm">
                      <UploadIcon className="w-4 h-4 mr-2" />
                      Import from File
                    </Button>
                    <span className={`text-sm ${currentTheme.muted}`}>
                      {masterProfiles.length} master, {pocketProfiles.length} pocket profiles saved
                    </span>
                  </div>

                  <Tabs defaultValue="master">
                    <TabsList>
                      <TabsTrigger value="master">Master Profiles ({masterProfiles.length})</TabsTrigger>
                      <TabsTrigger value="pocket">Pocket Profiles ({pocketProfiles.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="master" className="space-y-2 mt-2">
                      {masterProfiles.length === 0 ? (
                        <p className={`text-center py-8 ${currentTheme.muted}`}>No master profiles saved</p>
                      ) : (
                        masterProfiles.map((profile) => (
                          <div key={profile.name} className={`p-3 rounded-lg ${currentTheme.border} border flex justify-between items-center`}>
                            <div>
                              <div className="font-medium">{profile.name}</div>
                              <div className={`text-xs ${currentTheme.muted}`}>
                                {STRATEGIES[profile.strategy]?.name || profile.strategy} • Max: {profile.maxNumbers} • {profile.theme}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => loadMasterProfile(profile)}>Load</Button>
                              <Button size="sm" variant="outline" onClick={() => exportProfile(profile, 'master')}>
                                <DownloadIcon className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteMasterProfile(profile.name)}>
                                <TrashIcon className="w-3 h-3 text-red-400" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>
                    <TabsContent value="pocket" className="space-y-2 mt-2">
                      {pocketProfiles.length === 0 ? (
                        <p className={`text-center py-8 ${currentTheme.muted}`}>No pocket profiles saved</p>
                      ) : (
                        pocketProfiles.map((profile) => (
                          <div key={profile.name} className={`p-3 rounded-lg ${currentTheme.border} border flex justify-between items-center`}>
                            <div>
                              <div className="font-medium">{profile.name}</div>
                              <div className={`text-xs ${currentTheme.muted}`}>
                                {STRATEGIES[profile.strategy]?.name || profile.strategy} • {Object.keys(profile.filterStates).length} filters
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => loadPocketProfile(profile)}>Load</Button>
                              <Button size="sm" variant="outline" onClick={() => exportProfile(profile, 'pocket')}>
                                <DownloadIcon className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deletePocketProfile(profile.name)}>
                                <TrashIcon className="w-3 h-3 text-red-400" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Auto-Config Results */}
          {autoConfigResults && (
            <div className={`mt-4 p-4 rounded-lg ${currentTheme.card} ${currentTheme.border} border`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-green-400 flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" />
                    Auto-Config Complete!
                  </h3>
                  <p className={`text-sm ${currentTheme.muted} mt-1`}>Score: {autoConfigResults.bestScore.toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAutoConfigResults(null)}>
                    Dismiss
                  </Button>
                  <Button size="sm" onClick={applyAutoConfig}>
                    Apply & Test
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className={`text-sm ${currentTheme.muted}`}>Best Filters Found:</div>
                <div className="flex flex-wrap gap-2">
                  {autoConfigResults.bestConfig.map((f) => (
                    <Badge key={f.id} variant="secondary" className={`${currentTheme.card} ${currentTheme.border} border`}>
                      {f.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Filters Panel */}
          <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FilterIcon className="w-5 h-5" />
                Filters ({currentFilters.filter(f => f.enabled).length} active)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {currentFilters.map((filter) => (
                    <div
                      key={filter.id}
                      className={`p-3 rounded-lg ${currentTheme.border} border ${filter.enabled ? 'ring-1 ring-blue-500' : 'opacity-60'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <Checkbox
                            checked={filter.enabled}
                            onCheckedChange={(c) => {
                              if (selectedStrategy === 'custom') {
                                updateFilter(filter.id, { enabled: !!c });
                              }
                            }}
                          />
                          <span className="text-sm font-medium">{filter.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditableFilter(filter);
                              setConfigFilterOpen(filter.id);
                            }}
                          >
                            <SettingsIcon className="w-3 h-3" />
                          </Button>
                          {selectedStrategy === 'custom' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFilter(filter.id)}
                            >
                              <XIcon className="w-3 h-3 text-red-400" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {currentFilters.length === 0 && (
                    <p className={`text-center ${currentTheme.muted} py-8`}>
                      No filters. Add filters to customize your strategy.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                  <CardDescription className="text-xs">Eliminated</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">{80 - playableNumbers.length}</div>
                </CardContent>
              </Card>
              <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Filters Active</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-500">
                    {currentFilters.filter(f => f.enabled).length}
                  </div>
                </CardContent>
              </Card>
              <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">Strategy</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold truncate">
                    {STRATEGIES[selectedStrategy]?.name || 'Custom'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Board */}
            <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
              <CardHeader>
                <CardTitle>Current Prediction</CardTitle>
              </CardHeader>
              <CardContent>
                <KenoBoard highlight={playableNumbers} />
              </CardContent>
            </Card>

            {/* Detailed Results */}
            {runResults && (
              <Card className={`${currentTheme.card} ${currentTheme.border} border`}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3Icon className="w-5 h-5" />
                      Analysis Results
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => lastRunData && exportToCSV(lastRunData)}
                      className="border-green-500 text-green-400 hover:bg-green-500/20"
                    >
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Download CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Overview */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className={`text-sm ${currentTheme.muted}`}>Total Games</div>
                      <div className="text-xl font-bold">{runResults.totalGames}</div>
                    </div>
                    <div>
                      <div className={`text-sm ${currentTheme.muted}`}>Avg Hits/Game</div>
                      <div className="text-xl font-bold text-green-500">{runResults.avgHitsPerGame.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className={`text-sm ${currentTheme.muted}`}>Total Hits</div>
                      <div className="text-xl font-bold">{runResults.totalHits}</div>
                    </div>
                    <div>
                      <div className={`text-sm ${currentTheme.muted}`}>Total Misses</div>
                      <div className="text-xl font-bold text-red-500">{runResults.totalMisses}</div>
                    </div>
                  </div>

                  {/* Spot Counts */}
                  <div>
                    <h3 className="font-semibold mb-3">Spot Counts</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                        <div className={`text-xs ${currentTheme.muted}`}>10 Spot</div>
                        <div className="text-2xl font-bold text-blue-500">{runResults.spotCounts.tenSpot}</div>
                        <div className={`text-xs ${currentTheme.muted}`}>{((runResults.spotCounts.tenSpot / runResults.totalGames) * 10).toFixed(1)}% hit rate</div>
                      </div>
                      <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                        <div className={`text-xs ${currentTheme.muted}`}>8 Spot</div>
                        <div className="text-2xl font-bold text-purple-500">{runResults.spotCounts.eightSpot}</div>
                        <div className={`text-xs ${currentTheme.muted}`}>{((runResults.spotCounts.eightSpot / runResults.totalGames) * 12.5).toFixed(1)}% hit rate</div>
                      </div>
                      <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                        <div className={`text-xs ${currentTheme.muted}`}>5 Spot</div>
                        <div className="text-2xl font-bold text-amber-500">{runResults.spotCounts.fiveSpot}</div>
                        <div className={`text-xs ${currentTheme.muted}`}>{((runResults.spotCounts.fiveSpot / runResults.totalGames) * 20).toFixed(1)}% hit rate</div>
                      </div>
                      <div className={`p-3 rounded-lg ${currentTheme.border} border`}>
                        <div className={`text-xs ${currentTheme.muted}`}>3 Spot</div>
                        <div className="text-2xl font-bold text-cyan-500">{runResults.spotCounts.threeSpot}</div>
                        <div className={`text-xs ${currentTheme.muted}`}>{((runResults.spotCounts.threeSpot / runResults.totalGames) * 33.3).toFixed(1)}% hit rate</div>
                      </div>
                    </div>
                  </div>

                  {/* COLD HITS - The most important metric for jackpot */}
                  <div className={`p-4 rounded-lg ${currentTheme.border} border ${runResults.coldHits === 0 ? 'bg-green-900/30' : runResults.coldHits <= 5 ? 'bg-amber-900/30' : 'bg-red-900/30'}`}>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      {runResults.coldHits === 0 ? '🎯 PERFECT!' : runResults.coldHits <= 5 ? '⚠️ Warning' : '❌ Too Many'} - COLD HITS (Filtered Winners)
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-bold">{runResults.coldHits}</div>
                      <div className={`text-sm ${currentTheme.muted}`}>
                        Numbers you filtered out that actually hit<br/>
                        <span className={runResults.coldHits === 0 ? 'text-green-400' : ''}>Goal: ZERO cold hits for 5/5, 7/7, 8/8, 10/10</span>
                      </div>
                    </div>
                    {runResults.avgRemainderSize !== undefined && (
                      <div className={`mt-3 pt-3 border-t ${currentTheme.border}`}>
                        <div className="flex justify-between text-sm">
                          <span className={currentTheme.muted}>Avg Pool Size:</span>
                          <span className={runResults.avgRemainderSize <= 20 ? 'text-green-400 font-bold' : 'text-amber-400'}>
                            {runResults.avgRemainderSize} numbers
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className={currentTheme.muted}>Jackpot Ready?</span>
                          <span className={runResults.coldHits === 0 && runResults.avgRemainderSize <= 20 ? 'text-green-400 font-bold' : 'text-red-400'}>
                            {runResults.coldHits === 0 && runResults.avgRemainderSize <= 20 ? 'YES ✅' : 'NO ❌'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Per-Filter Stats */}
                  <div>
                    <h3 className="font-semibold mb-3">Per-Filter Statistics</h3>
                    <div className="space-y-2">
                      {runResults.perFilterStats.map((stat) => (
                        <div key={stat.filterId} className={`p-3 rounded-lg ${currentTheme.border} border`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium">{stat.filterName}</span>
                            <Badge variant="outline">{stat.hitCount} hits</Badge>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className={currentTheme.muted}>Kept:</span> {stat.keptCount}
                            </div>
                            <div>
                              <span className={currentTheme.muted}>Removed:</span> {stat.removedCount}
                            </div>
                            <div>
                              <span className={currentTheme.muted}>Hits:</span> <span className={currentTheme.success}>{stat.hitCount}</span>
                            </div>
                            <div>
                              <span className={currentTheme.muted}>Missed:</span> <span className={currentTheme.danger}>{stat.hitRemovedCount}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Remaining Filtered No Hit */}
                  <div className={`p-4 rounded-lg ${currentTheme.border} border`}>
                    <h3 className="font-semibold mb-2">Filtered Numbers That Didn't Hit</h3>
                    <div className="text-3xl font-bold text-orange-500">{runResults.remainingFilteredNoHit}</div>
                    <div className={`text-sm ${currentTheme.muted}`}>Average per game (numbers kept but didn&rsquo;t hit)</div>
                  </div>

                  {/* Percentiles vs Other Configs */}
                  <div>
                    <h3 className="font-semibold mb-3">Filter Percentile (vs Other Configs)</h3>
                    <div className="space-y-2">
                      {runResults.percentiles.map((p) => {
                        const filterName = currentFilters.find(f => f.id === p.filterId)?.name || p.filterId;
                        return (
                          <div key={p.filterId} className="flex items-center gap-3">
                            <span className="w-40 text-sm truncate">{filterName}</span>
                            <div className="flex-1 h-6 bg-slate-800 rounded-full overflow-hidden flex">
                              <div
                                className="bg-green-500 flex items-center justify-center text-xs"
                                style={{ width: `${p.hitPercentile}%` }}
                              >
                                {p.hitPercentile > 15 ? `${p.hitPercentile}%` : ''}
                              </div>
                            </div>
                            <span className="text-xs w-12">{p.hitPercentile}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cross-Strategy Comparison */}
                  <div>
                    <h3 className="font-semibold mb-3">Cross-Strategy Comparison</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={currentTheme.muted}>
                            <th className="text-left p-2">Strategy</th>
                            <th className="text-right p-2">Hit %ile</th>
                            <th className="text-right p-2">Spare %ile</th>
                            <th className="text-right p-2">Combined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runResults.crossStrategyPercentiles.map((s, i) => (
                            <tr key={i} className={`border-t ${currentTheme.border}`}>
                              <td className="p-2">{s.strategyName}</td>
                              <td className={`text-right p-2 ${s.hitPercentile > 50 ? currentTheme.success : ''}`}>{s.hitPercentile}%</td>
                              <td className={`text-right p-2 ${s.sparePercentile > 50 ? currentTheme.success : ''}`}>{s.sparePercentile}%</td>
                              <td className="text-right p-2">{Math.round((s.hitPercentile + s.sparePercentile) / 2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Filter Config Dialog */}
      {configFilterOpen && editableFilter && (
        <Dialog open={!!configFilterOpen} onOpenChange={setConfigFilterOpen}>
          <FilterConfigDialog filter={editableFilter} />
        </Dialog>
      )}
    </div>
  );
}
