#!/usr/bin/env python3
"""
Keno Multi-Strategy Tracker + Analysis Tools

Runs multiple strategies side-by-side:
1. Elimination Rules (original)
2. Statistical Scoring (Z-score, trend, etc.)
3. Follow the Vacuum (super-hot repeaters)
4. Dead Zone + Decade Sleepers (cold in dead zones)
5. Mirror Fold (mirrored positions)

Plus Analysis Tools:
- Pair Analysis (hot/cold pairs)
- Repeat/Carryover Analysis
- Odd/Even & High/Low Balance
- Row & Column Heatmap
- Monte Carlo Simulation
- Gap Chart
"""

import csv
import json
import math
import re
import random
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Set, Optional, Tuple
from collections import Counter, defaultdict
from itertools import combinations

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.support.ui import Select
    HAS_SELENIUM = True
except ImportError:
    HAS_SELENIUM = False

# Configuration
LIVE_URL = "https://kenousa.com/games/CasinoArizona/McKellips/"
HIST_URL = "https://kenousa.com/games/CasinoArizona/McKellips/draws.php"
POLL_INTERVAL = 15
OUTPUT_DIR = Path("keno_data")
GAMES_CSV = Path("/home/ox/Work/CAZ/games/games.csv")
STRATEGY_SCORES_CSV = OUTPUT_DIR / "strategy_scores.csv"
PREDICTIONS_CSV = OUTPUT_DIR / "predictions.csv"

ROWS, COLS = 8, 10
BALLS_DRAWN = 20
P_HIT = BALLS_DRAWN / 80  # 0.25

# Board helpers
def rc(n): return (n - 1) // COLS, (n - 1) % COLS
def to_num(r, c): return r * COLS + c + 1
def get_row(n): return set(to_num(rc(n)[0], c) for c in range(COLS))
def get_col(n): return set(to_num(r, rc(n)[1]) for r in range(ROWS))
def get_neighbors(n):
    r, c = rc(n)
    return set(to_num(r+dr, c+dc) for dr in (-1,0,1) for dc in (-1,0,1)
                if (dr or dc) and 0 <= r+dr < ROWS and 0 <= c+dc < COLS)
def mirror_num(n): return 81 - n


class KenoAnalyzer:
    """Analysis tools for Keno data."""

    def __init__(self, games: List[Dict]):
        """Initialize with games list."""
        self.games = games
        self.history = [g['numbers'] for g in games] if games else []

    # ========== 1. PAIR ANALYSIS ==========

    def pair_analysis(self, top: int = 20) -> List[Tuple]:
        """Which pairs appear together more than expected."""
        pair_counts = Counter()
        for game in self.history:
            sorted_nums = sorted(game)
            for a, b in combinations(sorted_nums, 2):
                pair_counts[(a, b)] += 1

        total = len(self.history)
        expected = total * (20/80) * (19/79) if total else 0

        scored = []
        for (a, b), count in pair_counts.items():
            ratio = count / expected if expected > 0 else 0
            scored.append((a, b, count, round(ratio, 2)))

        scored.sort(key=lambda x: -x[3])
        return scored

    def print_pair_analysis(self, top: int = 20):
        scored = self.pair_analysis(top)

        print(f"\n{'='*70}")
        print(f"PAIR ANALYSIS — Hot pairs that appear together")
        print(f"{'='*70}")
        print(f"  Expected pair frequency: {len(self.history) * (20/80) * (19/79):.2f} per game\n")
        print(f"  {'A':>3} {'B':>3} {'Count':>6} {'vs Exp':>8}  {'Heat':>10}")
        print(f"  {'─'*3} {'─'*3} {'─'*6} {'─'*8}  {'─'*10}")

        for a, b, cnt, ratio in scored[:top]:
            bar = "█" * int(min(ratio * 3, 20))
            print(f"  {a:3d} {b:3d} {cnt:6d}   {ratio:6.2f}x  {bar}")

        if len(scored) > 5:
            print(f"\n  COLD PAIRS (rarely together):")
            for a, b, cnt, ratio in scored[-5:]:
                print(f"    {a:3d} {b:3d} — {cnt} times ({ratio:.2f}x expected)")

    # ========== 2. REPEAT/CARRYOVER ANALYSIS ==========

    def repeat_analysis(self) -> Dict:
        """How many numbers repeat game-to-game."""
        repeats = []
        for i in range(len(self.history) - 1):
            curr = self.history[i]
            prev = self.history[i + 1]
            overlap = curr & prev
            repeats.append(len(overlap))

        if not repeats:
            return {'avg': 0, 'min': 0, 'max': 0, 'distribution': {}}

        dist = Counter(repeats)
        return {
            'avg': sum(repeats) / len(repeats),
            'min': min(repeats),
            'max': max(repeats),
            'distribution': dict(dist)
        }

    def print_repeat_analysis(self):
        data = self.repeat_analysis()

        print(f"\n{'='*70}")
        print(f"REPEAT ANALYSIS — Game-to-game carryover")
        print(f"{'='*70}")
        print(f"  Average repeats:  {data['avg']:.2f}")
        print(f"  Expected random:  {20 * (20/80):.2f}")
        print(f"  Range:           {data['min']} to {data['max']}")

        print(f"\n  Distribution (last {len(self.history)} game pairs):")
        print(f"  {'Repeats':>8}  {'Count':>6}  {'Bar':>20}")
        print(f"  {'─'*8}  {'─'*6}  {'─'*20}")

        for r in sorted(data['distribution'].keys()):
            count = data['distribution'][r]
            bar = "█" * count
            print(f"  {r:8d}  {count:6d}  {bar}")

    # ========== 3. ODD/EVEN & HIGH/LOW BALANCE ==========

    def balance_analysis(self, window: int = 10) -> List[Dict]:
        """Odd/even and high/low balance."""
        results = []
        for i in range(min(window, len(self.history))):
            g = self.history[i]
            odd = sum(1 for n in g if n % 2 == 1)
            even = len(g) - odd
            low = sum(1 for n in g if n <= 40)
            high = len(g) - low
            results.append({'odd': odd, 'even': even, 'low': low, 'high': high})
        return results

    def print_balance_analysis(self, window: int = 10):
        results = self.balance_analysis(window)

        print(f"\n{'='*70}")
        print(f"ODD/EVEN & HIGH/LOW BALANCE — Last {window} games")
        print(f"{'='*70}")
        print(f"  {'Game':>4} {'Odd':>3} {'Evn':>3} {'Low':>3} {'Hi':>3}  {'Pattern':>20}")
        print(f"  {'─'*4} {'─'*3} {'─'*3} {'─'*3} {'─'*3}  {'─'*20}")

        odd_totals, hi_totals = [], []

        for i, r in enumerate(results):
            odd_totals.append(r['odd'])
            hi_totals.append(r['high'])

            pattern = "O" * r['odd'] + "E" * r['even']
            print(f"  {i:4d} {r['odd']:3d} {r['even']:3d} {r['low']:3d} {r['high']:3d}  {pattern[:20]}")

        if odd_totals:
            avg_odd = sum(odd_totals) / len(odd_totals)
            avg_hi = sum(hi_totals) / len(hi_totals)
            print(f"\n  Average odd:  {avg_odd:.1f}/20  (expected: 10)")
            print(f"  Average high: {avg_hi:.1f}/20  (expected: 10)")

    # ========== 4. ROW & COLUMN HEATMAP ==========

    def row_col_heatmap(self, window: int = 10) -> Tuple[List[int], List[int]]:
        """Row and column hit counts."""
        row_hits = [0] * 8
        col_hits = [0] * 10

        for game in self.history[:window]:
            for n in game:
                r, c = rc(n)
                row_hits[r] += 1
                col_hits[c] += 1

        return row_hits, col_hits

    def print_row_col_heatmap(self, window: int = 10):
        row_hits, col_hits = self.row_col_heatmap(window)

        expected_row = window * 20 / 8
        expected_col = window * 20 / 10

        print(f"\n{'='*70}")
        print(f"ROW & COLUMN HEATMAP — Last {window} games")
        print(f"{'='*70}")

        print(f"\n  ROW HEAT (expected: {expected_row:.1f} per row):")
        for i, h in enumerate(row_hits):
            temp = "🔥" if h > expected_row * 1.2 else "🧊" if h < expected_row * 0.8 else "  "
            bar = "█" * (h // 2)
            rng = f"{i*10+1:2d}-{i*10+10:2d}"
            print(f"    Row {i+1} ({rng}): {h:3d} hits  {temp} {bar}")

        print(f"\n  COLUMN HEAT (expected: {expected_col:.1f} per column):")
        for i, h in enumerate(col_hits):
            temp = "🔥" if h > expected_col * 1.2 else "🧊" if h < expected_col * 0.8 else "  "
            bar = "█" * (h // 2)
            print(f"    Col {i+1:2d}: {h:3d} hits  {temp} {bar}")

    # ========== 5. MONTE CARLO SIMULATION ==========

    def monte_carlo_sim(self, pick_count: int = 10, games: int = 100, simulations: int = 1000) -> Dict:
        """Simulate random sessions to show what pure chance looks like."""
        hit_avgs = []
        best_streaks = []

        for _ in range(simulations):
            picks = set(random.sample(range(1, 81), pick_count))
            hits_per_game = []

            for _ in range(games):
                draw = set(random.sample(range(1, 81), 20))
                hits_per_game.append(len(picks & draw))

            hit_avgs.append(sum(hits_per_game) / games)

            # Longest streak (>=3 hits)
            streak = max_streak = 0
            for h in hits_per_game:
                if h >= 3:
                    streak += 1
                    max_streak = max(max_streak, streak)
                else:
                    streak = 0
            best_streaks.append(max_streak)

        return {
            'avg_hits': sum(hit_avgs) / len(hit_avgs),
            'expected': pick_count * 20/80,
            'best_session': max(hit_avgs),
            'worst_session': min(hit_avgs),
            'avg_streak': sum(best_streaks) / len(best_streaks),
            'best_streak': max(best_streaks)
        }

    def print_monte_carlo(self, pick_count: int = 10, games: int = 100, simulations: int = 1000):
        print(f"\n{'='*70}")
        print(f"MONTE CARLO SIMULATION — {simulations:,} random sessions")
        print(f"{'='*70}")
        print(f"  Picking {pick_count} numbers × {games} games each\n")

        data = self.monte_carlo_sim(pick_count, games, simulations)

        print(f"  Average hits/game:     {data['avg_hits']:.3f}")
        print(f"  Expected (random):     {data['expected']:.3f}")
        print(f"  Best session avg:      {data['best_session']:.3f}")
        print(f"  Worst session avg:     {data['worst_session']:.3f}")

        print(f"\n  Longest hot streak (≥3 hits/game):")
        print(f"    Average:  {data['avg_streak']:.1f} games")
        print(f"    Best:     {data['best_streak']} games in a row")

        print(f"\n  💡 Even PURE RANDOM creates {data['best_streak']}-game streaks!")
        print(f"     Patterns are normal in randomness!")

    # ========== 6. GAP CHART ==========

    def gap_chart(self, numbers: List[int] = None, window: int = 30):
        """Show when each number hit in the last N games."""
        if numbers is None:
            numbers = list(range(1, 21))

        print(f"\n{'='*70}")
        print(f"GAP CHART — Last {window} games")
        print(f"{'='*70}")
        print(f"  Num  " + "".join(f"{i%10}" for i in range(window)) + "  Hits")
        print(f"  ───  " + "─" * window + "  ────")

        for n in numbers:
            line = ""
            hit_count = 0
            for i in range(window):
                if i < len(self.history) and n in self.history[i]:
                    line += "●"
                    hit_count += 1
                else:
                    line += "·"
            print(f"  {n:3d}  {line}  {hit_count}")

    # ========== RUN ALL ANALYSES ==========

    def run_all_analyses(self):
        """Run all analysis tools."""
        self.print_pair_analysis(top=15)
        self.print_repeat_analysis()
        self.print_balance_analysis(window=10)
        self.print_row_col_heatmap(window=10)
        self.print_gap_chart(numbers=[1, 7, 13, 22, 37, 44, 55, 68, 72, 80])
        self.print_monte_carlo(pick_count=10, games=100, simulations=1000)


class KenoMultiStrategy:
    """Multi-strategy Keno tracker."""

    def __init__(self):
        self.output_dir = OUTPUT_DIR
        self.output_dir.mkdir(exist_ok=True)

        self.games: List[Dict] = []
        self.predictions: Dict[str, List[Dict]] = defaultdict(list)
        self.scores: Dict[str, List[Dict]] = defaultdict(list)

        self.state = self._load_state()
        self.seen_games: Set[str] = set(self.state.get("seen_games", []))

        self._load_games()
        self._load_predictions()
        self._load_scores()

        # Initialize Selenium
        self.driver = None
        if HAS_SELENIUM:
            self._init_driver()

    def _load_state(self) -> Dict:
        if (OUTPUT_DIR / "scraper_state.json").exists():
            try:
                with open(OUTPUT_DIR / "scraper_state.json") as f:
                    return json.load(f)
            except: pass
        return {"seen_games": []}

    def _save_state(self):
        self.state["seen_games"] = list(self.seen_games)
        with open(OUTPUT_DIR / "scraper_state.json", 'w') as f:
            json.dump(self.state, f)

    def _load_games(self):
        if GAMES_CSV.exists():
            with open(GAMES_CSV, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    numbers = [int(row[f'number_{i}']) for i in range(1, 21)]
                    self.games.append({
                        'game_id': int(row['game_id']),
                        'date': row['date'],
                        'time': row['time'],
                        'numbers': set(numbers),
                        'numbers_list': numbers
                    })
            # Sort by date descending, then by game_id descending for correct chronological order
            self.games.sort(key=lambda g: (g['date'], g['game_id']), reverse=True)

    def _load_predictions(self):
        if PREDICTIONS_CSV.exists():
            with open(PREDICTIONS_CSV, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Handle both old and new CSV formats
                    if 'strategy' in row:
                        strategy = row['strategy']
                    else:
                        continue  # Skip old format predictions
                    self.predictions[strategy].append({
                        'game_id': int(row['game_id']),
                        'date': row['date'],
                        'picks': [int(x) for x in row['picks'].split(',')]
                    })

    def _load_scores(self):
        if STRATEGY_SCORES_CSV.exists():
            with open(STRATEGY_SCORES_CSV, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    strategy = row['strategy']
                    self.scores[strategy].append({
                        'game_id': int(row['game_id']),
                        'hits': int(row['hits']),
                        'pick_count': int(row['pick_count'])
                    })

    def _init_driver(self):
        try:
            options = ChromeOptions()
            options.add_argument('--headless')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            self.driver = webdriver.Chrome(options=options)
            self.driver.set_page_load_timeout(30)
            print("✓ Selenium driver initialized")
        except Exception as e:
            print(f"Warning: Could not initialize Selenium: {e}")

    def _save_predictions(self):
        with open(PREDICTIONS_CSV, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['strategy', 'game_id', 'date', 'picks'])
            writer.writeheader()
            for strategy, preds in self.predictions.items():
                for p in preds:
                    writer.writerow({
                        'strategy': strategy,
                        'game_id': p['game_id'],
                        'date': p['date'],
                        'picks': ','.join(map(str, p['picks']))
                    })

    def _save_scores(self):
        with open(STRATEGY_SCORES_CSV, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['strategy', 'game_id', 'hits', 'pick_count'])
            writer.writeheader()
            for strategy, scores in self.scores.items():
                for s in scores:
                    writer.writerow({
                        'strategy': strategy,
                        'game_id': s['game_id'],
                        'hits': s['hits'],
                        'pick_count': s['pick_count']
                    })

    # ========== STRATEGY 1: Elimination Rules ==========

    def strategy_elimination(self) -> List[int]:
        """Original elimination rules."""
        if not self.games:
            return list(range(1, 81))

        def hits_in_n(num, n):
            return sum(1 for i in range(min(n, len(self.games))) if num in self.games[i]['numbers'])

        def hit_in_positions(num, positions):
            return any(num in self.games[pos-1]['numbers'] for pos in positions if pos <= len(self.games))

        def has_neighbor_hit(num, position=1):
            if position > len(self.games):
                return False
            drawn = self.games[position-1]['numbers']
            return bool(get_neighbors(num) & drawn)

        def is_row_col_hot(num, last_n=3, threshold=4):
            num_row, num_col = rc(num)
            for i in range(min(last_n, len(self.games))):
                drawn = self.games[i]['numbers']
                if sum(1 for n in drawn if rc(n)[0] == num_row) >= threshold:
                    return True
                if sum(1 for n in drawn if rc(n)[1] == num_col) >= threshold:
                    return True
            return False

        remove = set()
        for num in range(1, 81):
            if hit_in_positions(num, [1, 2]): continue
            if sum(1 for i in range(min(3, len(self.games))) if num in self.games[i]['numbers']) >= 2: continue
            if hits_in_n(num, 8) >= 4: continue
            if hits_in_n(num, 10) >= 6: continue
            if hit_in_positions(num, [1, 3, 4]): continue
            if is_row_col_hot(num, 3, 4): continue
            if not has_neighbor_hit(num, 1): continue
            remove.add(num)

        # Sort remaining by long-term hits DESC, short-term hits ASC
        remaining = [n for n in range(1, 81) if n not in remove]
        remaining.sort(key=lambda n: (-hits_in_n(n, 50), hits_in_n(n, 10)))
        return remaining[:20]

    # ========== STRATEGY 2: Statistical Scoring ==========

    def strategy_statistical(self) -> List[int]:
        """Z-score, trend, overdue, neighbor heat."""
        if not self.games:
            return list(range(1, 81))

        def z_score(observed, n):
            expected = n * P_HIT
            std = math.sqrt(n * P_HIT * (1 - P_HIT)) if n > 0 else 1
            return (observed - expected) / std if std > 0 else 0

        def gap_since_last(num):
            for i, g in enumerate(self.games):
                if num in g['numbers']:
                    return i
            return len(self.games)

        def trend_score(num):
            hits_short = sum(1 for i in range(min(10, len(self.games))) if num in self.games[i]['numbers'])
            hits_long = sum(1 for i in range(min(50, len(self.games))) if num in self.games[i]['numbers'])
            return z_score(hits_long, 50) - z_score(hits_short, 10)

        def neighbor_heat(num):
            if not self.games:
                return 0
            last_draw = self.games[0]['numbers']
            return len(get_neighbors(num) & last_draw)

        def zone_density(num):
            zone = get_row(num) | get_col(num)
            zone.discard(num)
            return sum(1 for g in self.games[:3] for m in zone if m in g['numbers']) / (len(zone) * 3)

        last_draw = self.games[0]['numbers']
        scores = []

        for num in range(1, 81):
            hits50 = sum(1 for i in range(min(50, len(self.games))) if num in self.games[i]['numbers'])
            hits10 = sum(1 for i in range(min(10, len(self.games))) if num in self.games[i]['numbers'])

            z50 = z_score(hits50, 50)
            trend = trend_score(num)
            gap = gap_since_last(num)
            overdue = 1 - math.exp(-gap / 4)  # expected gap ~4
            nh = neighbor_heat(num)
            zd = zone_density(num)

            # Penalize current hit streak
            streak = 0
            for g in self.games:
                if num in g['numbers']:
                    streak += 1
                else:
                    break

            composite = (
                0.20 * max(0, min(z50 / 3 + 0.5, 1)) +
                0.25 * max(0, min(trend / 3 + 0.5, 1)) +
                0.20 * overdue +
                0.15 * (nh / 5) +
                0.10 * zd * (0 if hits10 <= 2 else 0.5 if hits10 <= 3 else 0.2) -
                0.10 * min(streak / 4, 1.0)
            )

            scores.append((num, composite))

        scores.sort(key=lambda x: -x[1])
        return [n for n, _ in scores[:20]]

    # ========== STRATEGY 3: Follow the Vacuum (Super-Hot) ==========

    def strategy_vacuum(self) -> List[int]:
        """Play numbers that hit 4+ times in last 6 games."""
        if len(self.games) < 6:
            return list(range(1, 81))

        hit_counts = Counter()
        for g in self.games[:6]:
            hit_counts.update(g['numbers'])

        # Get numbers that hit 4+ times
        super_hot = [num for num, count in hit_counts.items() if count >= 4]

        if len(super_hot) >= 10:
            return super_hot[:10]
        elif super_hot:
            # Extend with 3+ hitters
            hot = [num for num, count in hit_counts.items() if count >= 3]
            return sorted(hot, key=lambda n: -hit_counts[n])[:10]
        else:
            # Fallback: top hitters in last 6
            return [n for n, _ in hit_counts.most_common(10)]

    # ========== STRATEGY 4: Dead Zone + Decade Sleepers ==========

    def strategy_deadzone(self) -> List[int]:
        """Cold numbers in dead zones."""
        if not self.games:
            return list(range(1, 81))

        # Remove last 3 game hitters
        recent_hits = set()
        for g in self.games[:3]:
            recent_hits.update(g['numbers'])

        # Remove chronic hot (12+ in last 50)
        chronic_hot = set()
        for num in range(1, 81):
            if sum(1 for g in self.games[:50] if num in g['numbers']) >= 12:
                chronic_hot.add(num)

        # Find decade sleepers (0 hits in last 15)
        sleepers = []
        for num in range(1, 81):
            if num in recent_hits or num in chronic_hot:
                continue
            if not any(num in g['numbers'] for g in self.games[:15]):
                sleepers.append(num)

        # Find biggest dead zone from last game
        last_draw = self.games[0]['numbers']
        zone_scores = {}

        for num in sleepers:
            r, c = rc(num)
            # Count hits in 3x3 around this number from last game
            nearby_hits = 0
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    check = to_num(r + dr, c + dc)
                    if 1 <= check <= 80 and check in last_draw:
                        nearby_hits += 1
            # Lower score = deader zone
            zone_scores[num] = nearby_hits

        # Sort by dead zone (lowest nearby hits first)
        sleepers.sort(key=lambda n: zone_scores[n])
        return sleepers[:15]

    # ========== STRATEGY 5: Mirror Fold ==========

    def strategy_mirror(self) -> List[int]:
        """Mirror the last game's positions."""
        if not self.games:
            return list(range(1, 81))

        last_draw = self.games[0]['numbers']
        mirrored = [mirror_num(n) for n in last_draw]

        # Optionally filter to coldest of the mirrored
        if len(self.games) >= 10:
            mirrored.sort(key=lambda n: sum(1 for g in self.games[:10] if n in g['numbers']))
            return mirrored[:12]

        return mirrored[:20]

    # ========== STRATEGY 6: Cluster Heat Map ==========

    def strategy_cluster_heat(self) -> List[int]:
        """Numbers with highest neighbor heat in last 3 games."""
        if not self.games:
            return list(range(1, 81))

        # Calculate neighbor heat for each number
        heat_scores = {}
        for num in range(1, 81):
            total_neighbor_hits = 0
            for g in self.games[:3]:  # Last 3 games
                neighbors = get_neighbors(num)
                total_neighbor_hits += len(neighbors & g['numbers'])
            heat_scores[num] = total_neighbor_hits

        # Get top heat threshold
        sorted_heat = sorted(heat_scores.items(), key=lambda x: -x[1])
        top_threshold = sorted_heat[20][1] if len(sorted_heat) >= 20 else 0

        # Return numbers above threshold, sorted by heat
        hot_numbers = [n for n, heat in sorted_heat if heat >= top_threshold]
        return hot_numbers[:20]

    # ========== STRATEGY 7: Opposite Row/Col Mirror ==========

    def strategy_opposite_rc(self) -> List[int]:
        """Play opposite row/col of hottest row/col in last 5 games."""
        if len(self.games) < 5:
            return list(range(1, 81))

        # Find hottest row and column in last 5 games
        row_hits = Counter()
        col_hits = Counter()

        for g in self.games[:5]:
            for n in g['numbers']:
                r, c = rc(n)
                row_hits[r] += 1
                col_hits[c] += 1

        hottest_row = row_hits.most_common(1)[0][0]
        hottest_col = col_hits.most_common(1)[0][0]

        # Opposite row and column
        opp_row = 7 - hottest_row
        opp_col = 9 - hottest_col

        # All numbers in opposite row + opposite column
        opp_numbers = set()
        for c in range(COLS):
            opp_numbers.add(to_num(opp_row, c))
        for r in range(ROWS):
            opp_numbers.add(to_num(r, opp_col))

        # Sort by coldest in last 10
        result = list(opp_numbers)
        result.sort(key=lambda n: sum(1 for g in self.games[:10] if n in g['numbers']))
        return result[:15]

    # ========== STRATEGY 8: Decade Tracker ==========

    def strategy_decade(self) -> List[int]:
        """Play numbers from under-represented decades."""
        if len(self.games) < 8:
            return list(range(1, 81))

        # Count hits per decade in last 8 games
        decades = [(1, 20), (21, 40), (41, 60), (61, 80)]
        decade_hits = []

        for start, end in decades:
            count = 0
            for g in self.games[:8]:
                count += sum(1 for n in g['numbers'] if start <= n <= end)
            decade_hits.append((start, end, count))

        expected = 8 * 20 / 4  # 40 hits per decade expected

        # Find under-represented decades
        cold_decades = [d for d in decade_hits if d[2] < expected * 0.7]

        if not cold_decades:
            # Take the coldest
            cold_decades = [min(decade_hits, key=lambda x: x[1])]

        # Get all numbers from cold decades, sort by coldness
        candidates = []
        for start, end, _ in cold_decades:
            for num in range(start, end + 1):
                hits = sum(1 for g in self.games[:10] if num in g['numbers'])
                candidates.append((num, hits))

        candidates.sort(key=lambda x: x[1])
        return [n for n, _ in candidates[:15]]

    # ========== STRATEGY 9: 3-Game Ice Box (Avoid) ==========

    def strategy_icebox(self) -> List[int]:
        """Numbers NOT in the 'ice box' - exclude numbers hitting 2+ in last 3."""
        if not self.games:
            return list(range(1, 81))

        # Find ice box numbers (hit 2+ times in last 3 games)
        ice_box = set()
        for num in range(1, 81):
            hits = sum(1 for g in self.games[:3] if num in g['numbers'])
            if hits >= 2:
                ice_box.add(num)

        # All numbers EXCEPT ice box, sorted by long-term frequency
        remaining = [n for n in range(1, 81) if n not in ice_box]
        remaining.sort(key=lambda n: -sum(1 for g in self.games[:50] if n in g['numbers']))
        return remaining[:20]

    # ========== STRATEGY 10: The Lonely 7 (Coldest) ==========

    def strategy_lonely7(self) -> List[int]:
        """The 7 coldest numbers (0 hits in last 12-15 games)."""
        if len(self.games) < 12:
            return list(range(1, 81))

        gap_data = []
        for num in range(1, 81):
            gap = 0
            for g in self.games:
                if num in g['numbers']:
                    break
                gap += 1

            if gap >= 12:  # Haven't hit in 12+ games
                gap_data.append((num, gap))

        # Sort by coldest (longest gap)
        gap_data.sort(key=lambda x: -x[1])

        lonely = [n for n, _ in gap_data[:7]]

        # If we don't have 7, extend with gap >= 8
        if len(lonely) < 7:
            for num in range(1, 81):
                if num not in lonely:
                    gap = 0
                    for g in self.games:
                        if num in g['numbers']:
                            break
                        gap += 1
                    if gap >= 8 and num not in lonely:
                        lonely.append(num)
                        if len(lonely) >= 7:
                            break

        return lonely

    # ========== STRATEGY 11: The Arrow (First to Last) ==========

    def strategy_arrow(self) -> List[int]:
        """Numbers the arrow passes through (first to last drawn)."""
        if not self.games:
            return list(range(1, 81))

        # Get first and last numbers from most recent game
        # Since we store as sets, we'll use the ordered list
        last_numbers = self.games[0].get('numbers_list', list(self.games[0]['numbers']))

        if len(last_numbers) < 2:
            return list(range(1, 81))

        first = last_numbers[0]
        last = last_numbers[-1]

        # Calculate "arrow path" - numbers on the line from first to last
        first_rc = rc(first)
        last_rc = rc(last)

        # Get all numbers along the diagonal/cross pattern
        arrow_numbers = set()

        # Numbers in same row
        r1, _ = first_rc
        for c in range(COLS):
            arrow_numbers.add(to_num(r1, c))

        # Numbers in same column
        _, c1 = first_rc
        for r in range(ROWS):
            arrow_numbers.add(to_num(r, c1))

        # Numbers in last row/col
        r2, _ = last_rc
        for c in range(COLS):
            arrow_numbers.add(to_num(r2, c))

        _, c2 = last_rc
        for r in range(ROWS):
            arrow_numbers.add(to_num(r, c2))

        # Remove first and last (they're obvious)
        arrow_numbers.discard(first)
        arrow_numbers.discard(last)

        # Sort by coldest
        result = list(arrow_numbers)
        result.sort(key=lambda n: sum(1 for g in self.games[:10] if n in g['numbers']))
        return result[:15]

    # ========== Get All Strategy Predictions ==========

    def get_all_predictions(self) -> Dict[str, List[int]]:
        """Get predictions from all strategies."""
        return {
            'elimination': self.strategy_elimination(),
            'statistical': self.strategy_statistical(),
            'vacuum': self.strategy_vacuum(),
            'deadzone': self.strategy_deadzone(),
            'mirror': self.strategy_mirror(),
            'cluster': self.strategy_cluster_heat(),
            'opposite_rc': self.strategy_opposite_rc(),
            'decade': self.strategy_decade(),
            'icebox': self.strategy_icebox(),
            'lonely7': self.strategy_lonely7(),
            'arrow': self.strategy_arrow(),
        }

    # ========== Scoring ==========

    def score_prediction(self, strategy: str, game_id: int, actual: Set[int]) -> Optional[int]:
        """Score a specific strategy's prediction for a game."""
        for pred in self.predictions[strategy]:
            if pred['game_id'] == game_id:
                hits = len(set(pred['picks']) & actual)
                self.scores[strategy].append({
                    'game_id': game_id,
                    'hits': hits,
                    'pick_count': len(pred['picks'])
                })
                return hits
        return None

    # ========== Add New Game ==========

    def add_game(self, game: Dict) -> Dict:
        """Add a new game and update all predictions."""
        # Score existing predictions
        scores_result = {}
        for strategy in self.predictions.keys():
            hits = self.score_prediction(strategy, game['game_id'], game['numbers'])
            scores_result[strategy] = hits

        # Add the game
        self.games.insert(0, game)
        unique_key = f"{game['game_id']}_{game['date']}"
        self.seen_games.add(unique_key)
        self._save_state()

        # Generate new predictions for next game
        all_preds = self.get_all_predictions()
        next_id = game['game_id'] + 1 if game['game_id'] < 999 else 1

        for strategy, picks in all_preds.items():
            self.predictions[strategy].append({
                'game_id': next_id,
                'date': game['date'],
                'picks': picks[:20]
            })

        self._save_predictions()
        self._save_scores()

        return {
            'game': game,
            'scores': scores_result,
            'predictions': all_preds
        }

    # ========== Display ==========

    def print_dashboard(self, result: Dict):
        """Print full dashboard."""
        game = result['game']
        scores = result['scores']
        preds = result['predictions']

        print(f"\n{'='*70}")
        print(f"GAME #{game['game_id']} | {game['date']} {game['time']}")
        print(f"{'='*70}")
        print(f"ACTUAL: {sorted(game['numbers'])[:10]}...")
        print(f"{'='*70}")

        # Show each strategy's performance and picks
        all_strategies = ['elimination', 'statistical', 'vacuum', 'deadzone', 'mirror',
                         'cluster', 'opposite_rc', 'decade', 'icebox', 'lonely7', 'arrow']

        for strategy in all_strategies:
            hits = scores.get(strategy)
            picks = preds.get(strategy, [])[:15]

            print(f"\n📊 {strategy.upper().ljust(15)} → ", end="")
            if hits is not None:
                print(f"{hits}/{len(preds.get(strategy, [1]))} hits")
            else:
                print(f"NEW prediction")

            print(f"   Picks: {picks}")

        print(f"\n{'='*70}")

    def print_strategy_summary(self):
        """Print summary of all strategy performance."""
        print(f"\n{'='*70}")
        print(f"STRATEGY PERFORMANCE SUMMARY")
        print(f"{'='*70}")

        all_strategies = ['elimination', 'statistical', 'vacuum', 'deadzone', 'mirror',
                         'cluster', 'opposite_rc', 'decade', 'icebox', 'lonely7', 'arrow']

        for strategy in all_strategies:
            scores_list = self.scores[strategy]
            if not scores_list:
                print(f"\n{strategy.upper()}: No scores yet")
                continue

            total_hits = sum(s['hits'] for s in scores_list)
            total_picks = sum(s['pick_count'] for s in scores_list)
            avg_hits = total_hits / len(scores_list) if scores_list else 0
            expected = total_picks * P_HIT / len(scores_list) if scores_list else 0

            print(f"\n{strategy.upper()}:")
            print(f"  Games: {len(scores_list)}")
            print(f"  Total hits: {total_hits}")
            print(f"  Avg hits/game: {avg_hits:.2f}")
            print(f"  Expected (random): {expected:.2f}")
            print(f"  vs Random: {avg_hits - expected:+.2f}")

            # Recent performance
            recent = scores_list[-10:]
            recent_avg = sum(s['hits'] for s in recent) / len(recent) if recent else 0
            print(f"  Last 10 avg: {recent_avg:.2f}")

        print(f"\n{'='*70}")

    # ========== Scraper ==========

    def get_current_game_id(self) -> Optional[int]:
        if not self.driver:
            return None
        try:
            self.driver.get(LIVE_URL)
            time.sleep(1) if 'time' in dir() else None
            import time as t
            t.sleep(1)
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            elem = soup.find('div', id='gameNumber')
            if elem:
                return int(elem.get_text(strip=True))
        except: pass
        return None

    def fetch_historical_games(self) -> List[Dict]:
        if not self.driver:
            return []
        import time

        games = []
        try:
            self.driver.get(HIST_URL)
            time.sleep(2)

            try:
                select = Select(self.driver.find_element(By.ID, 'numRecords'))
                select.select_by_value('25')
                time.sleep(2)
            except: pass

            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            links = soup.find_all('a', href=re.compile(r'index\.php\?id=\d+'))

            for link in links:
                try:
                    link_text = link.get_text(strip=True)
                    game_id_match = re.search(r'(\d+)', link_text)
                    if not game_id_match:
                        continue
                    game_id = int(game_id_match.group(1))

                    parent = link.parent
                    if not parent:
                        continue
                    row = parent.parent
                    if not row:
                        continue

                    row_text = row.get_text()
                    date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', row_text)
                    time_match = re.search(r'(\d{1,2}:\d{2}:\d{2})', row_text)

                    date = date_match.group(1) if date_match else ''
                    time_str = time_match.group(1) if time_match else ''

                    all_nums = re.findall(r'\b([1-9]|[1-7][0-9]|80)\b', row_text)
                    seen = set()
                    numbers = []
                    for n in all_nums:
                        num = int(n)
                        if num not in seen:
                            seen.add(num)
                            numbers.append(num)
                            if len(numbers) == 20:
                                break

                    if len(numbers) == 20:
                        unique_key = f"{game_id}_{date}"
                        if unique_key not in self.seen_games:
                            games.append({
                                'game_id': game_id,
                                'date': date,
                                'time': time_str,
                                'numbers': set(numbers),
                                'numbers_list': numbers
                            })
                            self.seen_games.add(unique_key)
                except: continue

        except Exception as e:
            print(f"  → Error: {e}")

        return games

    def run_once(self) -> bool:
        import time
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Checking...")

        current_id = self.get_current_game_id()
        if current_id:
            print(f"  Live: game #{current_id}")

        new_games = self.fetch_historical_games()

        if new_games:
            print(f"  Found {len(new_games)} new game(s)")

            for game in new_games:
                result = self.add_game(game)
                self.print_dashboard(result)

            self.print_strategy_summary()
            return True

        print(f"  No new games")
        return False

    def run(self, interval: int = POLL_INTERVAL):
        print("="*70)
        print("KENO MULTI-STRATEGY TRACKER")
        print("="*70)
        print(f"Tracking {len(self.games)} games across 5 strategies")
        print("Strategies: elimination, statistical, vacuum, deadzone, mirror")
        print(f"Poll interval: {interval}s")
        print("Press Ctrl+C to stop")
        print("="*70)

        try:
            while True:
                try:
                    self.run_once()
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    print(f"Error: {e}")

                print(f"Waiting {interval}s...")
                import time
                time.sleep(interval)
        except KeyboardInterrupt:
            print("\nStopping...")

        if self.driver:
            self.driver.quit()


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Keno Multi-Strategy Tracker")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--summary", action="store_true")
    parser.add_argument("--analyze", action="store_true", help="Run all analysis tools")
    parser.add_argument("--interval", type=int, default=POLL_INTERVAL)
    args = parser.parse_args()

    tracker = KenoMultiStrategy()

    if args.analyze:
        analyzer = KenoAnalyzer(tracker.games)
        analyzer.run_all_analyses()
    elif args.summary:
        tracker.print_strategy_summary()
    elif args.once:
        tracker.run_once()
    else:
        tracker.run(interval=args.interval)

    if tracker.driver:
        tracker.driver.quit()


if __name__ == "__main__":
    main()
