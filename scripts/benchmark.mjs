// Node >=24. No dependencies. Supply private locations through arguments only.
// All direct-adapter fetches are replaced by an in-memory fixture. Never sign in.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { performance } from 'node:perf_hooks';

const args = Object.fromEntries(Array.from({ length: Math.floor((process.argv.length - 2) / 2) }, (_, index) =>
  [process.argv[2 + index * 2].replace(/^--/, ''), process.argv[3 + index * 2]]));
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(args['output-dir'] || path.join(root, '.benchmark'));
const worker = path.join(root, 'workers/booking');
const pageValue = args['page-url'] || process.env.BENCHMARK_PAGE_URL;
const healthValue = args['health-url'] || process.env.BENCHMARK_HEALTH_URL;
assert.equal(Boolean(pageValue), Boolean(healthValue), 'Supply both page and health URLs, or neither');
const startedAt = new Date().toISOString();
const round = value => Number(value.toFixed(2));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = value => createHash('sha256').update(value).digest('hex');
const summary = values => ({ min: round(Math.min(...values)), median: round([...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]), max: round(Math.max(...values)) });
async function measurePublicHttp() {
  if (!pageValue) return [];
  const pageUrl = new URL(pageValue), healthUrl = new URL(healthValue);
  assert.equal(pageUrl.protocol, 'https:'); assert.equal(healthUrl.origin, pageUrl.origin);
  for (const url of [pageUrl, healthUrl]) assert.ok(!url.username && !url.password && !url.search && !url.hash, 'Public benchmark URLs must not contain credentials or query/fragment data');
  assert.ok(!pageUrl.pathname.includes('/api/'), 'The page target must be a public static page, not a session API');
  assert.ok(/\/health\/?$/.test(healthUrl.pathname), 'Only the public non-session health endpoint is allowed');
  assert.ok(!/(?:^|\.)ucsd\.edu$/.test(pageUrl.hostname) && !/(?:^|\.)duosecurity\.com$/.test(pageUrl.hostname), 'Do not benchmark institutional sign-in or enrollment services');
  args['dist-dir'] ||= path.join(root, 'dist'); args['page-file'] ||= 'booking/index.html';
  const localHtml = await readFile(path.resolve(args['dist-dir'], args['page-file']), 'utf8');
  const assetReferences = html => [
    ...[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => ({ type: 'script', href: match[1] })),
    ...[...html.matchAll(/<link\b[^>]*\bhref="([^"]+\.css(?:\?[^"]*)?)"/g)].map(match => ({ type: 'style', href: match[1] })),
  ];
  const references = assetReferences(localHtml);
  assert.ok(references.length > 0 && references.length <= 12, 'Unexpected asset count');
  const publicTargets = [
    { label: 'page', url: pageUrl, expected: Buffer.from(localHtml) },
    { label: 'health', url: healthUrl },
  ];
  const counters = { script: 0, style: 0 };
  for (const reference of references) {
    const url = new URL(reference.href, pageUrl);
    assert.equal(url.origin, pageUrl.origin, 'No third-party asset requests');
    const file = path.resolve(args['dist-dir'], '.' + decodeURIComponent(url.pathname));
    assert.ok(file.startsWith(path.resolve(args['dist-dir']) + path.sep), 'Asset must be inside the supplied build');
    publicTargets.push({ label: reference.type + (++counters[reference.type]), url, expected: await readFile(file) });
  }
  const http = [];
  for (const target of publicTargets) {
    const samples = [];
    for (let index = 0; index < 5; index++) {
      const start = performance.now();
      const response = await fetch(target.url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000) });
      const headersMs = performance.now() - start;
      const body = Buffer.from(await response.arrayBuffer());
      const bodyMs = performance.now() - start;
      assert.equal(response.status, 200, 'Unexpected reference response status');
      assert.ok(body.length < 5_000_000, 'Unexpected response size');
      if (target.label === 'page') assert.deepEqual(assetReferences(body.toString()), references, 'Deployment references differ from local build');
      samples.push({ responseHeadersMs: round(headersMs), completeBodyMs: round(bodyMs), decodedBodyBytes: body.length,
        status: response.status, ...(target.expected ? { byteEquivalent: hash(body) === hash(target.expected) } : {}) });
      await sleep(200);
    }
    http.push({ target: target.label, samples, responseHeadersMs: summary(samples.map(item => item.responseHeadersMs)),
      completeBodyMs: summary(samples.map(item => item.completeBodyMs)), decodedBodyBytes: samples[0].decodedBodyBytes,
      ...(target.expected ? { allSamplesByteEquivalent: samples.every(item => item.byteEquivalent) } : {}) });
  }
  assert.ok(http.filter(row => row.target !== 'health').every(row => row.allSamplesByteEquivalent), 'Deployed bytes differ from supplied build');
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'public-http.json'), JSON.stringify({ measuredAt: startedAt, targets: http }, null, 2) + '\n');

  return http;
}
const http = await measurePublicHttp();
// Use the same template substitution as configure, in memory only. Do not
// replace local generated files or let benchmark fixture IDs enter a build.
const { normalizeConfig } = await import('./configure.mjs');
const example = normalizeConfig(JSON.parse(await readFile(path.join(root, 'config.example.json'), 'utf8')));
const identity = example.packages[0];
assert.ok(example.publicConfig.site.demo && identity?.courseCode.startsWith('EXAMPLE-') && identity.year === '2099', 'Benchmark needs the fictional example catalog');
const route = identity.route;
const template = await readFile(path.join(worker, 'templates/direct-tss.mjs'), 'utf8');
assert.equal(template.split('__TBB_PACKAGES__').length, 2);
const generated = template.replace('__TBB_PACKAGES__', JSON.stringify(example.packages));
const { directTssOperation } = await import('data:text/javascript;base64,' + Buffer.from(generated).toString('base64'));
const { authenticationProbe } = await import(pathToFileURL(path.join(worker, 'src/authentication.mjs')));
const targetOrigin = new URL(route).origin;
const scenarios = [
  { id: 'full_flags_single_component', description: 'Template and credit fields enabled; exam read enabled; verified standard native path.' },
  { id: 'optional_tabs_hidden', description: 'Template and credit fields disabled; exam tab hidden.' },
  { id: 'header_has_template', description: 'Header already has a template; template display remains enabled.' },
  { id: 'three_components', description: 'Three distinct event types; one selectable event each.' },
  { id: 'check_warning_confirmed', description: 'Check warning; harness explicitly confirms once, excluding human deliberation time.' },
  { id: 'eligibility_stop', description: 'Header eligibility disallows booking; no action request dispatched.' },
  { id: 'save_rejected', description: 'Save returns a semantic error; no automatic retry.' },
  { id: 'save_reply_lost', description: 'Synthetic Save reply is lost; result remains uncertain with no retry.' },
];

async function simulate(scenario, delayMs) {
  const started = performance.now();
  const trace = [], timers = new Set();
  let inFlight = 0, maxConcurrent = 0, saved = false, phase = 'authentication', domReads = 0, navigationAttempts = 0;
  let saveSentAtMs, saveResponseAtMs, confirmationCount = 0;
  const base = {
    settings: [
      { Name: 'ENABLE_AUTOBOOK', Value: '' }, { Name: 'ENABLE_TOP_MODULE_BOOKING', Value: 'X' },
      { Name: 'SHOW_TEMPLATE', Value: 'X' }, { Name: 'SHOW_CREDITS', Value: 'X' },
      { Name: 'HIDE_TAB_EXAM', Value: '' }, { Name: 'HIDE_TAB_EVENT', Value: '' },
    ],
    header: { SmObjid: identity.moduleId.padStart(8, '0'), SmOtype: 'SM', SmShort: identity.courseCode,
      AcademicYear: identity.year, AcademicSession: identity.session.padStart(3, '0'), EventPackageId: '00000000', AssignedCg: '00000200',
      TemplateId: '0000', IsTemplateUpdateable: true, Credits: '4.000', CreditUnit: 'UN',
      ModregId: '12341234-1234-1234-1234-123456789abc', SmStatus: '00',
      BookingCheckLog: { results: [] }, CreditOptions: { results: [] } },
    events: [{ EventId: '00001234', DObjid: '00000100', SmObjid: identity.moduleId.padStart(8, '0'),
      AcademicYear: identity.year, AcademicSession: identity.session.padStart(3, '0'), EventPackageId: '00000000', Booked: false,
      BookingCheckLog: { results: [] } }],
    groups: [{ ScObjid: '00009000', CgObjid: '00000200', CgTopObjid: '00000101', Bookable: true, Selected: true, IsDefault: false }],
    package: { BookingButtonEnabled: true, WithdrawButtonEnabled: false },
    exams: [], templates: [{ TemplateId: '0001', IsDefault: true }],
    check: { MessageType: '', Message: '' }, save: { MessageType: '' },
  };
  if (scenario.id === 'optional_tabs_hidden') for (const row of base.settings) {
    if (['SHOW_TEMPLATE', 'SHOW_CREDITS'].includes(row.Name)) row.Value = '';
    if (row.Name === 'HIDE_TAB_EXAM') row.Value = 'X';
  }
  if (scenario.id === 'header_has_template') base.header.TemplateId = '0001';
  if (scenario.id === 'three_components') base.events = [0, 1, 2].map(index => ({ ...base.events[0], EventId: String(1234 + index), DObjid: String(100 + index) }));
  if (scenario.id === 'check_warning_confirmed') base.check = { MessageType: 'W', Message: 'Synthetic warning requiring confirmation.' };
  if (scenario.id === 'eligibility_stop') base.header.BookingCheckLog.results.push({ RulecheckResult: 'N' });
  if (scenario.id === 'save_rejected') base.save.MessageType = 'E';
  const parsedLocation = new URL(route);
  const location = { origin: parsedLocation.origin, protocol: parsedLocation.protocol, hostname: parsedLocation.hostname, pathname: parsedLocation.pathname };
  const window = { location: new Proxy(location, { set() { navigationAttempts++; throw Error('Synthetic navigation forbidden'); } }) };
  const response = value => ({ ok: true, status: 200, headers: { get: name => ({ 'content-type': 'application/json', 'x-csrf-token': 'fixture-only-token' })[name.toLowerCase()] || null },
    text: async () => JSON.stringify({ d: structuredClone(value) }) });
  window.fetch = async (url, init) => {
    const parsed = new URL(url), payload = init.body ? JSON.parse(init.body) : undefined;
    assert.equal(parsed.origin, targetOrigin); assert.equal(init.credentials, 'same-origin'); assert.equal(init.redirect, 'error');
    let resource, value;
    if (payload) {
      assert.ok(['CheckRegistration', 'SaveChanges'].includes(payload.ActionName));
      assert.ok(payload.Items.length === base.events.length);
      resource = payload.ActionName === 'CheckRegistration' ? 'check' : 'save'; value = base[resource];
      if (resource === 'save') saveSentAtMs = performance.now() - started;
    } else if (parsed.pathname.endsWith('/PR_MY_MODULES_V2_SRV/')) { resource = 'service'; value = { EntitySets: [] }; }
    else if (parsed.pathname.endsWith('/ParameterSet')) { resource = 'settings'; value = { results: base.settings }; }
    else if (parsed.pathname.endsWith('/Event')) { resource = 'events'; value = { results: base.events.map(event => saved ? { ...event, Booked: true, Deleted: false, WaitlistBooking: false } : event) }; }
    else if (parsed.pathname.endsWith('/ModuleGroup')) { resource = 'groups'; value = { results: base.groups }; }
    else if (parsed.pathname.endsWith('/Exam')) { resource = 'exams'; value = { results: base.exams }; }
    else if (parsed.pathname.endsWith('/Template')) { resource = 'templates'; value = { results: base.templates }; }
    else if (parsed.pathname.includes('/EventPackageSet(')) { resource = 'package'; value = base.package; }
    else if (parsed.pathname.includes('/ModuleHeaderSet(')) { resource = 'header'; value = saved ? { ...base.header, WaitlistBooking: false } : base.header; }
    else throw Error('Unmodeled fixture request');
    const entry = { sequence: trace.length + 1, phase, method: init.method, resource, startMs: round(performance.now() - started) };
    trace.push(entry); inFlight++; maxConcurrent = Math.max(maxConcurrent, inFlight);
    try {
      if (delayMs) await sleep(delayMs);
      if (resource === 'save' && scenario.id === 'save_reply_lost') throw new TypeError('Synthetic lost reply');
      if (resource === 'save') {
        saveResponseAtMs = performance.now() - started;
        saved = base.save.MessageType !== 'E';
        if (saved) phase = 'verification';
      }
      return response(value);
    } finally { entry.endMs = round(performance.now() - started); inFlight--; }
  };
  const sandbox = { window, URL, AbortController, AbortSignal, crypto: webcrypto,
    setTimeout(callback, ms) { const timer = setTimeout(callback, ms); timer.unref(); timers.add(timer); return timer; },
    clearTimeout(timer) { clearTimeout(timer); timers.delete(timer); } };
  Object.defineProperty(sandbox, 'document', { get() { domReads++; throw Error('Synthetic DOM access forbidden'); } });
  Object.defineProperty(window, 'sap', { get() { throw Error('Optional identity metadata absent'); } });
  const auth = runInNewContext(`(${authenticationProbe.toString()})`, sandbox);
  const operation = runInNewContext(`(${directTssOperation.toString()})`, sandbox);
  try {
    assert.equal((await auth({ requireShell: false })).status, 'authenticated');
    phase = 'booking';
    const requestId = randomUUID();
    operation({ operation: 'book', route, courseCode: identity.courseCode, requestId, allowWrites: true, standardNativeVerified: true });
    let result;
    while (performance.now() - started < 15_000) {
      result = operation({ operation: 'status', requestId });
      if (result.stage === 'review') {
        assert.equal(scenario.id, 'check_warning_confirmed'); assert.equal(confirmationCount++, 0);
        phase = 'confirmation';
        operation({ operation: 'confirm', requestId, confirmationId: result.confirmationId, allowWrites: true });
      } else if (['submitted', 'stopped', 'error'].includes(result.stage)) break;
      await sleep(2);
    }
    assert.ok(['submitted', 'stopped', 'error'].includes(result.stage), 'Synthetic operation exceeded budget');
    const elapsedMs = performance.now() - started;
    const countBeforeReplay = trace.length;
    operation({ operation: 'book', route, courseCode: identity.courseCode, requestId, allowWrites: true, standardNativeVerified: true });
    operation({ operation: 'status', requestId });
    assert.equal(trace.length, countBeforeReplay, 'Replayed request identifier must not dispatch requests');
    assert.equal(domReads, 0); assert.equal(navigationAttempts, 0);
    const expected = scenario.id === 'eligibility_stop' ? ['stopped', 'eligibility_unavailable']
      : scenario.id === 'save_rejected' ? ['error', 'booking_error']
      : scenario.id === 'save_reply_lost' ? ['error', 'submission_uncertain'] : ['submitted', undefined];
    assert.equal(result.stage, expected[0]); assert.equal(result.reason, expected[1]);
    if (result.stage === 'submitted') assert.equal(result.outcome, 'booked');
    const requests = { total: trace.length, get: trace.filter(item => item.method === 'GET').length, post: trace.filter(item => item.method === 'POST').length,
      check: trace.filter(item => item.resource === 'check').length, save: trace.filter(item => item.resource === 'save').length, maxConcurrent };
    assert.ok(requests.save <= 1 && requests.check <= 1);
    const expectedTotal = scenario.id === 'check_warning_confirmed' ? 21 : scenario.id === 'eligibility_stop' ? 4
      : ['optional_tabs_hidden', 'save_rejected', 'save_reply_lost'].includes(scenario.id) ? 11 : 13;
    assert.equal(requests.total, expectedTotal, 'Current baseline request structure changed');
    return { elapsedMs: round(elapsedMs), ...(saveSentAtMs === undefined ? {} : { saveSentAtMs: round(saveSentAtMs) }),
      ...(saveResponseAtMs === undefined ? {} : { saveResponseAtMs: round(saveResponseAtMs) }), requests,
      stage: result.stage, ...(result.reason ? { reason: result.reason } : {}), ...(result.outcome ? { outcome: result.outcome } : {}),
      confirmationCount, domReads, navigationAttempts, requestsOnReplay: trace.length - countBeforeReplay, trace };
  } finally { for (const timer of timers) clearTimeout(timer); }
}
const synthetic = [];
for (const scenario of scenarios) for (const delayMs of args.quick === 'true' ? [0] : [0, 25, 100]) {
  const samples = [];
  for (let repeat = 0; repeat < (args.quick === 'true' ? 1 : 3); repeat++) samples.push(await simulate(scenario, delayMs));
  assert.ok(samples.every(sample => JSON.stringify(sample.requests) === JSON.stringify(samples[0].requests)), 'Request structure must be deterministic');
  assert.ok(samples.every(sample => sample.trace.map(item => item.phase + ':' + item.resource).join() === samples[0].trace.map(item => item.phase + ':' + item.resource).join()), 'Request order must be deterministic');
  synthetic.push({ scenario: scenario.id, description: scenario.description, simulatedRequestDelayMs: delayMs, repetitions: samples.length,
    requests: samples[0].requests, stage: samples[0].stage, ...(samples[0].reason ? { reason: samples[0].reason } : {}),
    ...(samples[0].outcome ? { outcome: samples[0].outcome } : {}), elapsedMs: summary(samples.map(sample => sample.elapsedMs)),
    ...(samples[0].saveSentAtMs === undefined ? {} : { saveSentAtMs: summary(samples.map(sample => sample.saveSentAtMs)) }),
    ...(samples[0].saveResponseAtMs === undefined ? {} : { saveResponseAtMs: summary(samples.map(sample => sample.saveResponseAtMs)) }),
    samples });
}
const report = {
  schemaVersion: 1, label: 'Reusable-template synthetic benchmark', measuredAt: startedAt, completedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  methods: { fixture: 'Fictional example catalog substituted into the same adapter template as configure; generated local files untouched.',
    synthetic: 'Current auth + direct functions in isolated VM; every fetch intercepted in memory; uniform delay per fetch; 2 ms requested status polling.',
    publicHttp: http.length ? 'Five sequential requests per public target, 200 ms spacing, 20 s timeout, no-store; local build bytes must match.' : 'Skipped: no reference URLs supplied.' },
  limitations: [
    'This is a fresh template benchmark, not the recorded deployed-reference baseline.',
    'No live login, institutional HTTP, enrollment action, or rush-load test occurs.',
    'Synthetic times include Node scheduling; exclude human login/review, Worker/CDP/storage, real server work, and queueing.',
    'Small single-client HTTP samples, when opted in, do not establish session readiness, capacity, or availability.',
    'Decoded body bytes are not compressed network transfer size. Connection and CDN cache reuse are uncontrolled.'
  ],
  publicHttp: { sampleCountPerTarget: http.length ? 5 : 0, totalRequests: http.reduce((sum, row) => sum + row.samples.length, 0), targets: http },
  synthetic,
};
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'run.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ report: '.benchmark/run.json (or supplied output directory)', publicRequests: report.publicHttp.totalRequests,
  syntheticCases: scenarios.length, syntheticRuns: synthetic.reduce((total, row) => total + row.repetitions, 0),
  cases: scenarios.map(scenario => { const rows = synthetic.filter(row => row.scenario === scenario.id); return { scenario: scenario.id,
    get: rows[0].requests.get, post: rows[0].requests.post, peakConcurrent: Math.max(...rows.map(row => row.requests.maxConcurrent)),
    medianMs: rows.map(row => ({ injectedDelayMs: row.simulatedRequestDelayMs, elapsedMs: row.elapsedMs.median })) }; }) }));
