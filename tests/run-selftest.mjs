#!/usr/bin/env node
// Dev-machine helper (optional). Runs the builder's built-in self-tests in headless Chrome
// (builder.html opened from disk, as on the corporate Mac) and prints each result.
// The same tests can be run by hand: Diagnostics → Built-in self-tests → Run self-tests.
//   node tests/run-selftest.mjs
import { launch, openPage } from './cdp.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await launch();
let code = 1;
try {
  const p = await openPage(browser, `file://${join(root, 'builder', 'builder.html')}#/dashboard`);
  const r = await p.eval(`window.BTT.SelfTest.run().then((r) => ({ passed: r.passed, failed: r.failed, failures: r.results.filter((x) => !x.ok).map((x) => x.name + ': ' + x.error), ms: r.ms, results: r.results.map((x) => [x.ok, x.name]) }))`);
  for (const [ok, name] of r.results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  for (const f of r.failures) console.log('     ' + f);
  if (p.errors.length) console.log('Console errors:\n  ' + p.errors.join('\n  '));
  console.log(`SELFTEST ${r.failed || p.errors.length ? 'FAIL' : 'PASS'} ${r.passed}/${r.passed + r.failed} (${r.ms} ms)`);
  code = r.failed || p.errors.length ? 1 : 0;
} finally { await browser.close(); }
process.exit(code);
