#!/usr/bin/env node
// Dev-machine helper (optional). Assembles a complete preview project folder from the synthetic
// sample data: website files + data/*.json + data/site-data.js + thumbnails/videos/captions.
//   node tests/make-site-preview.mjs [outDir]     (default: test-output/site-preview, git-ignored)
// Then open <outDir>/index.html in Chrome, or serve the folder with any static web server.
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Same format the Content Builder writes (see siteDataJs in builder.html). */
export function siteDataJs({ stories, people, teams, captions }) {
  const doc = { schemaVersion: 1, note: 'Generated copy of data/*.json for opening the site from disk. Do not edit by hand.', stories, people, teams, captions: captions || {} };
  return '/* Beyond the Title: site data for local preview (generated). */\nwindow.BTT_SITE_DATA = ' + JSON.stringify(doc).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + ';\n';
}

export function makePreview(out = join(ROOT, 'test-output', 'site-preview'), { withScriptData = true } = {}) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(join(ROOT, 'site'), out, { recursive: true, filter: (p) => !p.endsWith('README.md') });
  const src = join(ROOT, 'fixtures', 'sample-site');
  cpSync(join(src, 'data'), join(out, 'data'), { recursive: true });
  const thumbs = JSON.parse(readFileSync(join(src, 'thumbnails', 'map.json'), 'utf8'));
  for (const [id, n] of Object.entries(thumbs)) { mkdirSync(join(out, 'stories', id), { recursive: true }); copyFileSync(join(src, 'thumbnails', `synthetic-thumb-${n}.jpg`), join(out, 'stories', id, 'thumbnail.jpg')); }
  const stories = JSON.parse(readFileSync(join(out, 'data', 'stories.json'), 'utf8'));
  const captions = {};
  for (const s of stories.stories) {
    if (s.video) { mkdirSync(join(out, 'stories', s.id), { recursive: true }); copyFileSync(join(ROOT, 'fixtures', 'media', 'synthetic-01-timestamped-speakers.mp4'), join(out, s.video)); }
    if (s.captions) { const vtt = readFileSync(join(ROOT, 'fixtures', 'media', 'synthetic-01-timestamped-speakers.vtt'), 'utf8'); writeFileSync(join(out, s.captions), vtt); captions[s.captions] = vtt; }
  }
  if (withScriptData) {
    const people = JSON.parse(readFileSync(join(out, 'data', 'people.json'), 'utf8'));
    const teams = JSON.parse(readFileSync(join(out, 'data', 'teams.json'), 'utf8'));
    writeFileSync(join(out, 'data', 'site-data.js'), siteDataJs({ stories, people, teams, captions }));
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = makePreview(process.argv[2] ? join(process.cwd(), process.argv[2]) : undefined);
  console.log('Preview folder: ' + out + '\nOpen ' + join(out, 'index.html') + ' in Chrome.' + (existsSync(join(out, 'data', 'site-data.js')) ? '' : ''));
}
