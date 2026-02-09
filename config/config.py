from typing import Dict, Any, List
from datetime import datetime
import os

# Base Configuration
class Config:
    # Data paths
    GAMES_CSV_PATH = "games/games.csv"
    FORECASTS_PATH = "forecasts"
    BACKUP_PATH = "backups"
    MODEL_PATH = "models"
    LOGS_PATH = "logs"

    # URLs
    PRIMARY_URL = "https://kenousa.com/games/CasinoArizona/McKellips/"
    BACKUP_URL = "https://kenousa.com/games/CasinoArizona/McKellips/draws.php"

    # Model configurations
    # ENHANCED: More window sizes for better short-term pattern detection
    WINDOW_SIZES = [5, 10, 15, 25, 50, 100]  # Added short-term windows
    SEQUENCE_LENGTH = 10  # Number of past games for sequence models
    FEATURE_COUNT = 80  # Number of Keno balls

    # Training schedule (V3 Optimized)
    MINI_RETRAIN_INTERVAL = 2  # Games (Frequent updates)
    FULL_RETRAIN_INTERVAL = 8  # Games (Frequent full retraining)

    # Timing configuration
    WAIT_AFTER_DRAW_MINUTES = 5  # Minutes to wait after a draw
    POLL_INTERVAL_SECONDS = 60  # Seconds between checks for new games

    # Forecasting targets
    TARGET_SPOTS = [1, 2, 3, 4, 5]  # Target hit combinations (K1-K5)
    FORECAST_HORIZON = 5  # Maximum games to look ahead
    SET_FORECAST_TARGETS = 8  # Track set-based forecasts over next 8 games
    
    # Dashboard statistics
    STATS_GAME_COUNT = 100  # Number of games to use for statistics (changeable via Telegram)

    # ENHANCED: Optimized XGBoost parameters for better 3-spot accuracy
    # Deeper trees, more estimators, reduced regularization
    XGBOOST_PARAMS = {
        'max_depth': 7,        # Increased for complex patterns
        'learning_rate': 0.04, # Slower, more stable learning
        'n_estimators': 200,   # More trees for stability
        'subsample': 0.9,
        'colsample_bytree': 0.9,
        'min_child_weight': 2, # Allow more splits
        'gamma': 0.03,         # Allow more splits
        'reg_alpha': 0.02,     # Less L1 regularization
        'reg_lambda': 0.3,     # Less L2 regularization
        'random_state': 42,
        'eval_metric': 'logloss',
        'tree_method': 'hist'  # Fast histogram-based training
    }

    # Early stopping guardrails for XGBoost (avoids overfitting on small samples)
    XGBOOST_EARLY_STOPPING_ROUNDS = 20
    XGBOOST_EARLY_STOPPING_MIN_SAMPLES = 200
    XGBOOST_EARLY_STOPPING_MIN_EVAL = 50

    # Telegram Bot Configuration
    TELEGRAM_BOTS = {
        "model": "8392348475:AAFwYIjnOuKS4L2E_JU-cSb13ZtoQ6ln8iU",  # claudecodekenofullbot (Working)
        "core": "8392348475:AAFwYIjnOuKS4L2E_JU-cSb13ZtoQ6ln8iU",   # claudecodekenofullbot (Working)
        "scores": "8392348475:AAFwYIjnOuKS4L2E_JU-cSb13ZtoQ6ln8iU", # claudecodekenofullbot (Working)
        "dash": "8392348475:AAFwYIjnOuKS4L2E_JU-cSb13ZtoQ6ln8iU",   # claudecodekenofullbot (Working)
    }

    # Telegram Chat IDs
    TELEGRAM_CHAT_IDS = {
        "model": "5457189805",  # Working chat ID
        "core": "5457189805",   # Working chat ID
        "scores": "5457189805", # Working chat ID
        "dash": "5457189805",   # Working chat ID
    }

    # Default chat ID for backward compatibility
    TELEGRAM_CHAT_ID = "5457189805"  # Working chat ID

    # ENHANCED: Improved PyTorch parameters
    # Balanced for speed and accuracy with better stability
    # Optimized training settings (V3 Winner)
    MAX_TRAINING_HISTORY = 600  # V3 Optimized History Limit
    
    PYTORCH_PARAMS = {
        'hidden_dim': 128,
        'epochs': 25,            # Optimized
        'learning_rate': 0.001,
        'fine_tune_epochs': 15,
        'fine_tune_lr': 0.0001
    }

    # ENHANCED: TensorFlow/LSTM parameters
    TENSORFLOW_PARAMS = {
        'lstm_units': [256, 128, 64, 32],  # Increased and added fourth layer
        'dropout': 0.25,
        'learning_rate': 0.0005,
        'batch_size': 64,
        'epochs': 50,
        'early_stopping_patience': 10
    }

    # ENHANCED: Rebalanced ensemble weights based on performance analysis
    # Model 1 performed best (0.857 avg hits for 3-spot)
    ENSEMBLE_WEIGHTS = {
        'model1': 0.50,  # Increased weight for best performer
        'model2': 0.25,
        'model3': 0.25
    }

    # ENHANCED: 3-spot specific optimization
    ENABLE_3SPOT_BOOST = True
    HOT_NUMBER_THRESHOLD = 0.30  # Boost numbers with >30% recent hit rate
    HOT_NUMBER_BOOST = 1.15      # 15% boost for hot numbers
    CONSECUTIVE_BONUS = 1.10     # 10% boost for consecutive pairs

    # ONLINE LEARNING PARAMETERS
    ENABLE_ONLINE_LEARNING = True  # Enable incremental learning after each game
    LEARNING_RATE_XGB = 0.05       # Learning rate for XGBoost incremental updates (increased)
    LEARNING_RATE_NN = 0.010       # Learning rate for Neural Network online updates (increased)
    LEARNING_BIAS_DECAY = 0.88     # Decay factor for learned biases (faster adaptation)
    ERROR_WEIGHT_UPDATE = 0.15     # Weight adjustment based on prediction error (increased)
    ONLINE_LEARNING_BATCH_SIZE = 4 # Batch size for accumulating updates (more frequent)
    BIAS_UPDATE_STRENGTH = 0.22    # Strength of bias updates for hot/cold numbers (increased)
    
    # ENHANCED: Ensemble EWMA and diversity parameters
    ENSEMBLE_EWMA_ALPHA = 0.2      # EWMA smoothing for weight updates
    DIVERSITY_BONUS = 0.15         # Bonus for model disagreement
    CONFIDENCE_CALIBRATION = True  # Enable confidence calibration

    # Model 4 (ensemble) rank calibration
    MODEL4_RANK_LOOKBACK = 300

    # History calibration (re-weights predictions based on recent forecast results)
    HISTORY_CALIBRATION_ENABLED = True
    HISTORY_CALIBRATION_K_SPOT = 5
    HISTORY_CALIBRATION_MAX_ROWS = 300
    HISTORY_CALIBRATION_ALPHA = 25
    HISTORY_CALIBRATION_MIN_MULT = 0.7
    HISTORY_CALIBRATION_MAX_MULT = 1.3
    HISTORY_CALIBRATION_DECAY = 0.985

    # K5 optimizer (aims for higher 5/5 hit rates)
    K5_OPTIMIZER_ENABLED = True
    K5_OPTIMIZER_CANDIDATES = 15
    K5_OPTIMIZER_RECENT_GAMES = 120
    K5_OPTIMIZER_PRED_WEIGHT = 0.65
    K5_OPTIMIZER_FREQ_WEIGHT = 0.2
    K5_OPTIMIZER_PAIR_WEIGHT = 0.15

    # Continuous recent-frequency adjustment
    RECENT_FREQ_WEIGHT = 0.18
    RECENT_FREQ_MIN_MULT = 0.85
    RECENT_FREQ_MAX_MULT = 1.2

    # Unified master ranking (top-20 -> 15 -> 10 -> 8 -> 5 -> 4 -> 3 -> 2 -> 1)
    UNIFIED_TOP_N = 20
    UNIFIED_MODEL_WEIGHTS = {
        'model1': 0.40,  # Boosted - stochastic model shows best rank ordering
        'model2': 0.30,
        'model3': 0.30
    }
    UNIFIED_DYNAMIC_MODEL_WEIGHTS = True
    UNIFIED_MODEL_PERF_WINDOW = 100  # Faster adaptation to recent performance
    UNIFIED_MODEL_WEIGHT_MIN = 0.18  # Ensure all models contribute
    UNIFIED_MODEL_WEIGHT_MAX = 0.55
    UNIFIED_HISTORY_WEIGHT = 0.35        # Boosted - historical rates are reliable (Clean signal)
    UNIFIED_RECENT_WEIGHT = 0.25         # Increased - slightly more weight on recent trends
    UNIFIED_PAIR_WEIGHT = 0.10
    UNIFIED_RANK_WEIGHT = 0.15
    UNIFIED_SHORT_RECENT_WEIGHT = 0.0    # DISABLED - removed noise
    UNIFIED_SHORT_RECENT_WINDOW = 15
    UNIFIED_PAIR_SCORE_WEIGHT = 0.20     # Boosted - pairs are strong signals
    UNIFIED_TRIPLET_SCORE_WEIGHT = 0.0   # DISABLED - removed noise
    UNIFIED_TRIPLET_WINDOW = 120
    UNIFIED_NEIGHBOR_WEIGHT = 0.0        # DISABLED - removed noise
    UNIFIED_NEIGHBOR_WINDOW = 120
    UNIFIED_MASTER20_POS_WEIGHT = 0.25   # Boosted - position learning is key
    UNIFIED_MASTER20_POS_WINDOW = 400
    UNIFIED_MASTER20_POS_MIN = 0.85
    UNIFIED_MASTER20_POS_MAX = 1.15
    UNIFIED_CONV_WEIGHT = 0.30           # Boosted - proven predictor
    TARGET_RANK_RECENT_WINDOW = 12
    TARGET_RANK_POS_WEIGHT = 0.45
    TARGET_RANK_RECENT_WEIGHT = 0.25
    TARGET_RANK_SCORE_WEIGHT = 0.2
    TARGET_RANK_CONV_WEIGHT = 0.6
    TARGET_RANK_CONV_MIN_SAMPLES = 12
    TARGET_RANK_MIN_SAMPLES = 15

    # --- CORE 20 ACCURACY ENGINE ---
    # Phase 2 Upgrades for Higher Accuracy
    PRE_RANKING_EXCLUSION_ENABLED = True
    PRE_RANKING_EXCLUSION_PENALTY = 0.5  # Heavy penalty for "bad" numbers
    
    BUBBLE_RESCUE_ENABLED = True
    BUBBLE_RESCUE_HOT_THRESHOLD = 0.4    # >40% hit rate in window = HOT
    BUBBLE_RESCUE_COLD_THRESHOLD = 0.0   # 0% hit rate = COLD
    BUBBLE_RESCUE_WINDOW = 5             # Look at last 5 games for rescue

    DYNAMIC_PROFILE_SHADOWING_ENABLED = True
    PROFILE_SHADOWING_WINDOW = 1         # Look at last game only for quick adaptation
    CORE20_CONV_PRIOR = 12.0  # Increased to reduce noise from small samples
    DECAY_WINDOW = 50
    DECAY_TAU = 10.0
    STABILITY_WINDOW = 200
    SYNERGY_WINDOW = 120
    SYNERGY_TOP_K = 5
    SYNERGY_COND_WEIGHT = 0.3
    GATING_RECENT_WINDOW = 9
    GATING_STABILITY_WINDOW = 200
    GATING_STABILITY_MIN_RATIO = 1.0
    GATING_USE_SYNERGY = True
    GATING_SYNERGY_TOP_K = 12
    LOCK_COUNT = 4
    FLEX_COUNT = 4
    LOCK_DECAY_WEIGHT = 0.35
    LOCK_STABILITY_WEIGHT = 0.35
    LOCK_SYNERGY_WEIGHT = 0.2
    LOCK_RANK_WEIGHT = 0.25
    LOCK_CONV_WEIGHT = 0.35
    PROBE_PERF_WINDOW = 20
    PROBE_DECAY_WEIGHT = 0.5
    PROBE_RANK_WEIGHT = 0.2
    PROBE_CONV_WEIGHT = 0.3
    CORE5_HOT_DECAY_WEIGHT = 0.5
    CORE5_HOT_RANK_WEIGHT = 0.2
    CORE5_HOT_CONV_WEIGHT = 0.3
    CORE5_CONV_WEIGHT = 0.7
    CORE5_CONV_STABILITY_WEIGHT = 0.3
    PHASE_WEIGHT_T1 = 0.3
    PHASE_WEIGHT_T2 = 0.7
    PHASE_WEIGHT_T3 = 1.2
    PHASE_WEIGHT_DECAY = 0.6
    PHASE_LOCK_COUNT = 4
    PHASE_FLEX_POOL_SIZE = 10
    PHASE_HUNT_PARTNERS = 8
    PHASE_HUNT_SET_COUNT = 3
    PHASE_LOCK_USE_SYNERGY_GATE = True
    FULL_HIT_POOL_SIZE = 12
    FULL_HIT_K5_COUNT = 3
    FULL_HIT_K6_COUNT = 1
    FULL_HIT_K7_COUNT = 1
    FULL_HIT_K8_COUNT = 3
    FULL_HIT_K5_MIN_PAIR_WEIGHT = 3.0
    FULL_HIT_K5_AVG_PAIR_WEIGHT = 1.2
    FULL_HIT_K5_AVG_CONV_WEIGHT = 0.6
    FULL_HIT_K5_STABILITY_WEIGHT = 0.4
    FULL_HIT_K8_MIN_PAIR_WEIGHT = 1.5
    FULL_HIT_K8_AVG_PAIR_WEIGHT = 1.0
    FULL_HIT_K8_AVG_CONV_WEIGHT = 0.5
    FULL_HIT_K8_STABILITY_WEIGHT = 0.3
    FULL_HIT_OFFSETS = (3,)

    # Shape Pattern Integration (from shape analysis of 2598+ games)
    # Numbers frequently appearing in large touching shapes get boosted
    SHAPE_BOOST_ENABLED = True
    SHAPE_BOOST_WEIGHT = 0.12       # Weight of shape scores in final ranking
    SHAPE_CENTER_BONUS = 1.15       # Multiplier for center cluster (28-53)
    SHAPE_EDGE_SMALL_BONUS = 1.08   # Multiplier for edge numbers in small shapes
    SHAPE_ADJACENCY_WEIGHT = 0.08   # Weight for adjacency bonus in set selection

    # Active set models for forecasting (match TalkStick setup)
    ACTIVE_SET_MODELS = [
        "master_20",
        "master_10",
        "shredder_core20",
        "shredder_core10",
        "trash_5",
        "z1",
        "z2",
        "z3",
        "z4",
        "z5",
        "core8_plan_a",
        "core8_plan_b",
        "ai_core8",
        "ai_core4",
        "sifter_8",
        "sifter_x",
        "option_k8",
        "option_k7",
        "option_k6",
        "option_k5"
    ]

    # Master set generation settings
    RANK_WINDOW = 76
    RANK_LOOKBACK_GAMES = 380
    RANK_WEIGHT_MIN = 0.85
    RANK_WEIGHT_MAX = 1.2
    MASTER_15_VARIANTS = 5
    MASTER_15_VARIANT_WEIGHTS = {
        'rank': 0.34,
        'recent': 0.22,
        'history': 0.16,
        'pair': 0.12,
        'triplet': 0.08,
        'conv': 0.08
    }
    MASTER_8_VARIANTS = 3
    MASTER_8_VARIANT_WEIGHTS = {
        'rank': 0.38,
        'recent': 0.26,
        'history': 0.12,
        'pair': 0.1,
        'triplet': 0.06,
        'conv': 0.08
    }
    MASTER_VARIANT_LABELS = ['rank', 'recent', 'blend']
    VARIANT_PERF_WINDOW = 50
    VARIANT_PERF_MIN_SAMPLES = 8

    # MINI-TRAIN PARAMETERS (for quick retraining between games - under 5 minutes)
    # Use these for faster incremental updates
    MINI_TRAIN_XGBOOST_PARAMS = {
        'max_depth': 4,
        'learning_rate': 0.1,      # Faster learning
        'n_estimators': 30,        # Fewer trees for speed
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'random_state': 42,
        'eval_metric': 'logloss',
        'tree_method': 'hist'
    }

    MINI_TRAIN_PYTORCH_PARAMS = {
        'hidden_dim': 128,         # Smaller network
        'num_layers': 2,           # Shallower network
        'dropout': 0.3,
        'learning_rate': 0.001,   # Higher learning rate
        'batch_size': 32,
        'epochs': 10,             # Fewer epochs for speed
        'early_stopping_patience': 3
    }

    # Backup schedule
    BACKUP_INTERVAL_HOURS = 24

    # Logging
    LOG_LEVEL = "INFO"
    LOG_FORMAT = "{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}"

    # =============================================================================
    # POSITION-WEIGHTED CORE SELECTION
    # Based on AI Core State analysis (100 games)
    # Positions 14-17 have 40-45% hit rates vs 9-16% for positions 1-2
    # =============================================================================
    ENABLE_POSITION_WEIGHTS = True  # Enable position-weighted core selection

    # Position weights for scoring (multiplier)
    # HYBRID APPROACH: Combines normal games + best games (9-11 hits) patterns
    # Positions that excel in BOTH patterns get highest weights
    POSITION_WEIGHTS = {
        # 🔥🔥🔥 EXCELLENT in both patterns - These are the keys to 11/20 games!
        18: 1.50,  # 66% in BEST games, 27% in normal (high variance - key for big wins)
        1:  1.40,  # 62% in BEST games, 9% in normal (high variance - key for big wins)
        16: 1.50,  # 58% in BEST games, 42% in normal (consistently strong!)
        17: 1.45,  # 58% in BEST games, 37% in normal (consistently strong!)
        13: 1.35,  # 58% in BEST games, 25% in normal (high variance)
        14: 1.35,  # 52% in BEST games, 45% in normal (consistently strong!)
        15: 1.25,  # 48% in BEST games, 45% in normal (solid)
        4:  1.25,  # 54% in BEST games, 33% in normal (good)
        3:  1.15,  # 46% in BEST games, 34% in normal (good)
        5:  1.10,  # 50% in BEST games, 28% in normal
        2:  1.05,  # 46% in BEST games, 16% in normal (decent in best games)
        6:  1.00,  # 46% in BEST games, 20% in normal
        7:  1.00,  # 46% in BEST games, 28% in normal
        8:  1.00,  # 46% in BEST games, 17% in normal
        12:  1.00,  # 46% in BEST games, 9% in normal (cold normally but good in best)
        # Lower weights for consistently poor positions
        9:  0.90,  # 44% in BEST games, 27% in normal
        10: 0.90,  # 42% in BEST games, 24% in normal
        11: 0.90,  # 44% in BEST games, 17% in normal
        19: 0.85,  # 44% in BEST games, 21% in normal
        20: 0.85,  # 40% in BEST games, 21% in normal
    }

    # Optimal positions for each core size (for direct selection)
    # CONSERVATIVE: Consistent performance in normal games
    OPTIMAL_CORE_POSITIONS_CONSERVATIVE = {
        3:  [14, 15, 16],           # 44% expected hit rate
        5:  [14, 15, 16, 17, 3],    # 40.6% expected hit rate
        8:  [14, 15, 16, 17, 3, 4, 5, 7],  # 36.5% expected hit rate
        10: [14, 15, 16, 17, 3, 4, 5, 7, 13, 18],
        12: [14, 15, 16, 17, 3, 4, 5, 7, 13, 18, 1, 2],
    }

    # AGGRESSIVE: High variance - targets 11/20 hit potential
    OPTIMAL_CORE_POSITIONS_AGGRESSIVE = {
        3:  [18, 1, 13],            # 62% expected in BEST games
        5:  [18, 1, 13, 16, 17],    # 60.4% expected in BEST games
        8:  [18, 1, 13, 16, 17, 4, 14, 5],  # 57.2% expected in BEST games
        10: [18, 1, 13, 16, 17, 4, 14, 5, 15, 3],
        12: [18, 1, 13, 16, 17, 4, 14, 5, 15, 3, 2, 6],
    }

    # Default to conservative for stability
    OPTIMAL_CORE_POSITIONS = OPTIMAL_CORE_POSITIONS_CONSERVATIVE

    # Expected hit rates for position-optimal cores (from analysis)
    POSITION_OPTIMAL_HIT_RATES = {
        3:  0.44,   # Core3 from positions 14,15,16
        5:  0.406,  # Core5 from positions 14,15,16,17,3
        8:  0.365,  # Core8 from positions 14,15,16,17,3,4,5,7
        10: 0.345,
        12: 0.32,
    }

    # Expected hit rates for aggressive cores (in BEST games)
    POSITION_OPTIMAL_HIT_RATES_AGGRESSIVE = {
        3:  0.62,   # Core3 from positions 18,1,13 in best games
        5:  0.604,  # Core5 from positions 18,1,13,16,17 in best games
        8:  0.572,  # Core8 from positions 18,1,13,16,17,4,14,5 in best games
        10: 0.55,
        12: 0.52,
    }

    # Enable position-optimal core forecasts as separate models
    ENABLE_POSITION_CORE_FORECASTS = True

    @classmethod
    def ensure_directories(cls):
        """Create necessary directories if they don't exist."""
        dirs = [
            cls.GAMES_CSV_PATH.rsplit('/', 1)[0],
            cls.FORECASTS_PATH,
            cls.BACKUP_PATH,
            cls.MODEL_PATH,
            cls.LOGS_PATH
        ]

        for dir_path in dirs:
            os.makedirs(dir_path, exist_ok=True)
