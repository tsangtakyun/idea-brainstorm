import { NextRequest, NextResponse } from 'next/server';
import { authorizeGeocoding, readSmallJson, validPlaceText } from '@/lib/geocoding-access';
import { geocodeAddress } from '@/lib/geocoding';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await readSmallJson(request); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!validPlaceText(body.address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }
  const denied = await authorizeGeocoding(request);
  if (denied) return denied;
  try {
    const location = await geocodeAddress(body.address.trim());
    return NextResponse.json({ location }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Geocoding temporarily unavailable' }, { status: 503 });
  }
}
