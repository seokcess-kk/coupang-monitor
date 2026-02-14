/**
 * API endpoint to trigger scraper from dashboard
 * Proxies request to the scraper service
 */

import { NextResponse } from 'next/server';

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:3001';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${SCRAPER_URL}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(error, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to trigger scraper:', error);
    return NextResponse.json(
      { error: 'Failed to connect to scraper service' },
      { status: 503 }
    );
  }
}
