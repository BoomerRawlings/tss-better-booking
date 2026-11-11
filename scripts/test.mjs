import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { configure, root } from './configure.mjs';

// Synthetic catalogs are used only while local tests execute. Restore the
// normal demo/local generated files even when a test fails.
await configure({ fixture: true });
try {
  const locations = ['workers/booking/test', 'test', 'scripts'];
  const files = [];
  for (const location of locations) {
    for (const item of await readdir(path.join(root, location))) if (item.endsWith('.test.mjs') || /^test-.+\.mjs$/.test(item)) files.push(path.join(location, item));
  }
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' });
    child.on('error', reject); child.on('exit', resolve);
  });
  process.exitCode = code ?? 1;
} finally { await configure(); }
