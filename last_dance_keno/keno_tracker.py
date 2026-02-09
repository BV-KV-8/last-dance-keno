#!/usr/bin/env python3
"""
Keno Number Tracker with Elimination Rules

Tracks games, applies elimination rules, scores predictions.
Uses game_id + date as unique key to handle 1-999 cycle.
"""

import csv
import json
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Set, Optional, Tuple
from collections import Counter
import copy

# Configuration
OUTPUT_DIR = Path("keno_data")
GAMES_CSV = OUTPUT_DIR / "games.csv"
STATE_FILE = OUTPUT_DIR / "tracker_state.json"
PREDICTIONS_CSV = OUTPUT_DIR / "predictions.csv"
SCORES_CSV = OUTPUT_DIR / "scores.csv"

# Keno board layout (10 columns x 8 rows)
# 1  2  3  4  5  6  7  8  9  10
# 11 12 13 14 15 16 17 18 19 20
# ... up to 80

def get_row(num: int) -> int:
    """Get row (1-8) for a number."""
    return (num - 1) // 10 + 1

def get_col(num: int) -> int:
    """Get column (1-10) for a number."""
    return (num - 1) % 10 + 1

def get_neighbors(num: int) -> Set[int]:
    """Get touching neighbors (including diagonals)."""
    row = get_row(num)
    col = get_col(num)
    neighbors = set()

    for r in range(max(1, row - 1), min(8, row + 1) + 1):
        for c in range(max(1, col - 1), min(10, col + 1) + 1):
            neighbor = (r - 1) * 10 + c
            if neighbor != num and 1 <= neighbor <= 80:
                neighbors.add(neighbor)

    return neighbors


class KenoTracker:
    """Track Keno games and apply elimination rules."""

    def __init__(self):
        self.output_dir = OUTPUT_DIR
        self.output_dir.mkdir(exist_ok=True)

        self.games: List[Dict] = []
        self.predictions: List[Dict] = []
        self.scores: List[Dict] = []

        self._load_games()
        self._load_predictions()
        self._load_scores()

    def _load_games(self):
        """Load games from CSV."""
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
            # Sort by game ID descending (most recent first)
            self.games.sort(key=lambda g: g['game_id'], reverse=True)

    def _load_predictions(self):
        """Load predictions from CSV."""
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

    def _load_scores(self):
        """Load scores from CSV."""
        if SCORES_CSV.exists():
            with open(SCORES_CSV, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.scores.append({
                        'game_id': int(row['game_id']),
                        'hits': int(row['hits']),
                        'playable_count': int(row['playable_count']),
                    })

    def _save_predictions(self):
        """Save predictions to CSV."""
        with open(PREDICTIONS_CSV, 'w', newline='') as f:
            if self.predictions:
                fieldnames = ['game_id', 'date', 'playable_numbers', 'removed_count']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for pred in self.predictions:
                    writer.writerow({
                        'game_id': pred['game_id'],
                        'date': pred['date'],
                        'playable_numbers': ','.join(map(str, pred['playable_numbers'])),
                        'removed_count': pred['removed_count'],
                    })

    def _save_scores(self):
        """Save scores to CSV."""
        with open(SCORES_CSV, 'w', newline='') as f:
            if self.scores:
                fieldnames = ['game_id', 'hits', 'playable_count']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for score in self.scores:
                    writer.writerow(score)

    def add_game(self, game_id: int, date: str, time: str, numbers: List[int]) -> bool:
        """Add a new game. Returns True if it was new."""
        unique_key = f"{game_id}_{date}"

        # Check if already exists
        for game in self.games:
            if game['unique_key'] == unique_key:
                return False

        self.games.append({
            'game_id': game_id,
            'date': date,
            'time': time,
            'numbers': numbers,
            'unique_key': unique_key
        })

        # Re-sort
        self.games.sort(key=lambda g: g['game_id'], reverse=True)

        # Append to CSV
        file_exists = GAMES_CSV.exists()
        with open(GAMES_CSV, 'a', newline='') as f:
            writer = csv.writer(f)
            if not file_exists:
                header = ['game_id', 'date', 'time'] + [f'number_{i}' for i in range(1, 21)]
                writer.writerow(header)
            row = [game_id, date, time] + numbers
            writer.writerow(row)

        return True

    def calculate_hits(self, num: int, last_n: int) -> int:
        """Count how many times num hit in last_n games."""
        count = 0
        for i in range(min(last_n, len(self.games))):
            if num in self.games[i]['numbers']:
                count += 1
        return count

    def hit_in_last_n_games(self, num: int, last_n: int) -> bool:
        """Check if num hit in any of the last_n games."""
        for i in range(min(last_n, len(self.games))):
            if num in self.games[i]['numbers']:
                return True
        return False

    def hit_in_specific_games(self, num: int, positions: List[int]) -> bool:
        """Check if num hit in specific positions (1=last, 2=2nd last, etc.)."""
        for pos in positions:
            if pos <= len(self.games) and num in self.games[pos - 1]['numbers']:
                return True
        return False

    def hit_count_in_specific_games(self, num: int, positions: List[int]) -> int:
        """Count hits in specific positions."""
        count = 0
        for pos in positions:
            if pos <= len(self.games) and num in self.games[pos - 1]['numbers']:
                count += 1
        return count

    def has_touching_neighbor_hit(self, num: int, game_position: int = 1) -> bool:
        """Check if any touching neighbor hit in the specified game (1=last)."""
        if game_position > len(self.games):
            return False

        drawn = set(self.games[game_position - 1]['numbers'])
        neighbors = get_neighbors(num)
        return bool(neighbors & drawn)

    def get_row_col_hits(self, game_position: int = 1) -> Tuple[Dict[int, int], Dict[int, int]]:
        """Get row and column hit counts for a specific game."""
        if game_position > len(self.games):
            return {}, {}

        drawn = self.games[game_position - 1]['numbers']
        row_hits = Counter(get_row(n) for n in drawn)
        col_hits = Counter(get_col(n) for n in drawn)

        return dict(row_hits), dict(col_hits)

    def is_row_col_hot(self, num: int, last_n: int = 3, threshold: int = 4) -> bool:
        """Check if num's row or column had threshold+ hits in any of last_n games."""
        num_row = get_row(num)
        num_col = get_col(num)

        for i in range(min(last_n, len(self.games))):
            row_hits, col_hits = self.get_row_col_hits(i + 1)
            if row_hits.get(num_row, 0) >= threshold or col_hits.get(num_col, 0) >= threshold:
                return True
        return False

    def get_playable_numbers(self) -> List[int]:
        """Apply all elimination rules and return playable numbers."""
        if not self.games:
            return list(range(1, 81))

        numbers_data = []

        for num in range(1, 81):
            remove_reasons = []

            # Hits in last 10, 50
            hits_last_10 = self.calculate_hits(num, 10)
            hits_last_50 = self.calculate_hits(num, 50) if len(self.games) >= 50 else self.calculate_hits(num, len(self.games))

            # Rule: Hit last 2 games? → eliminate
            if self.hit_in_specific_games(num, [1, 2]):
                remove_reasons.append('hit_last_2')

            # Rule: Hit 2 of last 3? → eliminate
            if self.hit_count_in_specific_games(num, [1, 2, 3]) >= 2:
                remove_reasons.append('hit_2_of_3')

            # Rule: Hit 4 of last 8? → eliminate
            if self.hit_count_in_specific_games(num, list(range(1, 9))) >= 4:
                remove_reasons.append('hit_4_of_8')

            # Rule: Hit 6 of last 10? → eliminate
            if hits_last_10 >= 6:
                remove_reasons.append('hit_6_of_10')

            # Rule: Hit in last + 3rd back + 4th back (pattern)? → eliminate
            if self.hit_in_specific_games(num, [1, 3, 4]):
                remove_reasons.append('pattern_1_3_4')

            # Rule: Row/Col hot (4+ hits in any of last 3 games)? → eliminate
            if self.is_row_col_hot(num, last_n=3, threshold=4):
                remove_reasons.append('row_col_hot')

            # Rule: Has touching neighbor hit last game? → eliminate
            if not self.has_touching_neighbor_hit(num, 1):
                remove_reasons.append('no_neighbor_hit')

            numbers_data.append({
                'number': num,
                'hits_last_10': hits_last_10,
                'hits_last_50': hits_last_50,
                'remove': len(remove_reasons) > 0,
                'reasons': remove_reasons
            })

        # Filter out removed numbers
        playable = [n for n in numbers_data if not n['remove']]

        # Sort: hits_last_50 DESC, then hits_last_10 ASC
        playable.sort(key=lambda x: (-x['hits_last_50'], x['hits_last_10']))

        return [n['number'] for n in playable]

    def generate_prediction_for_game(self, game_id: int, date: str) -> List[int]:
        """Generate prediction for a game (without including that game)."""
        # Temporarily remove this game if it exists
        temp_games = self.games.copy()
        self.games = [g for g in self.games if g['game_id'] != game_id]

        playable = self.get_playable_numbers()

        # Restore games
        self.games = temp_games

        # Store prediction
        self.predictions.append({
            'game_id': game_id,
            'date': date,
            'playable_numbers': playable[:20],  # Top 20
            'removed_count': 80 - len(playable)
        })

        self._save_predictions()
        return playable[:20]

    def score_prediction(self, game_id: int) -> Optional[Dict]:
        """Score a prediction against actual results."""
        # Find the prediction
        prediction = None
        for p in self.predictions:
            if p['game_id'] == game_id:
                prediction = p
                break

        if not prediction:
            return None

        # Find the game
        game = None
        for g in self.games:
            if g['game_id'] == game_id:
                game = g
                break

        if not game:
            return None

        # Calculate hits
        predicted = set(prediction['playable_numbers'])
        actual = set(game['numbers'])
        hits = len(predicted & actual)

        hit_numbers = sorted(predicted & actual)

        score = {
            'game_id': game_id,
            'hits': hits,
            'playable_count': len(prediction['playable_numbers']),
            'hit_numbers': hit_numbers,
            'predicted': prediction['playable_numbers'],
            'actual': game['numbers']
        }

        self.scores.append({
            'game_id': game_id,
            'hits': hits,
            'playable_count': len(prediction['playable_numbers'])
        })

        self._save_scores()
        return score

    def process_new_game(self, game_id: int, date: str, time: str, numbers: List[int]) -> Dict:
        """Process a new game: score previous prediction, add game, generate new prediction."""

        # First, score the prediction for this game (if we have previous games)
        result = {
            'game_id': game_id,
            'is_new': False,
            'score': None,
            'playable_numbers': [],
            'removed_count': 0
        }

        # Check if this is a new game
        result['is_new'] = self.add_game(game_id, date, time, numbers)

        if result['is_new'] and len(self.games) > 1:
            # Score the prediction that would have been made for this game
            # (based on games before this one)
            score = self.score_prediction(game_id)
            result['score'] = score

        # Generate prediction for NEXT game
        playable = self.get_playable_numbers()
        result['playable_numbers'] = playable[:20]
        result['removed_count'] = 80 - len(playable)

        # Store the prediction
        self.predictions.append({
            'game_id': game_id + 1 if game_id < 999 else 1,  # Next game ID
            'date': date,
            'playable_numbers': playable[:20],
            'removed_count': 80 - len(playable)
        })
        self._save_predictions()

        return result

    def print_status(self):
        """Print current status."""
        print(f"\n{'='*60}")
        print(f"KENO TRACKER STATUS")
        print(f"{'='*60}")
        print(f"Games tracked: {len(self.games)}")

        if self.games:
            print(f"Most recent: Game #{self.games[0]['game_id']} ({self.games[0]['date']} {self.games[0]['time']})")
            if len(self.games) > 1:
                print(f"Oldest: Game #{self.games[-1]['game_id']} ({self.games[-1]['date']})")

        # Get current playable numbers
        playable = self.get_playable_numbers()
        removed = 80 - len(playable)

        print(f"\nNumbers eliminated: {removed}")
        print(f"Playable numbers: {len(playable)}")

        print(f"\nTop 20 numbers to play:")
        for i, num in enumerate(playable[:20], 1):
            hits_50 = self.calculate_hits(num, 50)
            hits_10 = self.calculate_hits(num, 10)
            print(f"  {i:2}. {num:2} → hits(50):{hits_50:2} hits(10):{hits_10}")

        # Print recent scores
        if self.scores:
            print(f"\nRecent scores (last 10):")
            for score in self.scores[-10:]:
                print(f"  Game #{score['game_id']}: {score['hits']}/{score['playable_count']} hits")

        print(f"{'='*60}\n")

    def print_number_analysis(self, num: int):
        """Print detailed analysis for a single number."""
        print(f"\n--- Analysis for Number {num} ---")
        print(f"Row: {get_row(num)}, Column: {get_col(num)}")
        print(f"Neighbors: {sorted(get_neighbors(num))}")
        print(f"Hits last 10: {self.calculate_hits(num, 10)}")
        print(f"Hits last 50: {self.calculate_hits(num, 50)}")

        # Check each rule
        rules = []

        if self.hit_in_specific_games(num, [1, 2]):
            rules.append("❌ Hit in last 2 games")
        if self.hit_count_in_specific_games(num, [1, 2, 3]) >= 2:
            rules.append("❌ Hit 2 of last 3")
        if self.hit_count_in_specific_games(num, list(range(1, 9))) >= 4:
            rules.append("❌ Hit 4 of last 8")
        if self.calculate_hits(num, 10) >= 6:
            rules.append("❌ Hit 6 of last 10")
        if self.hit_in_specific_games(num, [1, 3, 4]):
            rules.append("❌ Hit pattern (1st, 3rd, 4th)")
        if self.is_row_col_hot(num, last_n=3, threshold=4):
            rules.append("❌ Row/Col hot (4+ in last 3)")
        if not self.has_touching_neighbor_hit(num, 1):
            rules.append("❌ No touching neighbor hit last game")

        if not rules:
            rules.append("✅ PLAYABLE")

        for rule in rules:
            print(f"  {rule}")

        # Show recent hit history
        print(f"\nRecent history (last 20 games):")
        for i in range(min(20, len(self.games))):
            game = self.games[i]
            hit = "✓" if num in game['numbers'] else "·"
            print(f"  {hit} #{game['game_id']} ({game['date']})")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Keno Tracker")
    parser.add_argument("--status", action="store_true", help="Show current status")
    parser.add_argument("--analyze", type=int, metavar="N", help="Analyze specific number")
    parser.add_argument("--playable", action="store_true", help="Show playable numbers")
    parser.add_argument("--add", nargs=4, metavar=("ID", "DATE", "TIME", "NUMBERS"),
                       help="Add a game: ID DATE TIME NUMBERS (comma-separated)")
    parser.add_argument("--load-csv", action="store_true", help="Load games from CSV and show status")
    parser.add_argument("--score", type=int, metavar="ID", help="Score prediction for game ID")

    args = parser.parse_args()

    tracker = KenoTracker()

    if args.status:
        tracker.print_status()

    elif args.analyze:
        tracker.print_number_analysis(args.analyze)

    elif args.playable:
        playable = tracker.get_playable_numbers()
        print(f"\nPlayable numbers ({len(playable)}):")
        print(playable[:20])  # Top 20

    elif args.add:
        game_id = int(args.add[0])
        date = args.add[1]
        time = args.add[2]
        numbers = [int(x) for x in args.add[3].split(',')]

        result = tracker.process_new_game(game_id, date, time, numbers)

        print(f"\nGame #{game_id}:")
        print(f"  New: {result['is_new']}")
        if result['score']:
            print(f"  Previous prediction hits: {result['score']['hits']}/{result['score']['playable_count']}")
            print(f"  Hit numbers: {result['score']['hit_numbers']}")

        print(f"\nNext prediction (top 20):")
        print(f"  {result['playable_numbers']}")
        print(f"\nNumbers eliminated: {result['removed_count']}")

    elif args.load_csv:
        tracker.print_status()

    elif args.score:
        score = tracker.score_prediction(args.score)
        if score:
            print(f"\nScore for game #{args.score}:")
            print(f"  Hits: {score['hits']}/{score['playable_count']}")
            print(f"  Hit numbers: {score['hit_numbers']}")
            print(f"  Predicted: {score['predicted']}")
            print(f"  Actual: {score['actual']}")
        else:
            print(f"No prediction found for game #{args.score}")

    else:
        tracker.print_status()


if __name__ == "__main__":
    main()
