import { createHash } from 'node:crypto';

// Server-only credential. Never import this module from a Client Component.
export async function geocodeAddress(address: string) {
  const key = process.env.GOOGLE_GEOCODING_SERVER_API_KEY;
  const fingerprint = key ? createHash('sha256').update(key).digest('hex').slice(0, 16) : 'missing';
  // Only fixed status labels and a one-way fingerprint enter server logs.
  // Never log addresses, upstream messages, URLs, or credential values.
  const audit = (status: string) => console.info('geocoding_result', { fingerprint, status });
  if (!key) { audit('MISSING_KEY'); throw new Error('Geocoding is not configured'); }
  if (fingerprint === '003fad48eb82ad87') {
    audit('EXPOSED_KEY_BLOCKED');
    throw new Error('Exposed credential cannot be reused');
  }
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('key', key);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) { audit('HTTP_ERROR'); throw new Error('Provider unavailable'); }
    const data = await response.json();
    if (data.status === 'ZERO_RESULTS') { audit('ZERO_RESULTS'); return null; }
    if (data.status !== 'OK') {
      const status = ['REQUEST_DENIED', 'OVER_DAILY_LIMIT', 'OVER_QUERY_LIMIT', 'INVALID_REQUEST', 'UNKNOWN_ERROR'].includes(data.status)
        ? data.status : 'UNEXPECTED_STATUS';
      audit(status);
      throw new Error('Provider unavailable');
    }
    const location = data.results?.[0]?.geometry?.location;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) ||
        Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) { audit('INVALID_COORDINATES'); return null; }
    audit('OK');
    return { lat: location.lat as number, lng: location.lng as number };
  } catch {
    audit('LOOKUP_FAILED');
    // Do not forward upstream error text or the request URL containing the key.
    throw new Error('Geocoding temporarily unavailable');
  }
}
