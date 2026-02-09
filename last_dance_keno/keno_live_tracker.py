#!/usr/bin/env python3
"""
Integrated Keno Scraper + Tracker

Scrapes live games and applies elimination rules in real-time.
Every 15 seconds:
1. Checks for new games
2. Scores previous prediction against actual result
3. Generates new prediction for next game
"""

import time
import csv
import json
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Set, Optional, Tuple
from collections import Counter

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
GAMES_CSV = OUTPUT_DIR / "games.csv"
STATE_FILE = OUTPUT_DIR / "scraper_state.json"
PREDICTIONS_CSV = OUTPUT_DIR / "predictions.csv"
SCORES_CSV = OUTPUT_DIR / "scores.csv"

# Board layout helpers
def get_row(num: int) -> int:
    return (num - 1) // 10 + 1

def get_col(num: int) -> int:
    return (num - 1) % 10 + 1

def get_neighbors(num: int) -> Set[int]:
    row = get_row(num)
    col = get_col(num)
    neighbors = set()
    for r in range(max(1, row - 1), min(8, row + 1) + 1):
        for c in range(max(1, col - 1), min(10, col + 1) + 1):
            neighbor = (r - 1) * 10 + c
            if neighbor != num and 1 <= neighbor <= 80:
                neighbors.add(neighbor)
    return neighbors


class KenoLiveTracker:
    """Live Keno tracker with elimination rules."""

    def __init__(self):
        self.output_dir = OUTPUT_DIR
        self.output_dir.mkdir(exist_ok=True)

        # Load state
        self.state = self._load_state()
        self.last_game_id = self.state.get("last_game_id", 0)
        self.seen_games: Set[str] = set(self.state.get("seen_games", []))

        # Load games
        self.games: List[Dict] = []
        self.predictions: List[Dict] = []
        self.scores: List[Dict] = []
        self._load_data()

        # Initialize Selenium
        self.driver = None
        if HAS_SELENIUM:
            self._init_driver()

    def _load_state(self) -> Dict:
        if STATE_FILE.exists():
            try:
                with open(STATE_FILE) as f:
                    return json.load(f)
            except:
                pass
        return {"last_game_id": 0, "seen_games": []}

    def _save_state(self):
        self.state["last_game_id"] = self.last_game_id
        self.state["seen_games"] = list(self.seen_games)
        with open(STATE_FILE, 'w') as f:
            json.dump(self.state, f)

    def _load_data(self):
        """Load games, predictions, scores."""
        # Load games
        if GAMES_CSV.exists():
            with open(GAMES_CSV, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    numbers = [int(row[f'number_{i}']) for i in range(1, 21)]
                    self.games.append({
                        'game_id': int(row['game_id']),
                        'date': row['date'],
                        'time': row['time'],
                        'numbers': numbers,
                        'unique_key': f"{row['game_id']}_{row['date']}"
                    })
            self.games.sort(key=lambda g: (g['date'], g['game_id']), reverse=True)

        # Load predictions
        if PREDICTIONS_CSV.exists():
            with open(PREDICTIONS_CSV, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.predictions.append({
                        'game_id': int(row['game_id']),
                        'date': row['date'],
                        'playable_numbers': [int(x) for x in row['playable_numbers'].split(',')],
                        'removed_count': int(row['removed_count']),
                    })

        # Load scores
        if SCORES_CSV.exists():
            with open(SCORES_CSV, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.scores.append({
                        'game_id': int(row['game_id']),
                        'hits': int(row['hits']),
                        'playable_count': int(row['playable_count']),
                    })

    def _init_driver(self):
        try:
            options = ChromeOptions()
            options.add_argument('--headless')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            self.driver = webdriver.Chrome(options=options)
            self.driver.set_page_load_timeout(30)
            print("✓ Selenium driver initialized")
        except Exception as e:
            print(f"Warning: Could not initialize Selenium: {e}")

    # ========== ELIMINATION RULES ==========

    def _hits_in_n(self, num: int, n: int) -> int:
        count = 0
        for i in range(min(n, len(self.games))):
            if num in self.games[i]['numbers']:
                count += 1
        return count

    def _hit_in_positions(self, num: int, positions: List[int]) -> bool:
        for pos in positions:
            if pos <= len(self.games) and num in self.games[pos - 1]['numbers']:
                return True
        return False

    def _hit_count_positions(self, num: int, positions: List[int]) -> int:
        count = 0
        for pos in positions:
            if pos <= len(self.games) and num in self.games[pos - 1]['numbers']:
                count += 1
        return count

    def _has_neighbor_hit(self, num: int, position: int = 1) -> bool:
        if position > len(self.games):
            return False
        drawn = set(self.games[position - 1]['numbers'])
        return bool(get_neighbors(num) & drawn)

    def _is_row_col_hot(self, num: int, last_n: int = 3, threshold: int = 4) -> bool:
        num_row, num_col = get_row(num), get_col(num)
        for i in range(min(last_n, len(self.games))):
            drawn = self.games[i]['numbers']
            row_hits = sum(1 for n in drawn if get_row(n) == num_row)
            col_hits = sum(1 for n in drawn if get_col(n) == num_col)
            if row_hits >= threshold or col_hits >= threshold:
                return True
        return False

    def get_playable_numbers(self) -> Tuple[List[int], Dict[int, List[str]]]:
        """Apply elimination rules. Returns (playable_numbers, remove_reasons)."""
        remove_reasons = {}

        if not self.games:
            return list(range(1, 81)), remove_reasons

        for num in range(1, 81):
            reasons = []

            if self._hit_in_positions(num, [1, 2]):
                reasons.append('last2')

            if self._hit_count_positions(num, [1, 2, 3]) >= 2:
                reasons.append('2of3')

            if self._hit_count_positions(num, list(range(1, 9))) >= 4:
                reasons.append('4of8')

            if self._hits_in_n(num, 10) >= 6:
                reasons.append('6of10')

            if self._hit_in_positions(num, [1, 3, 4]):
                reasons.append('pattern134')

            if self._is_row_col_hot(num, 3, 4):
                reasons.append('rowcol_hot')

            if not self._has_neighbor_hit(num, 1):
                reasons.append('no_neighbor')

            if reasons:
                remove_reasons[num] = reasons

        # Analyze remaining numbers
        numbers_data = []
        for num in range(1, 81):
            if num not in remove_reasons:
                numbers_data.append({
                    'num': num,
                    'hits50': self._hits_in_n(num, 50),
                    'hits10': self._hits_in_n(num, 10),
                })

        # Sort: hits50 DESC, hits10 ASC
        numbers_data.sort(key=lambda x: (-x['hits50'], x['hits10']))
        playable = [n['num'] for n in numbers_data]

        return playable, remove_reasons

    # ========== SCRAPER ==========

    def get_current_game_id(self) -> Optional[int]:
        if not self.driver:
            return None
        try:
            self.driver.get(LIVE_URL)
            time.sleep(1)
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            elem = soup.find('div', id='gameNumber')
            if elem:
                return int(elem.get_text(strip=True))
        except:
            pass
        return None

    def fetch_historical_games(self) -> List[Dict]:
        """Fetch new games from historical page."""
        if not self.driver:
            return []

        games = []
        try:
            self.driver.get(HIST_URL)
            time.sleep(2)

            try:
                select = Select(self.driver.find_element(By.ID, 'numRecords'))
                select.select_by_value('25')
                time.sleep(2)
            except:
                pass

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

                    date = date_match.group(1) if date_match else datetime.now().strftime('%m/%d/%y')
                    time_str = time_match.group(1) if time_match else datetime.now().strftime('%H:%M:%S')

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
                                'numbers': sorted(numbers),
                                'unique_key': unique_key
                            })
                            self.seen_games.add(unique_key)
                except:
                    continue

        except Exception as e:
            print(f"  → Error fetching: {e}")

        return games

    # ========== GAME PROCESSING ==========

    def add_game(self, game: Dict):
        """Add a game to storage."""
        self.games.insert(0, game)  # Add at beginning (most recent)

        # Append to CSV
        file_exists = GAMES_CSV.exists()
        with open(GAMES_CSV, 'a', newline='') as f:
            writer = csv.writer(f)
            if not file_exists:
                header = ['game_id', 'date', 'time'] + [f'number_{i}' for i in range(1, 21)]
                writer.writerow(header)
            writer.writerow([game['game_id'], game['date'], game['time']] + game['numbers'])

        if game['game_id'] > self.last_game_id:
            self.last_game_id = game['game_id']
        self._save_state()

    def score_last_prediction(self, actual_game: Dict) -> Optional[Dict]:
        """Score the prediction for this game."""
        game_id = actual_game['game_id']

        # Find if we had a prediction
        prediction = None
        for p in self.predictions:
            if p['game_id'] == game_id and p['date'] == actual_game['date']:
                prediction = p
                break

        if not prediction:
            return None

        predicted = set(prediction['playable_numbers'])
        actual = set(actual_game['numbers'])
        hits = len(predicted & actual)
        hit_numbers = sorted(predicted & actual)

        score = {
            'game_id': game_id,
            'date': actual_game['date'],
            'hits': hits,
            'playable_count': len(prediction['playable_numbers']),
            'hit_numbers': hit_numbers,
        }

        self.scores.append(score)

        # Save scores
        with open(SCORES_CSV, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['game_id', 'hits', 'playable_count'])
            writer.writeheader()
            for s in self.scores:
                writer.writerow({'game_id': s['game_id'], 'hits': s['hits'], 'playable_count': s['playable_count']})

        return score

    def save_prediction(self, game_id: int, date: str, playable: List[int], removed_count: int):
        """Save a prediction."""
        self.predictions.append({
            'game_id': game_id,
            'date': date,
            'playable_numbers': playable[:20],
            'removed_count': removed_count,
        })

        with open(PREDICTIONS_CSV, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['game_id', 'date', 'playable_numbers', 'removed_count'])
            writer.writeheader()
            for p in self.predictions:
                writer.writerow(p)

    def process_new_games(self, new_games: List[Dict]) -> List[Dict]:
        """Process new games and return results."""
        results = []

        for game in new_games:
            # First, score any prediction for this game
            score = self.score_last_prediction(game)

            # Add the game
            self.add_game(game)

            # Generate prediction for next game
            playable, remove_reasons = self.get_playable_numbers()

            next_id = game['game_id'] + 1 if game['game_id'] < 999 else 1
            self.save_prediction(next_id, game['date'], playable, len(remove_reasons))

            results.append({
                'game': game,
                'score': score,
                'next_prediction': playable[:20],
                'removed_count': len(remove_reasons),
                'remove_reasons': remove_reasons,
            })

        return results

    # ========== DISPLAY ==========

    def print_results(self, results: List[Dict]):
        for r in results:
            game = r['game']
            print(f"\n{'='*50}")
            print(f"GAME #{game['game_id']} ({game['date']} {game['time']})")
            print(f"Drawn: {game['numbers'][:10]}...")

            if r['score']:
                s = r['score']
                print(f"\n📊 Previous Prediction Score: {s['hits']}/{s['playable_count']} hits")
                if s['hit_numbers']:
                    print(f"   ✅ Hit numbers: {s['hit_numbers']}")

            print(f"\n📋 Numbers Eliminated: {r['removed_count']}")
            print(f"🎯 PLAYABLE NUMBERS (top 20):")
            for i, num in enumerate(r['next_prediction'], 1):
                hits50 = self._hits_in_n(num, 50)
                hits10 = self._hits_in_n(num, 10)
                print(f"   {i:2}. {num:2} → 50-game hits: {hits50:2}, 10-game hits: {hits10}")

            print(f"{'='*50}")

    def run_once(self) -> bool:
        """Run one check cycle. Returns True if new games found."""
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Checking...")

        current_id = self.get_current_game_id()
        if current_id:
            print(f"  Live page: game #{current_id}")

        new_games = self.fetch_historical_games()

        if new_games:
            print(f"  Found {len(new_games)} new game(s)")
            results = self.process_new_games(new_games)
            self.print_results(results)
            return True
        else:
            print(f"  No new games")
            return False

    def run(self, interval: int = POLL_INTERVAL):
        print("="*60)
        print("KENO LIVE TRACKER")
        print("="*60)
        print(f"Tracking {len(self.games)} games")
        print(f"Last game ID: {self.last_game_id}")
        print(f"Poll interval: {interval}s")
        print("Press Ctrl+C to stop")
        print("="*60)

        try:
            while True:
                try:
                    self.run_once()
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    print(f"Error: {e}")

                print(f"Waiting {interval}s...")
                time.sleep(interval)
        except KeyboardInterrupt:
            print("\nStopping...")

        if self.driver:
            self.driver.quit()


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Keno Live Tracker")
    parser.add_argument("--once", action="store_true", help="Run once")
    parser.add_argument("--interval", type=int, default=POLL_INTERVAL)
    args = parser.parse_args()

    tracker = KenoLiveTracker()

    if args.once:
        tracker.run_once()
    else:
        tracker.run(interval=args.interval)

    if tracker.driver:
        tracker.driver.quit()


if __name__ == "__main__":
    main()
