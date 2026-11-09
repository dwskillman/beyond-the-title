#!/usr/bin/env node
// Dev-machine helper (optional, not part of using or publishing the builder).
// Copies the synthetic UTF-8 fixtures into builder.html between the FIXTURES markers,
// so "Try with sample data" and the built-in self-tests use exactly the committed files.
//   node tests/embed-fixtures.mjs          → rewrite builder.html
//   node tests/embed-fixtures.mjs --check  → exit 1 if builder.html is out of date
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const builder = join(root, 'builder', 'builder.html');
export const EMBEDDED = [
  'transcripts/synthetic-01-timestamped-speakers.txt',
  'transcripts/synthetic-02-speaker-blocks.txt',
  'transcripts/synthetic-03-cue-style.txt',
  'transcripts/synthetic-04-plain.txt',
  'transcripts/synthetic-05-low-signal.txt',
  'transcripts/synthetic-06-webvtt-voices.txt',
  'transcripts/synthetic-07-speaker-lines.txt',
  'data/edge-cases.stories.json',
  'data/legacy-array.stories.json',
  'data/duplicate-ids.stories.json'
];

export function buildBlock() {
  const parts = ['<!-- FIXTURES:BEGIN -->'];
  for (const rel of EMBEDDED) {
    const text = readFileSync(join(root, 'fixtures', rel), 'utf8');
    if (/<\/script|<!--/i.test(text)) throw new Error(`${rel} contains "</script" or "<!--" and cannot be embedded safely`);
    const name = rel.split('/').pop();
    parts.push(`<script type="text/plain" data-fixture="${name}">${text}</script>`);
  }
  parts.push('<!-- FIXTURES:END -->');
  return parts.join('\n');
}

/** Website files (site/) as base64 blocks, so the builder can install them into a project folder. */
export function siteFiles() {
  const base = join(root, 'site'), out = [];
  (function walk(d) { for (const n of readdirSync(d).sort()) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n !== 'README.md' && !n.startsWith('.')) out.push(p.slice(base.length + 1)); } })(base);
  return out;
}
export function buildSiteBlock() {
  const parts = ['<!-- SITE:BEGIN -->'];
  for (const rel of siteFiles()) parts.push(`<script type="text/plain" data-site-file="${rel}">${readFileSync(join(root, 'site', rel)).toString('base64')}</script>`);
  parts.push('<!-- SITE:END -->');
  return parts.join('\n');
}

/** The admin guide, shown on the builder's Help page. */
export function buildDocsBlock() {
  const text = readFileSync(join(root, 'docs', 'admin-guide.md'), 'utf8');
  if (/<\/script|<!--/i.test(text)) throw new Error('admin-guide.md contains "</script" or "<!--"');
  return ['<!-- DOCS:BEGIN -->', `<script type="text/plain" data-doc="admin-guide.md">${text}</script>`, '<!-- DOCS:END -->'].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const html = readFileSync(builder, 'utf8');
  const re = /<!-- FIXTURES:BEGIN -->[\s\S]*?<!-- FIXTURES:END -->/;
  const reSite = /<!-- SITE:BEGIN -->[\s\S]*?<!-- SITE:END -->/;
  const reDocs = /<!-- DOCS:BEGIN -->[\s\S]*?<!-- DOCS:END -->/;
  if (!re.test(html) || !reSite.test(html) || !reDocs.test(html)) { console.error('FIXTURES/SITE/DOCS markers not found in builder.html'); process.exit(2); }
  const next = html.replace(re, buildBlock()).replace(reSite, buildSiteBlock()).replace(reDocs, () => buildDocsBlock());
  if (process.argv.includes('--check')) {
    if (next !== html) { console.error('Embedded fixtures, website files or admin guide are out of date. Run: node tests/embed-fixtures.mjs'); process.exit(1); }
    console.log('Embedded fixtures match /fixtures and website files match /site.');
  } else {
    writeFileSync(builder, next);
    console.log(`Embedded ${EMBEDDED.length} fixtures and ${siteFiles().length} website files into builder/builder.html`);
  }
}
