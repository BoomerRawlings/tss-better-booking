import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.mjs';

test('one Worker serves assets while keeping API origin/method gates', async () => {
  const calls = [];
  const env = { APP_ORIGIN: 'https://booking.example.org', PROBE_ONLY: 'true', DIRECT_BOOKING_ENABLED: 'false',
    ASSETS: { fetch(request) { calls.push(new URL(request.url).pathname); return new Response('Synthetic static asset'); } } };
  assert.equal(await (await worker.fetch(new Request(env.APP_ORIGIN + '/booking/'), env)).text(), 'Synthetic static asset');
  const health = await worker.fetch(new Request(env.APP_ORIGIN + '/booking/api/health'), env);
  assert.equal(health.status, 200); assert.equal((await health.json()).probeOnly, true);
  assert.equal((await worker.fetch(new Request('https://other.example.org/booking/api/health'), env)).status, 404);
  assert.equal((await worker.fetch(new Request(env.APP_ORIGIN + '/booking/api/book', { method: 'GET' }), env)).status, 405);
  assert.deepEqual(calls, ['/booking/']);
});
