import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const csvPath = join(process.cwd(), 'public', 'games.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');

    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');

    const games = lines.slice(1).map((line) => {
      const values = line.split(',');
      const game: any = {
        game_id: parseInt(values[0]),
        date: values[1],
        time: values[2],
        numbers: [],
      };

      for (let i = 3; i <= 22; i++) {
        game.numbers.push(parseInt(values[i]));
      }

      return game;
    });

    // Sort by game_id descending (most recent first) and limit to 1000
    const sortedGames = games
      .sort((a, b) => b.game_id - a.game_id)
      .slice(0, 1000);

    return NextResponse.json(sortedGames);
  } catch (error) {
    console.error('Error loading games:', error);
    return NextResponse.json([], { status: 200 });
  }
}
