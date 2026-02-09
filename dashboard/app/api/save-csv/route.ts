import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { filename, content } = await request.json();

    // Ensure Saves directory exists
    const savesDir = join(process.cwd(), 'public', 'Saves');
    if (!existsSync(savesDir)) {
      await mkdir(savesDir, { recursive: true });
    }

    // Write CSV file
    const filePath = join(savesDir, filename);
    await writeFile(filePath, content, 'utf-8');

    return NextResponse.json({
      success: true,
      path: `/Saves/${filename}`,
    });
  } catch (error) {
    console.error('Error saving CSV:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save CSV' },
      { status: 500 }
    );
  }
}
