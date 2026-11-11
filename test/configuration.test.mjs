import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeConfig, routeFor } from '../scripts/configure.mjs';

const sample = JSON.parse(await readFile(new URL('../config.example.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(sample);
test('public sample stays offline/probe-only with no inferred trusted routes', () => {
  const config = normalizeConfig(sample);
  assert.equal(config.publicConfig.site.demo, true);
  assert.equal(config.service.probeOnly, true);
  assert.equal(config.service.directBookingEnabled, false);
  assert.deepEqual(config.trusted, []);
  assert.deepEqual(config.publicConfig.people.map(item => item.name), ['King Triton', 'Person 2', 'Person 3']);
  assert.equal(config.publicConfig.people[0].courses[0].options[0].verified, false);
  assert.doesNotMatch(JSON.stringify(config.publicConfig), /duoOrigin|trustedRoutes|evidence|service/);
});
test('configuration rejects credentials, unbounded services and untrusted route enablement', () => {
  for (const mutate of [
    value => { value.password = 'synthetic-secret'; },
    value => { value.people[0].email = 'example@example.org'; },
    value => { value.service.maxBrowserSessions = 9; },
    value => { value.service.monthlyBrowserMinutes = 151; },
    value => { value.service.maxSessionMinutes = 16; },
    value => { value.auth.duoOrigin = 'https://evil.example.org'; },
    value => { value.auth.duoOrigin = 'https://api-00000000.duosecurity.com.evil.example'; },
    value => { value.service.directBookingEnabled = true; },
    value => { value.site.demo = false; value.service.probeOnly = false; },
    value => { value.site.demo = false; value.service.probeOnly = false; value.service.directBookingEnabled = true; },
    value => { value.people[0].courses[0].options[0].packageId = "1')/ActionHdrSet"; },
  ]) { const value = copy(); mutate(value); assert.throws(() => normalizeConfig(value)); }
  const value = copy(); value.service.monthlyBrowserMinutes = 0;
  assert.equal(normalizeConfig(value).service.monthlyBrowserMinutes, 0);
});
test('manual trust is exact course/package/year/session evidence, not catalog membership', () => {
  const value = copy(); value.site.demo = false; value.service.probeOnly = false; value.service.directBookingEnabled = true;
  const option = value.people[0].courses[0].options[0];
  const proof = { courseCode: 'EXAMPLE-101', moduleId: option.moduleId, packageId: option.packageId, year: option.year, session: option.session, evidence: 'Synthetic test proof, never a real enrollment route.' };
  value.trustedRoutes = [proof];
  const result = normalizeConfig(value);
  assert.deepEqual(result.trusted, [routeFor(proof)]);
  assert.equal(result.publicConfig.people[0].courses[0].options[0].verified, true);
  for (const [key, replacement] of [['courseCode', 'EXAMPLE-999'], ['moduleId', '999999'], ['packageId', '999999'], ['year', '2100'], ['session', '2'], ['evidence', '']]) {
    const invalid = structuredClone(value); invalid.trustedRoutes[0][key] = replacement;
    assert.throws(() => normalizeConfig(invalid));
  }
});
