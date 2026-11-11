import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
const plain = (value, field, limit = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) throw Error(`Invalid ${field}.`);
  return value.trim();
};
const optional = (value, field, limit) => value == null || value === '' ? '' : plain(value, field, limit);
const list = (value, field, limit) => {
  if (!Array.isArray(value) || value.length > limit) throw Error(`Invalid ${field}.`);
  return value;
};
const keys = (value, names, field) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !names.includes(key))) throw Error(`Unexpected ${field} fields.`);
};
const id = (value, field) => {
  if (typeof value !== 'string' || !/^[1-9]\d{0,7}$/.test(value)) throw Error(`Invalid ${field}.`);
  return value;
};
const identity = option => {
  const moduleId = id(option.moduleId, 'module ID'), packageId = id(option.packageId, 'package ID');
  if (typeof option.year !== 'string' || !/^\d{4}$/.test(option.year) || typeof option.session !== 'string' || !/^[1-9]\d{0,2}$/.test(option.session)) throw Error('Invalid academic year/session.');
  return { moduleId, packageId, year: option.year, session: option.session };
};
export const routeFor = ({ moduleId, packageId, year, session }) => `https://tss.ucsd.edu/fiori#ZUSModule-display?TileType=MYMOD&/Detail/EventPackage/SM/${moduleId}/00000000/0/0/0/00000000-0000-0000-0000-000000000000/${packageId}/${year}/${session}/?`;

export function normalizeConfig(input, { fixture = false } = {}) {
  keys(input, ['site', 'auth', 'service', 'people', 'catalogLookups', 'trustedRoutes'], 'configuration');
  keys(input.site, ['title', 'term', 'origin', 'demo'], 'site');
  const origin = new URL(input.site.origin);
  if (origin.origin !== input.site.origin || origin.protocol !== 'https:' || origin.username || origin.password) throw Error('site.origin must be one HTTPS origin.');
  if (typeof input.site.demo !== 'boolean') throw Error('site.demo must be boolean.');
  const site = { title: plain(input.site.title, 'site title', 80), term: plain(input.site.term, 'term', 80), origin: origin.origin, demo: input.site.demo };
  keys(input.auth, ['duoOrigin'], 'authentication');
  if (!/^https:\/\/api-[a-f0-9]{8}\.duosecurity\.com$/.test(input.auth.duoOrigin || '')) throw Error('Configure one exact observed Duo tenant origin.');
  keys(input.service, ['probeOnly', 'directBookingEnabled', 'maxBrowserSessions', 'maxSessionMinutes', 'monthlyBrowserMinutes'], 'service');
  const service = input.service;
  if (typeof service.probeOnly !== 'boolean' || typeof service.directBookingEnabled !== 'boolean') throw Error('Service gates must be booleans.');
  for (const [key, max] of [['maxBrowserSessions', 8], ['maxSessionMinutes', 15], ['monthlyBrowserMinutes', service.probeOnly ? 150 : 600]]) {
    if (!Number.isInteger(service[key]) || service[key] < (key === 'monthlyBrowserMinutes' ? 0 : 1) || service[key] > max) throw Error(`Invalid service.${key}.`);
  }
  if (service.probeOnly && service.maxBrowserSessions !== 1) throw Error('Probe mode permits one browser.');
  if (service.directBookingEnabled && service.probeOnly) throw Error('Direct booking and probe-only cannot both be enabled.');
  if (!service.probeOnly && !service.directBookingEnabled) throw Error('Live booking requires the verified direct path; native write fallback is disabled.');
  const packages = new Map(), peopleIds = new Set();
  const people = list(input.people, 'people', 50).map(person => {
    keys(person, ['id', 'name', 'major', 'courses'], 'person');
    if (!/^[a-z][a-z0-9-]{0,49}$/.test(person.id || '') || peopleIds.has(person.id)) throw Error('Person IDs must be unique lowercase slugs.');
    peopleIds.add(person.id);
    return { id: person.id, name: plain(person.name, 'display name', 100), major: optional(person.major, 'major', 100),
      courses: list(person.courses, 'courses', 30).map(course => {
        keys(course, ['code', 'title', 'category', 'options'], 'course');
        if (!/^[A-Z]{2,12}-\d{1,4}[A-Z]?$/.test(course.code || '')) throw Error('Course codes must be canonical, for example EXAMPLE-101.');
        return { code: course.code, title: plain(course.title, 'course title', 180), category: plain(course.category, 'course category', 100),
          options: list(course.options, 'course options', 100).map(option => {
            keys(option, ['label', 'moduleId', 'packageId', 'year', 'session', 'meetings', 'instructors'], 'course option');
            const target = identity(option), route = routeFor(target), entry = { courseCode: course.code, ...target, route };
            const previous = packages.get(route);
            if (previous && previous.courseCode !== course.code) throw Error('One route cannot name two courses.');
            packages.set(route, entry);
            return { ...target, route, label: plain(option.label, 'option label', 200), verified: false,
              instructors: list(option.instructors || [], 'instructors', 20).map(name => plain(name, 'instructor', 100)),
              meetings: list(option.meetings || [], 'meetings', 100).map(meeting => {
                keys(meeting, ['kind', 'days', 'date', 'startDate', 'endDate', 'startTime', 'endTime', 'location'], 'meeting');
                const result = {};
                for (const key of ['kind', 'date', 'startDate', 'endDate', 'startTime', 'endTime', 'location']) if (meeting[key]) result[key] = plain(meeting[key], key, key === 'location' ? 200 : 40);
                if (meeting.days) result.days = list(meeting.days, 'meeting days', 7).map(day => plain(day, 'meeting day', 20));
                return result;
              }),
            };
          }),
        };
      }),
    };
  });
  if (packages.size > 200) throw Error('At most 200 exact booking options are supported.');
  const trusted = new Set();
  for (const proof of list(input.trustedRoutes || [], 'trusted routes', 200)) {
    keys(proof, ['courseCode', 'moduleId', 'packageId', 'year', 'session', 'evidence'], 'route proof');
    const target = identity(proof), route = routeFor(target), entry = packages.get(route);
    if (!entry || entry.courseCode !== proof.courseCode) throw Error('Trusted route is not an exact configured course option.');
    plain(proof.evidence, 'route proof evidence', 500);
    trusted.add(route);
  }
  if (site.demo && !fixture && (trusted.size || service.directBookingEnabled || !service.probeOnly)) throw Error('Demo configuration must remain probe-only with no trusted routes.');
  if (service.directBookingEnabled && !trusted.size) throw Error('Direct booking requires independently verified exact routes.');
  for (const person of people) for (const course of person.courses) for (const option of course.options) option.verified = trusted.has(option.route);
  const lookups = list(input.catalogLookups || [], 'catalog lookups', 50).map(code => {
    const entries = [...packages.values()].filter(item => item.courseCode === code);
    if (!entries.length || new Set(entries.map(item => item.year + '/' + item.session)).size !== 1) throw Error('Catalog lookups require one configured term per course.');
    return { courseCode: code, packageIds: entries.map(item => item.packageId), year: entries[0].year, session: entries[0].session };
  });
  if (new Set(lookups.map(item => item.courseCode)).size !== lookups.length) throw Error('Duplicate catalog lookup.');
  return { publicConfig: { site, people }, packages: [...packages.values()], trusted: [...trusted], lookups, service, duoOrigin: input.auth.duoOrigin };
}

const output = async (relative, text) => {
  const destination = path.join(root, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, text);
};
export async function configure({ fixture = false, deploy = false } = {}) {
  let contents;
  if (fixture) contents = await readFile(path.join(root, 'test/fixtures/config.json'), 'utf8');
  else {
    try { contents = await readFile(path.join(root, 'config.local.json'), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; contents = await readFile(path.join(root, 'config.example.json'), 'utf8'); }
  }
  const config = normalizeConfig(JSON.parse(contents), { fixture });
  if (deploy && (fixture || config.publicConfig.site.demo || /(?:^|\.)example\.(?:org|com|net)$/.test(new URL(config.publicConfig.site.origin).hostname)
    || config.duoOrigin === 'https://api-00000000.duosecurity.com')) throw Error('Configure your own origin and observed Duo tenant in ignored config.local.json before deployment.');
  await output('src/generated/public-config.mjs', `// Generated from local configuration; never commit this file.\nexport default ${JSON.stringify(config.publicConfig, null, 2)};\n`);
  await output('workers/booking/src/generated/config.mjs', `// Generated; never commit local configuration.\nexport const PACKAGES = ${JSON.stringify(config.packages)};\nexport const TRUSTED_ROUTES = ${JSON.stringify(config.trusted)};\nexport const CATALOG_PACKAGES = ${JSON.stringify(Object.fromEntries(config.lookups.map(item => [item.courseCode, item.packageIds])))};\nexport const DUO_ORIGIN = ${JSON.stringify(config.duoOrigin)};\n`);
  for (const [file, marker, value] of [['direct-tss', '__TBB_PACKAGES__', config.packages], ['resolve-courses', '__TBB_LOOKUPS__', config.lookups]]) {
    const template = await readFile(path.join(root, `workers/booking/templates/${file}.mjs`), 'utf8');
    if (template.split(marker).length !== 2) throw Error('Invalid generated adapter template.');
    await output(`workers/booking/src/generated/${file}.mjs`, template.replace(marker, JSON.stringify(value)));
  }
  const wrangler = JSON.parse(await readFile(path.join(root, 'wrangler.example.json'), 'utf8'));
  wrangler.vars = { APP_ORIGIN: config.publicConfig.site.origin, PROBE_ONLY: String(config.service.probeOnly), DIRECT_BOOKING_ENABLED: String(config.service.directBookingEnabled),
    MAX_BROWSER_SESSIONS: String(config.service.maxBrowserSessions), MAX_SESSION_MINUTES: String(config.service.maxSessionMinutes), MONTHLY_BROWSER_MINUTES: String(config.service.monthlyBrowserMinutes) };
  await output('wrangler.local.jsonc', JSON.stringify(wrangler, null, 2) + '\n');
  return config;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await configure({ fixture: process.argv.includes('--fixture'), deploy: process.argv.includes('--deploy') });
  console.log('Local configuration generated.');
}
