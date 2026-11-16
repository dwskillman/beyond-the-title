#!/usr/bin/env node
// Dev-machine helper (optional, not part of using or publishing the builder).
// Copies the synthetic UTF-8 fixtures into builder.html between the FIXTURES markers,
// so "Try with sample data" and the built-in self-tests use exactly the committed files.
//   node tests/embed-fixtures.mjs          → rewrite builder.html
//   node tests/embed-fixtures.mjs --check  → exit 1 if builder.html is out of date
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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
const SITE_FILE_RE = /^(?:(?:index|share)\.html|LICENSE-fonts\.txt|css\/[a-z-]+\.css|js\/[a-z-]+\.js)$/;
export function siteFiles() {
  const base = join(root, 'site'), out = [];
  (function walk(d) { for (const n of readdirSync(d).sort()) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n !== 'README.md' && !n.startsWith('.')) out.push(p.slice(base.length + 1)); } })(base);
  // Only the website itself. If site/ was ever used as a project folder, its data/, stories/ and backups/ are never embedded.
  return out.filter((rel) => SITE_FILE_RE.test(rel));
}
export function buildSiteBlock() {
  const parts = ['<!-- SITE:BEGIN -->'];
  for (const rel of siteFiles()) parts.push(`<script type="text/plain" data-site-file="${rel}">${readFileSync(join(root, 'site', rel)).toString('base64')}</script>`);
  parts.push('<!-- SITE:END -->');
  return parts.join('\n');
}

/**
 * site/js/story-kit.js: the builder's pure text modules (Parser, Analyzer, Headlines, Descriptions, Quote, Zip, …),
 * copied verbatim from the story-kit regions of builder.html so the share page and the builder can never drift.
 */
export const KIT_PATH = join(root, 'site', 'js', 'story-kit.js');
export function buildStoryKit(html) {
  const re = /\/\* story-kit:BEGIN ([a-z-]+) \*\/\n([\s\S]*?)\/\* story-kit:END \*\/\n/g;
  const regions = []; let m;
  while ((m = re.exec(html))) regions.push({ name: m[1], code: m[2] });
  const names = regions.map((r) => r.name).join(',');
  if (names !== 'text-util,text,prepare,zip') throw new Error('Unexpected story-kit regions in builder.html: ' + names);
  const body = regions.map((r) => `/* ---- ${r.name} ---- */\n${r.code}`).join('\n');
  if (/\b(innerHTML|fetch|localStorage|sessionStorage|indexedDB|XMLHttpRequest)\b/.test(body)) throw new Error('story-kit regions must stay pure: no DOM writes, network or storage');
  return `/* GENERATED from the story-kit regions of builder/builder.html by tests/embed-fixtures.mjs. Do not edit by hand.
   The builder's own text tools (transcript parsing, name detection, quote, headline and description suggestions,
   zip), shared with the share page so both give identical results. No network, no storage, no DOM writes. */
(function () {
  'use strict';
${body}
  const Util = TextUtil; // eslint-disable-line no-unused-vars
  window.BTT_KIT = Object.freeze({ TextUtil, Decode, Parser, buildTurns, segAt, Analyzer, Quote, Headlines, Descriptions, nameFromTranscript, prepareTranscript, Zip });
})();
`;
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
  const kit = buildStoryKit(html), kitNow = existsSync(KIT_PATH) ? readFileSync(KIT_PATH, 'utf8') : null;
  if (process.argv.includes('--check') && kit !== kitNow) { console.error('site/js/story-kit.js is out of date with builder.html. Run: node tests/embed-fixtures.mjs'); process.exit(1); }
  if (!process.argv.includes('--check') && kit !== kitNow) writeFileSync(KIT_PATH, kit);
  const next = html.replace(re, buildBlock()).replace(reSite, buildSiteBlock()).replace(reDocs, () => buildDocsBlock());
  if (process.argv.includes('--check')) {
    if (next !== html) { console.error('Embedded fixtures, website files or admin guide are out of date. Run: node tests/embed-fixtures.mjs'); process.exit(1); }
    console.log('Embedded fixtures match /fixtures, website files match /site, and story-kit.js matches builder.html.');
  } else {
    writeFileSync(builder, next);
    console.log(`Embedded ${EMBEDDED.length} fixtures and ${siteFiles().length} website files into builder/builder.html`);
  }
}
