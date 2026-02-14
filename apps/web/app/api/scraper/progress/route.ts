/**
 * API endpoint to get scraper progress
 * Proxies request to the scraper service
 */

import { NextResponse } from 'next/server';

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const res = await fetch(`${SCRAPER_URL}/progress`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { running: false, error: 'Scraper service error' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { running: false, error: 'Scraper service not available' },
      { status: 200 } // Return 200 with error flag so UI can handle gracefully
    );
  }
}
