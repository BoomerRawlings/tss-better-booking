import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(path.join(root, 'dist/booking/index.html'), 'utf8');
assert.match(html, /Content-Security-Policy/);
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 2, 'Both profile and session clients must be built');
for (const [, attributes, body] of scripts) {
  const src = /\bsrc="(\/_astro\/[^"?#]+\.js)"/.exec(attributes)?.[1];
  assert.ok(src, 'CSP requires external executable scripts');
  assert.equal(body.trim(), '', 'Do not inline executable scripts under self-only CSP');
  await access(path.join(root, 'dist', src));
}
assert.match(html, /data-tss-inspect-route=/, 'Read-only inspection must not depend on enabled Book controls');
const config = (await import(new URL('../src/generated/public-config.mjs', import.meta.url))).default;
if (config.site.demo) {
  assert.match(html, /data-demo="true"/);
  for (const match of html.matchAll(/<button\b[^>]*data-tss-book[^>]*>/g)) assert.match(match[0], /\bdisabled(?:\s|>|=)/);
  assert.match(html, /Template preview/);
}
console.log('Built page: external CSP-compatible scripts, inspection route, and demo controls verified.');
