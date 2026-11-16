#!/usr/bin/env node
// Builds tools/syndicate-check.zip: the Syndicate check page plus a synthetic video and captions.
// Files sit at the top level of the zip (index.html, css/, js/, data/, media/), as Syndicate expects.
//   node tests/make-syndicate-check.mjs
import { mkdtempSync, cpSync, copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'btt-syndicate-check-'));
cpSync(join(ROOT, 'tools', 'syndicate-check'), work, { recursive: true, filter: (p) => !p.endsWith('README.md') });
mkdirSync(join(work, 'media'));
copyFileSync(join(ROOT, 'fixtures', 'media', 'synthetic-01-timestamped-speakers.mp4'), join(work, 'media', 'check.mp4'));
copyFileSync(join(ROOT, 'fixtures', 'media', 'synthetic-01-timestamped-speakers.vtt'), join(work, 'media', 'check.vtt'));
const out = join(ROOT, 'tools', 'syndicate-check.zip');
if (existsSync(out)) rmSync(out);
execFileSync('zip', ['-X', '-r', out, 'index.html', 'css', 'js', 'data', 'media'], { cwd: work });
rmSync(work, { recursive: true, force: true });
console.log('Wrote ' + out);
