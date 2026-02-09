#!/usr/bin/env python3
"""
Simple Keno Scraper - Historical Deep Fetch

Monitors Casino Arizona McKellips Keno games:
- Live page: https://kenousa.com/games/CasinoArizona/McKellips/ (for current game ID)
- Historical: https://kenousa.com/games/CasinoArizona/McKellips/draws.php (for draw data)

Polls every 15 seconds for new draws.
Can fetch 1000+ historical games using pagination.
Uses game_id + date as unique key to handle 1-999 ID cycle.
"""

import time
import csv
import json
import re
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Set

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False
    print("Warning: beautifulsoup4 not installed.")

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.webdriver.support.ui import Select
    HAS_SELENIUM = True
except ImportError:
    HAS_SELENIUM = False
    print("Warning: selenium not installed.")


# Configuration
LIVE_URL = "https://kenousa.com/games/CasinoArizona/McKellips/"
HIST_URL = "https://kenousa.com/games/CasinoArizona/McKellips/draws.php"
POLL_INTERVAL = 15  # seconds
OUTPUT_DIR = Path("keno_data")
GAMES_CSV = OUTPUT_DIR / "games.csv"
STATE_FILE = OUTPUT_DIR / "scraper_state.json"


class SimpleKenoScraper:
    """Simple Keno game scraper."""

    def __init__(self):
        self.output_dir = OUTPUT_DIR
        self.output_dir.mkdir(exist_ok=True)

        self.state = self._load_state()
        self.last_game_id = self.state.get("last_game_id", 0)

        # Load seen games - uses game_id + date as unique key to handle 1-999 cycle
        seen_list = self.state.get("seen_games", [])
        self.seen_games: Set[str] = set(seen_list)

        # Initialize Selenium driver
        self.driver = None
        if HAS_SELENIUM:
            self._init_driver()

    def _load_state(self) -> Dict:
        """Load scraper state from disk."""
        if STATE_FILE.exists():
            try:
                with open(STATE_FILE) as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading state: {e}")
        return {"last_game_id": 0, "seen_games": []}

    def _save_state(self):
        """Save scraper state to disk."""
        self.state["last_game_id"] = self.last_game_id
        self.state["seen_games"] = list(self.seen_games)
        self.state["last_updated"] = datetime.now().isoformat()
        with open(STATE_FILE, 'w') as f:
            json.dump(self.state, f, indent=2)

    def _init_driver(self):
        """Initialize Selenium Chrome driver."""
        try:
            options = ChromeOptions()
            options.add_argument('--headless')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')

            self.driver = webdriver.Chrome(options=options)
            self.driver.set_page_load_timeout(30)
            print("✓ Selenium driver initialized")
        except Exception as e:
            print(f"Warning: Could not initialize Selenium: {e}")
            self.driver = None

    def _write_game_to_csv(self, game: Dict):
        """Append a game to the CSV file."""
        file_exists = GAMES_CSV.exists()

        with open(GAMES_CSV, 'a', newline='') as f:
            writer = csv.writer(f)

            # Write header if new file
            if not file_exists:
                header = ['game_id', 'date', 'time'] + [f'number_{i}' for i in range(1, 21)]
                writer.writerow(header)

            # Write game data
            row = [
                game['game_id'],
                game.get('date', datetime.now().strftime('%m/%d/%y')),
                game.get('time', datetime.now().strftime('%H:%M:%S'))
            ]
            row.extend(game['numbers'])
            writer.writerow(row)

    def get_current_game_id(self) -> Optional[int]:
        """Get the current game ID from the live page."""
        if not HAS_SELENIUM or not self.driver:
            return None

        try:
            self.driver.get(LIVE_URL)
            time.sleep(1)

            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            game_num_elem = soup.find('div', id='gameNumber')

            if game_num_elem:
                return int(game_num_elem.get_text(strip=True))
        except Exception as e:
            print(f"  → Error getting current game ID: {e}")

        return None

    def _parse_historical_entry(self, link_element) -> Optional[Dict]:
        """Parse a single historical game entry.

        CRITICAL: Uses game_id + date as unique key since IDs cycle 1-999.
        """
        try:
            # Get game ID from link text
            link_text = link_element.get_text(strip=True)
            game_id_match = re.search(r'(\d+)', link_text)
            if not game_id_match:
                return None
            game_id = int(game_id_match.group(1))

            # Find parent container (game-num div -> col-xs-12 parent)
            parent = link_element.parent
            if not parent:
                return None

            row = parent.parent
            if not row:
                return None

            row_text = row.get_text()

            # Extract date/time - format: MM/DD/YY HH:MM:SS
            date_match = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', row_text)
            time_match = re.search(r'(\d{1,2}:\d{2}:\d{2})', row_text)

            date = date_match.group(1) if date_match else datetime.now().strftime('%m/%d/%y')
            time_str = time_match.group(1) if time_match else datetime.now().strftime('%H:%M:%S')

            # Extract drawn numbers - find all 1-80 numbers in the entry
            # The historical page shows the 20 drawn numbers
            all_nums = re.findall(r'\b([1-9]|[1-7][0-9]|80)\b', row_text)

            # Filter and dedupe - take exactly 20 unique numbers
            seen_nums = set()
            numbers = []
            for n in all_nums:
                num = int(n)
                if num not in seen_nums:
                    seen_nums.add(num)
                    numbers.append(num)
                    if len(numbers) == 20:
                        break

            if len(numbers) == 20:
                return {
                    'game_id': game_id,
                    'date': date,
                    'time': time_str,
                    'numbers': sorted(numbers)
                }

        except Exception as e:
            pass

        return None

    def fetch_historical_deep(self, max_games: int = 1000, max_pages: int = 100) -> List[Dict]:
        """Fetch historical games with pagination.

        Navigates through pages using the "back" buttons.
        Uses game_id + date as unique key to avoid duplicates.

        Args:
            max_games: Maximum games to collect
            max_pages: Maximum pages to navigate
        """
        if not HAS_SELENIUM or not self.driver:
            print("  → Selenium not available")
            return []

        # Create a local set for tracking during collection
        # (Don't modify self.seen_games until we actually save)
        collected_keys = set()
        all_games = []
        consecutive_empty = 0

        try:
            print(f"  → Loading historical page (target: {max_games} games)...")
            self.driver.get(HIST_URL)
            time.sleep(2)

            # Set to 25 records per page
            try:
                select_elem = self.driver.find_element(By.ID, 'numRecords')
                select = Select(select_elem)
                select.select_by_value('25')
                time.sleep(2)
                print("  → Set display to 25 records per page")
            except Exception as e:
                print(f"  → Could not set record count: {e}")

            for page_num in range(max_pages):
                if len(all_games) >= max_games:
                    print(f"  → Reached target of {max_games} games")
                    break

                # Parse current page
                soup = BeautifulSoup(self.driver.page_source, 'html.parser')
                game_links = soup.find_all('a', href=re.compile(r'index\.php\?id=\d+'))

                page_new = 0
                page_duplicates = 0
                page_already_seen = 0

                for link in game_links:
                    try:
                        game_data = self._parse_historical_entry(link)
                        if game_data:
                            # CRITICAL: Use game_id + date as unique key
                            unique_key = f"{game_data['game_id']}_{game_data['date']}"

                            # Check against local collection first
                            if unique_key in collected_keys:
                                page_duplicates += 1
                            # Then check against global seen games
                            elif unique_key in self.seen_games:
                                page_already_seen += 1
                            else:
                                all_games.append(game_data)
                                collected_keys.add(unique_key)
                                page_new += 1
                    except:
                        continue

                total_new = len(all_games)

                if page_new > 0:
                    consecutive_empty = 0
                    print(f"  → Page {page_num + 1}: +{page_new} new (total: {total_new}, dup: {page_duplicates}, seen: {page_already_seen})")
                elif page_duplicates + page_already_seen == len(game_links) and len(game_links) > 0:
                    # All games on this page are duplicates - we've reached existing data
                    print(f"  → Page {page_num + 1}: All {len(game_links)} games already seen. Stopping.")
                    break
                else:
                    consecutive_empty += 1
                    print(f"  → Page {page_num + 1}: No new games ({consecutive_empty} consecutive empty)")
                    if consecutive_empty >= 3:
                        print("  → 3 consecutive empty pages, stopping")
                        break

                # Try to navigate to next page using back buttons
                navigated = False
                try:
                    # Try button IDs in order of preference
                    # The site uses back-100, back-x (where x = page size), and back-25
                    back_button_ids = ['back-25', 'back-100', 'back-x', 'back100', 'back25', 'backx']
                    for btn_id in back_button_ids:
                        try:
                            back_btn = self.driver.find_element(By.ID, btn_id)
                            if back_btn.is_displayed() and back_btn.is_enabled():
                                back_btn.click()
                                time.sleep(2)
                                navigated = True
                                break
                        except:
                            continue

                    if not navigated:
                        print(f"  → No more pagination available after page {page_num + 1}")
                        break

                except Exception as e:
                    print(f"  → Navigation error: {e}")
                    break

            print(f"  → Deep fetch complete: {len(all_games)} games collected")

        except Exception as e:
            print(f"  → Error in deep fetch: {e}")

        return all_games

    def fetch_historical_page(self) -> List[Dict]:
        """Fetch the historical draws page (first page only)."""
        if not HAS_SELENIUM or not self.driver:
            print("  → Selenium not available")
            return []

        games = []
        try:
            self.driver.get(HIST_URL)
            time.sleep(2)

            # Set to 25 records per page if possible
            try:
                select_elem = self.driver.find_element(By.ID, 'numRecords')
                select = Select(select_elem)
                select.select_by_value('25')
                time.sleep(2)
            except:
                pass

            # Parse the page
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            game_links = soup.find_all('a', href=re.compile(r'index\.php\?id=\d+'))

            for link in game_links:
                try:
                    game_data = self._parse_historical_entry(link)
                    if game_data:
                        unique_key = f"{game_data['game_id']}_{game_data['date']}"
                        if unique_key not in self.seen_games:
                            games.append(game_data)
                except:
                    continue

        except Exception as e:
            print(f"  → Error fetching historical page: {e}")

        return games

    def check_and_save_new_games(self, games: List[Dict]) -> int:
        """Check for and save new games. Returns count saved."""
        if not games:
            return 0

        new_count = 0
        for game in games:
            game_id = game['game_id']
            unique_key = f"{game_id}_{game['date']}"

            if unique_key not in self.seen_games:
                self._write_game_to_csv(game)
                self.seen_games.add(unique_key)
                new_count += 1

                # Update last game ID
                if game_id > self.last_game_id:
                    self.last_game_id = game_id

                print(f"  ✓ New game #{game_id} ({game['date']} {game['time']}): {game['numbers'][:10]}...")

        if new_count > 0:
            self._save_state()

        return new_count

    def run_once(self) -> int:
        """Run a single check cycle. Returns number of new games found."""
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Checking for new games...")

        # Get current game ID from live page
        current_id = self.get_current_game_id()
        if current_id:
            print(f"  → Live page shows game #{current_id}")

            # If game ID changed (or reset from 999 to 1), fetch historical
            if current_id != self.last_game_id:
                # Also handle ID rollover (999 -> 1)
                if current_id < self.last_game_id and self.last_game_id > 900:
                    print(f"  → Game ID rollover detected (999 → 1)")
            else:
                print(f"  → No new game (same as last: #{self.last_game_id})")
                return 0

        # Always fetch historical page for latest games
        hist_games = self.fetch_historical_page()

        if hist_games:
            print(f"  → Found {len(hist_games)} game(s) on historical page")
            return self.check_and_save_new_games(hist_games)
        else:
            print(f"  → No new games found")

        return 0

    def run(self, interval: int = 15):
        """Main monitoring loop."""
        print("=" * 60)
        print("SIMPLE KENO SCRAPER")
        print("=" * 60)
        print(f"Live URL: {LIVE_URL}")
        print(f"Historical URL: {HIST_URL}")
        print(f"Poll interval: {interval} seconds")
        print(f"Output file: {GAMES_CSV}")
        print(f"Last game ID: {self.last_game_id}")
        print(f"Previously seen games: {len(self.seen_games)}")
        print("Press Ctrl+C to stop")
        print("=" * 60)

        try:
            while True:
                try:
                    self.run_once()
                except KeyboardInterrupt:
                    break
                except Exception as e:
                    print(f"Error in cycle: {e}")

                print(f"Waiting {interval} seconds...")
                time.sleep(interval)

        except KeyboardInterrupt:
            print("\n\nStopping...")

        if self.driver:
            self.driver.quit()

        print(f"Scraper stopped. Last game ID: {self.last_game_id}")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Simple Keno Scraper")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--live", action="store_true", help="Test live page fetch")
    parser.add_argument("--hist", action="store_true", help="Test historical page fetch")
    parser.add_argument("--deep", type=int, default=0, metavar="N",
                       help="Deep fetch N games from history (e.g., --deep 1000)")
    parser.add_argument("--interval", type=int, default=15,
                       help="Poll interval in seconds (default: 15)")

    args = parser.parse_args()

    scraper = SimpleKenoScraper()

    if args.live:
        print("Testing live page fetch...")
        game_id = scraper.get_current_game_id()
        print(f"Current game ID: {game_id}")
        if scraper.driver:
            scraper.driver.quit()
        return

    if args.hist:
        print("Testing historical page fetch...")
        games = scraper.fetch_historical_page()
        print(f"Found {len(games)} new games")
        for game in games[:10]:
            print(f"  #{game['game_id']}: {game['date']} {game['time']} - {game['numbers'][:5]}...")
        if scraper.driver:
            scraper.driver.quit()
        return

    if args.deep > 0:
        print(f"Deep fetch mode: collecting {args.deep} games...")
        games = scraper.fetch_historical_deep(max_games=args.deep, max_pages=100)
        print(f"\nCollected {len(games)} games")
        saved = scraper.check_and_save_new_games(games)
        print(f"Saved {saved} new games to {GAMES_CSV}")
        if scraper.driver:
            scraper.driver.quit()
        return

    if args.once:
        scraper.run_once()
    else:
        scraper.run(interval=args.interval)

    if scraper.driver:
        scraper.driver.quit()


if __name__ == "__main__":
    main()
