import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { resolveConfiguredCourses, RESOLVE_COURSE_REASONS } from '../src/resolve-courses.mjs';

const specs = [
  { courseCode: 'EXAMPLE-107', moduleId: '901', packageIds: ['910010', '910011', '910012', '910013', '910014', '910015', '910016', '910017'] },
  { courseCode: 'EXAMPLE-108', moduleId: '902', packageIds: ['910018', '910019', '910020'] },
];
function harness({ origin = 'https://tss.ucsd.edu', intercept, timeout = false } = {}) {
  const calls = [];
  const response = (value, options = {}) => ({ ok: (options.status || 200) < 400, status: options.status || 200,
    headers: { get(name) { return name === 'content-type' ? options.type || 'application/json' : null; } },
    text: async () => options.text ?? JSON.stringify({ value, ...options.envelope }),
  });
  const window = { location: new Proxy({ origin }, { set() { throw Error('Navigation forbidden'); } }),
    async fetch(url, init) {
      calls.push({ url, init });
      assert.equal(init.method, 'GET'); assert.equal(init.body, undefined);
      assert.equal(init.credentials, 'same-origin'); assert.equal(init.redirect, 'error');
      const parsed = new URL(url);
      assert.equal(parsed.origin, 'https://tss.ucsd.edu');
      assert.ok(parsed.pathname.startsWith('/sap/opu/odata4/sap/yucsd_con_module_sb/srvd/sap/yucsd_con_module_servicedef/0001/'));
      if (timeout) return new Promise(() => {});
      const override = await intercept?.({ parsed, init, response });
      if (override) return override;
      if (parsed.pathname.endsWith('/_sections')) {
        const spec = specs.find(item => parsed.pathname.includes(`ModuleID='${item.moduleId}'`));
        assert.ok(spec);
        return response(spec.packageIds.map(id => ({ AcYear: '2099', AcPeriod: '001', ModuleID: spec.moduleId, EventPkgObjid: id.padStart(8, '0'), StudentID: 'DO_NOT_EXPOSE' })));
      }
      const spec = specs.find(item => parsed.searchParams.get('$filter')?.includes(`CourseAbbr eq '${item.courseCode}'`));
      assert.ok(spec);
      return response([{ AcademicYear: '2099', AcademicPeriod: '1', ModuleID: spec.moduleId, CourseAbbr: spec.courseCode, StudentName: 'DO_NOT_EXPOSE' }]);
    } };
  Object.defineProperty(window, 'sap', { get() { throw Error('UI5 forbidden'); } });
  const context = { window, URL, AbortController,
    setTimeout: timeout ? callback => setTimeout(callback, 0) : setTimeout, clearTimeout };
  Object.defineProperty(context, 'document', { get() { throw Error('DOM forbidden'); } });
  const operation = runInNewContext(`(${resolveConfiguredCourses.toString()})`, context);
  return { calls, response, async run() { return JSON.parse(JSON.stringify(await operation())); } };
}

test('serialized fixed two-course lookup verifies all eleven packages using GET only', async () => {
  const h = harness(); const result = await h.run();
  assert.deepEqual(result, { resolved: true, courses: specs, failures: [] });
  assert.equal(h.calls.length, 4);
  assert.ok(!JSON.stringify(result).includes('DO_NOT_EXPOSE'));
  for (const call of h.calls.filter(call => !new URL(call.url).pathname.endsWith('/_sections'))) {
    const query = new URL(call.url).searchParams;
    assert.match(query.get('$filter'), /^AcademicYear eq '2099' and AcademicPeriod eq '1' and CourseAbbr eq '(EXAMPLE-107|EXAMPLE-108)'$/);
    assert.equal(query.get('$select'), 'AcademicYear,AcademicPeriod,ModuleID,CourseAbbr');
  }
});

test('off-origin login pages cannot issue catalog requests', async () => {
  const h = harness({ origin: 'https://a5.ucsd.edu' }); const result = await h.run();
  assert.equal(result.resolved, false); assert.equal(h.calls.length, 0);
  assert.ok(result.failures.every(item => item.reason === 'authentication_required'));
});

test('exact course and term are validated, numeric module IDs are never inferred', async () => {
  for (const change of [{ CourseAbbr: 'EXAMPLE-998' }, { AcademicYear: '2025' }, { AcademicPeriod: '4' }, { ModuleID: '910010junk' }, { ModuleID: '' }]) {
    const h = harness({ intercept({ parsed, response }) {
      if (!parsed.pathname.endsWith('/_sections')) return response([{ AcademicYear: '2099', AcademicPeriod: '1', CourseAbbr: 'EXAMPLE-107', ModuleID: '901', ...change }]);
    } });
    const result = await h.run();
    assert.equal(result.courses.length, 0); assert.ok(result.failures.every(item => item.reason === 'course_mismatch'));
    assert.equal(h.calls.length, 2);
  }
});

test('ambiguous, absent, paginated and malformed course responses fail closed', async () => {
  for (const [value, envelope, reason] of [[[], undefined, 'course_not_found'], [[{}, {}], undefined, 'course_ambiguous'], [[{}], { '@odata.nextLink': 'DO_NOT_EXPOSE' }, 'unsupported_response'], [[null], undefined, 'unsupported_response']]) {
    const h = harness({ intercept({ response }) { return response(value, { envelope }); } });
    const result = await h.run(); assert.equal(result.courses.length, 0);
    assert.ok(result.failures.every(item => item.reason === reason));
    assert.ok(!JSON.stringify(result).includes('DO_NOT_EXPOSE'));
  }
});

test('packages must belong to the resolved module and term, with every known package present', async () => {
  for (const [row, reason] of [[{ AcYear: '2099', AcPeriod: '1', ModuleID: '901', EventPkgObjid: '910010' }, 'package_missing'],
    [{ AcYear: '2025', AcPeriod: '1', ModuleID: '901', EventPkgObjid: '910010' }, 'package_mismatch']]) {
    const h = harness({ intercept({ parsed, response }) { if (parsed.pathname.includes("ModuleID='901'")) return response([row]); } });
    const result = await h.run();
    assert.deepEqual(result.courses, [specs[1]]); assert.deepEqual(result.failures, [{ courseCode: 'EXAMPLE-107', reason }]);
  }
});

test('HTTP, authentication, HTML, invalid JSON, and network errors expose fixed reasons only', async () => {
  for (const [options, reason] of [[{ status: 401 }, 'authentication_required'], [{ status: 503 }, 'lookup_http_error'],
    [{ type: 'text/html' }, 'unsupported_response'], [{ text: 'SECRET-not-json' }, 'unsupported_response'], [{ network: true }, 'lookup_network_error']]) {
    const h = harness({ intercept({ response }) { if (options.network) throw Error('SECRET-network'); return response([], options); } });
    const result = await h.run();
    assert.ok(result.failures.every(item => item.reason === reason && RESOLVE_COURSE_REASONS.includes(item.reason)));
    assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
});

test('a hung upstream read has a bounded timeout and never starts package reads', async () => {
  const h = harness({ timeout: true }); const result = await h.run();
  assert.equal(h.calls.length, 2); assert.ok(h.calls.every(call => call.init.signal.aborted));
  assert.ok(result.failures.every(item => item.reason === 'lookup_timeout'));
});
