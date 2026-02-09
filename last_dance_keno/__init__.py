"""
Last Dance Keno - A comprehensive Keno analysis system.

This package provides:
- Scraping: Live game data from kenoUSA.com
- Tracking: Game history and prediction tracking
- Strategies: 11 different prediction filters
- Analysis: Statistical and pattern analysis tools
"""

__version__ = "1.0.0"

from .simple_keno_scraper import SimpleKenoScraper
from .keno_tracker import KenoTracker
from .keno_live_tracker import KenoLiveTracker
from .keno_multi_strategy import KenoMultiStrategy, KenoAnalyzer
from .keno_hybrid_source import HybridGameSource

__all__ = [
    "SimpleKenoScraper",
    "KenoTracker",
    "KenoLiveTracker",
    "KenoMultiStrategy",
    "KenoAnalyzer",
    "HybridGameSource",
]
