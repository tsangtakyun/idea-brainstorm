const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function setup(options = {}) {
  const calls = { provider: 0, auth: 0, budget: 0, ai: 0, logs: [] };
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.invalid',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
    GOOGLE_GEOCODING_SERVER_API_KEY: 'test-server-key'
  };
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const exports = {};
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
    }).outputText, {
      exports, URL, TextDecoder, AbortSignal, process: { env },
      console: { info: (...args) => calls.logs.push(args) },
      async fetch(url) {
        calls.provider++;
        assert.equal(url.hostname, 'maps.googleapis.com');
        assert.equal(url.searchParams.get('key'), 'test-server-key');
        return { ok: true, async json() { return options.provider || {
          status: 'OK', results: [{ geometry: { location: { lat: 22.3, lng: 114.2 } } }]
        }; } };
      },
      require(name) {
        if (name === 'node:crypto') {
          if (options.exposedKey) return { createHash: () => ({ update: () => ({ digest: () => '003fad48eb82ad87' }) }) };
          return require('node:crypto');
        }
        if (name === 'next/server') return { NextResponse: { json: (data, init) => Response.json(data, init) } };
        if (name === 'next/headers') return { cookies: async () => ({ getAll: () => [] }) };
        if (name === '@supabase/ssr' || name === '@supabase/supabase-js') {
          const create = () => ({ auth: { async getUser() {
            calls.auth++;
            return { data: { user: options.signedOut ? null : { id: 'test-user' } }, error: null };
          } } });
          return { createClient: create, createServerClient: create };
        }
        if (name === './admin-supabase') return { createAdminSupabase: () => ({ async rpc() {
          calls.budget++;
          return { data: !options.limited, error: options.budgetError ? {} : null };
        } }) };
        if (name === '@anthropic-ai/sdk') return class { messages = { create: async () => {
          calls.ai++;
          return { content: [{ type: 'text', text: '{"desc":"test"}' }] };
        } }; };
        if (name === '@/lib/anthropicModel') return { ANTHROPIC_MODEL: 'test-model' };
        if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
        throw new Error('Unexpected import: ' + name);
      }
    });
    return cache[file] = exports;
  }
  async function request(body, endpoint = 'geocode', origin = 'https://example.test') {
    const req = new Request('https://example.test/api/' + endpoint, {
      method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    req.nextUrl = new URL(req.url);
    return load('app/api/' + endpoint + '/route.ts').POST(req);
  }
  return { request, calls };
}

(async () => {
  for (const [options, status] of [[{ signedOut: true }, 401], [{ limited: true }, 429], [{ budgetError: true }, 503]]) {
    const test = setup(options);
    assert.equal((await test.request({ address: 'Central HK' })).status, status);
    assert.equal(test.calls.provider, 0);
  }
  let test = setup();
  assert.equal((await test.request({ address: 'Central HK' }, 'geocode', 'https://evil.invalid')).status, 403);
  assert.equal(test.calls.provider, 0);
  assert.equal((await test.request({ address: 'x'.repeat(5000) })).status, 400);
  assert.equal((await test.request({ address: 123 })).status, 400);
  assert.equal(test.calls.budget, 0);
  test = setup();
  let response = await test.request({ address: 'Central HK' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { location: { lat: 22.3, lng: 114.2 } });
  assert.equal(test.calls.provider, 1);
  test = setup({ provider: { status: 'REQUEST_DENIED', error_message: 'test-server-key' } });
  response = await test.request({ address: 'Central HK' });
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('test-server-key'));
  assert.ok(!JSON.stringify(test.calls.logs).includes('test-server-key'));
  assert.ok(!JSON.stringify(test.calls.logs).includes('Central HK'));
  assert.ok(JSON.stringify(test.calls.logs).includes('REQUEST_DENIED'));
  test = setup({ exposedKey: true });
  assert.equal((await test.request({ address: 'Central HK' })).status, 503);
  assert.equal(test.calls.provider, 0);
  test = setup({ signedOut: true });
  assert.equal((await test.request({ name: 'Central' }, 'search-place')).status, 401);
  assert.equal(test.calls.ai, 0);
  assert.equal(test.calls.provider, 0);
  test = setup({ limited: true });
  assert.equal((await test.request({ name: 'Central' }, 'search-place')).status, 429);
  assert.equal(test.calls.ai, 0);
  console.log('PASS: auth, origin, distributed budget fail-closed, payload limits, coordinates, provider-error redaction, search-place paid-call gating');
})().catch(error => { console.error('FAIL', error.message); process.exit(1); });
