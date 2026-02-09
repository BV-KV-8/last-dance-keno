#!/usr/bin/env python3
"""
Hybrid Game Data Source for Keno Duel

Primary: Local games.csv (from scraper.py)
Fallback: Manual entry
Optional: KenoUSA.com (JavaScript-rendered, may not work)
"""

import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict
import json


class HybridGameSource:
    """Hybrid source for Keno game data."""

    def __init__(self):
        self.games_path = Path("games/games.csv")
        self.state_path = Path("keno_data/source_state.json")
        self.state = self._load_state()
        self.games_df = self._load_games()

    def _load_state(self) -> Dict:
        """Load source state."""
        if self.state_path.exists():
            try:
                with open(self.state_path) as f:
                    return json.load(f)
            except:
                pass
        return {'last_game_id': 0, 'manual_entries': []}

    def _save_state(self):
        """Save source state."""
        with open(self.state_path, 'w') as f:
            json.dump(self.state, f)

    def _load_games(self) -> pd.DataFrame:
        """Load games from CSV."""
        if self.games_path.exists():
            try:
                df = pd.read_csv(self.games_path, low_memory=False)
                df['datetime'] = pd.to_datetime(
                    df['date'] + ' ' + df['time'],
                    format='%m/%d/%y %H:%M:%S',
                    errors='coerce'
                )
                return df.sort_values('datetime')
            except Exception as e:
                print(f"Error loading games: {e}")
        return pd.DataFrame()

    def get_latest_game(self) -> Optional[Dict]:
        """Get the latest game from local data."""
        if self.games_df.empty:
            return None

        latest = self.games_df.iloc[-1]
        game_id = int(latest['game_id'])

        # Extract drawn numbers
        drawn = []
        for i in range(1, 21):
            try:
                num = int(latest[f'number_{i}'])
                drawn.append(num)
            except:
                pass

        if len(drawn) != 20:
            return None

        return {
            'game_id': game_id,
            'drawn': sorted(drawn),
            'date': latest['date'],
            'time': latest['time'],
            'timestamp': latest.get('datetime', datetime.now()).isoformat()
        }

    def get_new_games_since(self, last_game_id: int) -> List[Dict]:
        """Get all games since the last processed game."""
        if self.games_df.empty:
            return []

        new_games = []
        for _, row in self.games_df.iterrows():
            game_id = int(row['game_id'])
            if game_id > last_game_id:
                drawn = []
                for i in range(1, 21):
                    try:
                        drawn.append(int(row[f'number_{i}']))
                    except:
                        pass

                if len(drawn) == 20:
                    new_games.append({
                        'game_id': game_id,
                        'drawn': sorted(drawn),
                        'date': row['date'],
                        'time': row['time']
                    })

        return new_games

    def add_manual_game(self, game_id: int, drawn: List[int]) -> bool:
        """Manually add a game result."""
        if len(drawn) != 20:
            print("Error: Must have exactly 20 numbers")
            return False

        if not all(1 <= n <= 80 for n in drawn):
            print("Error: All numbers must be between 1-80")
            return False

        # Record in state
        self.state['manual_entries'].append({
            'game_id': game_id,
            'drawn': sorted(drawn),
            'timestamp': datetime.now().isoformat()
        })
        self._save_state()

        return True

    def get_manual_game(self, game_id: int) -> Optional[Dict]:
        """Get a manually entered game."""
        for entry in self.state.get('manual_entries', []):
            if entry['game_id'] == game_id:
                return entry
        return None

    def check_for_updates(self) -> List[Dict]:
        """Check for new games since last check."""
        if self.games_df.empty:
            return []

        latest_id = int(self.games_df.iloc[-1]['game_id'])
        last_id = self.state.get('last_game_id', 0)

        if latest_id > last_id:
            new_games = self.get_new_games_since(last_id)
            self.state['last_game_id'] = latest_id
            self._save_state()
            return new_games

        return []


def main():
    """CLI for game source."""
    import argparse

    parser = argparse.ArgumentParser(description="Hybrid Game Source")
    parser.add_argument("--latest", action="store_true", help="Show latest game")
    parser.add_argument("--add", type=int, help="Manually add game ID")
    parser.add_argument("--numbers", type=str, help="Comma-separated drawn numbers")
    parser.add_argument("--check", action="store_true", help="Check for new games")
    parser.add_argument("--since", type=int, help="Get games since ID")

    args = parser.parse_args()

    source = HybridGameSource()

    if args.latest:
        game = source.get_latest_game()
        if game:
            print(f"\nLatest Game: #{game['game_id']}")
            print(f"Date: {game['date']} {game['time']}")
            print(f"Drawn: {game['drawn']}")
        else:
            print("No games available")

    elif args.add and args.numbers:
        drawn = [int(x.strip()) for x in args.numbers.split(',')]
        if source.add_manual_game(args.add, drawn):
            print(f"Added game #{args.add}: {drawn}")

    elif args.check:
        new_games = source.check_for_updates()
        if new_games:
            print(f"\n{len(new_games)} new game(s):")
            for game in new_games:
                print(f"  #{game['game_id']}: {game['drawn']}")
        else:
            print("No new games")

    elif args.since:
        games = source.get_new_games_since(args.since)
        print(f"\n{len(games)} game(s) since #{args.since}:")
        for game in games:
            print(f"  #{game['game_id']} ({game['date']} {game['time']}): {game['drawn']}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
