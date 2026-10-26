import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from './admin-supabase';

export async function authorizeGeocoding(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const cookieStore = await cookies();
    const auth = token
      ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : createServerClient(url, anonKey, {
        cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} }
      });
    const { data: { user }, error } = await auth.auth.getUser(token || undefined);
    if (error || !user) return NextResponse.json({ error: '請先登入' }, { status: 401 });
    const admin = createAdminSupabase();
    if (!admin) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    const result = await admin.rpc('consume_geocoding_budget', { request_user: user.id });
    // Database-backed atomic budgets are shared across all server instances.
    // A missing migration or unavailable limiter must never allow paid calls.
    if (result.error) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    if (result.data !== true) {
      return NextResponse.json({ error: '請稍後再試' }, { status: 429, headers: { 'Retry-After': '60' } });
    }
    return null;
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function readSmallJson(request: NextRequest): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid body');
  let size = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error('Body too large'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const data = JSON.parse(text);
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Invalid body');
    return data;
  } finally { reader.releaseLock(); }
}

export function validPlaceText(value: unknown, required = true): value is string {
  return typeof value === 'string' && value.length <= 500 &&
    (!required || value.trim().length > 0) && !/[\u0000-\u001f]/.test(value);
}
