#!/usr/bin/env python3
"""
Telegram Notifications for Keno Duel Daemon

Sends detailed game results to Telegram after each game.
"""

import requests
import os
from typing import Dict, Optional
from pathlib import Path


# Telegram credentials from config
TELEGRAM_BOT_TOKEN = "8392348475:AAFwYIjnOuKS4L2E_JU-cSb13ZtoQ6ln8iU"
TELEGRAM_CHAT_ID = "5457189805"


def format_game_message(result: Dict) -> str:
    """Format game result into Telegram message."""
    lines = []
    lines.append("🎰 KENO DUEL RESULTS")
    lines.append(f"Game #{result['game_id']}")
    lines.append("")

    # Supers section
    lines.append("🏆 SUPERS (Play First!)")
    supers_str = ", ".join(str(n) for n in result['supers'])
    lines.append(f"Numbers: {supers_str} ({result['supers_count']})")
    lines.append(f"Hits: {result['supers_hits']}/{result['supers_count']}")
    if result['supers_hits'] > 0:
        hit_supers = [str(n) for n in result['supers'] if n in result.get('drawn', [])]
        lines.append(f"Hit: {', '.join(hit_supers)}")
    lines.append("")

    # Core40 section
    core40_preview = ", ".join(str(n) for n in result['core40'][:10])
    lines.append(f"📊 Core40 ({result['core40_size']})")
    lines.append(f"Preview: {core40_preview}...")
    lines.append(f"Hits: {result['core40_hits']}/40")
    lines.append("")

    # Claude results
    lines.append("🤖 CLAUDE (CAZ)")
    claude_hits = result['claude_hits']
    lines.append(f"Hits: {claude_hits}/20")
    lines.append(f"Grade: {result['claude_grade']} | Points: {result['claude_pts']}")
    if result.get('claude_penalty', 0) < 0:
        lines.append(f"⚠️ Penalty: {result['claude_penalty']} pts")
    lines.append("")

    # Clawdbot results
    lines.append("🤖 CLAWDBOT")
    clawd_hits = result['clawd_hits']
    lines.append(f"Hits: {clawd_hits}/20")
    lines.append(f"Grade: {result['clawd_grade']} | Points: {result['clawd_pts']}")
    if result.get('clawd_penalty', 0) < 0:
        lines.append(f"⚠️ Penalty: {result['clawd_penalty']} pts")
    lines.append("")

    # Combined and winner
    lines.append("📈 COMBINED")
    lines.append(f"Total: {result['combined_hits']}/40")
    valid_status = "✅ VALID" if result['valid'] else "❌ INVALID"
    lines.append(f"{valid_status}")

    winner = result['winner'].upper()
    if winner == 'TIE':
        lines.append("Result: 🤝 TIE")
    elif winner == 'CLAUDE':
        lines.append("Winner: 🏆 CLAUDE")
    elif winner == 'CLAWD':
        lines.append("Winner: 🏆 CLAWDBOT")

    lines.append("")
    lines.append("Go Get'm Pookie")

    return "\n".join(lines)


def send_telegram_message(message: str, chat_id: str = None) -> bool:
    """Send message to Telegram."""
    if chat_id is None:
        chat_id = TELEGRAM_CHAT_ID

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

    try:
        response = requests.post(
            url,
            json={"chat_id": chat_id, "text": message},
            timeout=30
        )
        result = response.json()

        if result.get("ok"):
            return True
        else:
            print(f"Telegram error: {result.get('description', 'Unknown')}")
            return False

    except Exception as e:
        print(f"Telegram send error: {e}")
        return False


def send_game_result(result: Dict, chat_id: str = None) -> bool:
    """Send game result to Telegram."""
    message = format_game_message(result)
    return send_telegram_message(message, chat_id)


def send_daemon_start(chat_id: str = None) -> bool:
    """Send daemon start notification."""
    message = """🚀 KENO DUEL DAEMON STARTED

Monitoring for new games...
Fresh Core20s every game!
Supers lead your bets! 🎯

Go Get'm Pookie"""
    return send_telegram_message(message, chat_id)


def send_daemon_error(error_msg: str, chat_id: str = None) -> bool:
    """Send daemon error notification."""
    message = f"""⚠️ KENO DUEL ERROR

{error_msg}

Check the logs for details."""
    return send_telegram_message(message, chat_id)


def format_leaderboard_message(data: Dict) -> str:
    """Format leaderboard into Telegram message."""
    lines = []
    lines.append("🏆 KENO DUEL LEADERBOARD")
    lines.append("")

    # Bot standings
    if 'standings' in data:
        for bot, stats in data['standings'].items():
            lines.append(f"{bot.upper()}")
            lines.append(f"  Points: {stats.get('points', 0)}")
            lines.append(f"  Wins: {stats.get('wins', 0)}")
            lines.append(f"  Low7 Count: {stats.get('low7_count', 0)}")
            lines.append("")

    # Supers stats
    if 'supers_stats' in data:
        ss = data['supers_stats']
        lines.append("🎯 SUPERS")
        lines.append(f"  Hit Rate: {ss.get('rate', 0):.1%}")
        lines.append(f"  Total Hits: {ss.get('hits', 0)}/{ss.get('total', 0)}")
        lines.append("")

    # Hot supers
    if 'hot_supers' in data and data['hot_supers']:
        lines.append("🔥 HOT SUPERS")
        for entry in data['hot_supers'][-5:]:
            lines.append(f"  {entry}")
        lines.append("")

    lines.append("Go Get'm Pookie")

    return "\n".join(lines)


def send_leaderboard(data: Dict, chat_id: str = None) -> bool:
    """Send leaderboard to Telegram."""
    message = format_leaderboard_message(data)
    return send_telegram_message(message, chat_id)


def test_connection() -> bool:
    """Test Telegram connection."""
    message = """🧪 KENO DUEL TEST

Telegram connection successful!

Ready for game notifications.
Go Get'm Pookie"""
    return send_telegram_message(message)


if __name__ == "__main__":
    # Test connection
    print("Testing Telegram connection...")
    if test_connection():
        print("✓ Telegram test successful!")
    else:
        print("✗ Telegram test failed!")
