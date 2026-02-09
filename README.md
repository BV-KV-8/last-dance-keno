# Last Dance Keno

A comprehensive Keno game analysis, tracking, and prediction system with 11 different strategy filters, live scraping, and automated tracking.

## Features

### Scraper
- **`simple_keno_scraper.py`** - Live game scraper for Casino Arizona McKellips Keno
  - Selenium-based scraping from kenoUSA.com
  - Handles game ID rollover (1-999 cycling)
  - Deep historical fetching (1000+ games)
  - State persistence across runs

### Tracker
- **`keno_tracker.py`** - Base tracking system with elimination rules
  - 7 elimination rules to filter playable numbers
  - Game scoring and prediction tracking
  - CSV-based data storage

### Live Tracker
- **`keno_live_tracker.py`** - Real-time tracking and prediction
  - Scrapes + tracks in one integrated process
  - Automatic scoring of predictions
  - Live elimination rule updates

### Multi-Strategy System
- **`keno_multi_strategy.py`** - 11 prediction strategies with analysis tools

#### The 11 Strategies:
1. **Elimination** - Original 7-rule elimination filter
2. **Statistical** - Z-score, trend, overdue analysis
3. **Vacuum** - Super-hot repeaters (4+ hits in 6 games)
4. **Dead Zone** - Cold numbers in dead zones
5. **Mirror** - Mirrored positions from last game
6. **Cluster Heat** - Highest neighbor heat scoring
7. **Opposite R/C** - Opposite row/col of hottest zones
8. **Decade** - Under-represented decades
9. **Ice Box** - Avoid numbers hitting 2+ in last 3
10. **Lonely 7** - 7 coldest numbers (0 hits in 12+ games)
11. **Arrow** - First-to-last draw path analysis

#### Analysis Tools:
- Pair Analysis (hot/cold pairs)
- Repeat/Carryover Analysis
- Odd/Even & High/Low Balance
- Row & Column Heatmap
- Monte Carlo Simulation
- Gap Chart

### Supporting Files
- **`keno_hybrid_source.py`** - Hybrid data source (CSV + manual entry)
- **`keno_telegram.py`** - Telegram bot integration
- **`config.py`** - System configuration

## Installation

```bash
# Clone repository
cd /home/ox/last-dance-keno

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Requirements

```
beautifulsoup4>=4.12.0
selenium>=4.15.0
pandas>=2.0.0
requests>=2.31.0
python-telegram-bot>=20.0
```

## Usage

### Basic Scraper
```bash
# Run once
python src/simple_keno_scraper.py --once

# Deep fetch 1000 historical games
python src/simple_keno_scraper.py --deep 1000

# Continuous monitoring (15s interval)
python src/simple_keno_scraper.py
```

### Tracker
```bash
# Show status with playable numbers
python src/keno_tracker.py --status

# Analyze specific number
python src/keno_tracker.py --analyze 37

# Add game manually
python src/keno_tracker.py --add 123 "02/08/26" "14:30:00" "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20"
```

### Live Tracker
```bash
# Run once
python src/keno_live_tracker.py --once

# Continuous monitoring
python src/keno_live_tracker.py
```

### Multi-Strategy
```bash
# Run all strategies
python src/keno_multi_strategy.py --once

# Show strategy performance summary
python src/keno_multi_strategy.py --summary

# Run analysis tools
python src/keno_multi_strategy.py --analyze
```

## Data Structure

```
data/
├── games.csv              # Historical game results
├── predictions.csv        # Strategy predictions
├── scores.csv             # Prediction scores
└── scraper_state.json     # Scraper state
```

## Elimination Rules (Tracker)

The 7 elimination rules applied by the tracker:

1. **Hit Last 2** - Eliminate if hit in last 2 games
2. **Hit 2 of 3** - Eliminate if hit 2+ times in last 3 games
3. **Hit 4 of 8** - Eliminate if hit 4+ times in last 8 games
4. **Hit 6 of 10** - Eliminate if hit 6+ times in last 10 games
5. **Pattern 1-3-4** - Eliminate if hit in positions 1, 3, 4
6. **Row/Col Hot** - Eliminate if row/col has 4+ hits in any of last 3 games
7. **No Neighbor Hit** - Eliminate if no touching neighbor hit last game

## Board Layout

Keno uses an 8-row × 10-column board (numbers 1-80):

```
 1  2  3  4  5  6  7  8  9 10
11 12 13 14 15 16 17 18 19 20
21 22 23 24 25 26 27 28 29 30
31 32 33 34 35 36 37 38 39 40
41 42 43 44 45 46 47 48 49 50
51 52 53 54 55 56 57 58 59 60
61 62 63 64 65 66 67 68 69 70
71 72 73 74 75 76 77 78 79 80
```

## License

MIT

## Interactive Dashboard

A modern Next.js dashboard for real-time strategy testing and backtesting.

### Dashboard Features
- **Real-time Backtesting** - Test strategies instantly against 1000+ historical games
- **Custom Strategy Builder** - Build your own filters with sliders and checkboxes
- **6 Color Themes** - Default, Midnight, Sunset, Forest, Ocean, Purple
- **Multiple Filter Types:**
  - Hit in Last X Games (with slider)
  - Hit X+ Times in Y Games (adjustable both values)
  - Must Have Hit in Last X Games
  - Custom Game Range (individual checkboxes for each game)
  - Pattern 1-3-4 Elimination
  - Hot Row/Col Threshold
  - Neighbor Hit Requirement

### Dashboard Installation
```bash
cd dashboard
npm install
npm run dev
```
Visit http://localhost:3000

### Dashboard Usage
1. **Select Theme** - Choose your preferred color scheme
2. **Toggle Filters** - Enable/disable elimination rules with switches
3. **Adjust Parameters** - Use sliders to fine-tune filter values
4. **Custom Range** - Check individual games to include/exclude from analysis
5. **View Results** - See playable numbers, hit rates, and backtest stats in real-time

### Dashboard Views
- **Prediction** - Shows playable numbers highlighted on the board
- **Heatmap** - Visualizes frequency of hits in last 20 games
- **Last Game** - Shows the most recent draw

## Color Themes

| Theme | Description |
|-------|-------------|
| Default | Clean light theme with blue accents |
| Midnight | Dark theme with indigo accents |
| Sunset | Warm orange theme |
| Forest | Dark green theme |
| Ocean | Dark cyan theme |
| Purple | Dark purple theme |

## Contributing

Contributions welcome! This is the "last dance" keno system - refined over many iterations.
