#!/usr/bin/env node
// Dev-machine static checks (optional). Fails if the builder could reach the network,
// renders data as HTML, uses browser storage, or drifts from the committed fixtures.
//   node tests/check-static.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBlock } from './embed-fixtures.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'builder', 'builder.html'), 'utf8');
const scriptStart = html.lastIndexOf('<script>\n/* =====');
const code = html.slice(scriptStart, html.lastIndexOf('</script>'));
const fixtures = (html.match(/<!-- FIXTURES:BEGIN -->[\s\S]*?<!-- FIXTURES:END -->/) || [''])[0];
const outsideFixtures = html.replace(fixtures, '');
let failed = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : '\n     ' + detail}`); if (!ok) failed++; };

const css = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
const markup = outsideFixtures.replace(code, '').replace(css, '');
// Reserved test domains (RFC 2606: *.test, *.invalid, example.com) appear only inside self-test strings.
const urls = [...outsideFixtures.matchAll(/https?:\/\/[^\s'")%]+/g)].map((m) => m[0]).filter((u) => !u.startsWith('http://www.w3.org/2000/svg') && !/^https?:\/\/([\w-]+\.)*(test|invalid|example\.com)(\/|$)/.test(u));
check('no external URLs in builder.html (only the SVG namespace)', urls.length === 0, urls.join(', '));
const links = [...outsideFixtures.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).filter((l) => !/rel="icon" href="data:/.test(l));
check('no <link> to external resources', links.length === 0, links.join(' '));
check('no src= attributes in markup', !/<(script|img|iframe|video|audio|source)\b[^>]*\ssrc=/i.test(markup));
check('no CSS @import or non-data url()', !/@import|url\((?!["']?data:)/i.test(css));
check('exactly one executable <script> block', (outsideFixtures.match(/<script>/g) || []).length === 1);
check('CSP meta tag blocks network access', /http-equiv="Content-Security-Policy" content="default-src 'none';[^"]*connect-src 'none'/.test(html));
const inner = code.split('\n').map((l, i) => [i, l]).filter(([, l]) => /\.innerHTML\s*=/.test(l) && !/static-icon/.test(l));
check('innerHTML only used for constant icons (marked static-icon)', inner.length === 0, inner.map(([i, l]) => `line ${i}: ${l.trim()}`).join('\n'));
check('no insertAdjacentHTML / outerHTML / document.write', !/insertAdjacentHTML|outerHTML\s*=|document\.write/.test(code));
check('no eval() or new Function()', !/\beval\(|new Function\(/.test(code));
check('no browser storage (localStorage / sessionStorage / IndexedDB)', !/localStorage|sessionStorage|indexedDB/.test(code));
check('no network APIs (fetch / XMLHttpRequest / WebSocket / sendBeacon)', !/\bfetch\(|XMLHttpRequest|new WebSocket|sendBeacon|EventSource/.test(code));
check('embedded fixtures identical to /fixtures', fixtures === buildBlock(), 'run: node tests/embed-fixtures.mjs');

// Public-repo hygiene: only synthetic content, no company names, no real-looking contact data.
const skip = new Set(['.git', 'node_modules']);
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { if (skip.has(n)) continue; const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(ROOT);
const textFiles = files.filter((f) => /\.(html|md|mjs|js|json|txt|sh|css)$|\.gitignore$/.test(f) && !f.includes('check-static.mjs'));
const hits = [];
for (const f of textFiles) {
  const t = readFileSync(f, 'utf8');
  if (/wells\s*fargo|\bwfc\b|@wellsfargo/i.test(t)) hits.push(relative(ROOT, f) + ': company name');
  for (const m of t.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []) if (!/noreply@anthropic\.com|example\.(com|test)/.test(m)) hits.push(relative(ROOT, f) + ': ' + m);
}
check('repository contains no company names or email addresses', hits.length === 0, hits.join('\n'));
const media = files.filter((f) => /\.(mp4|mov|m4v|webm|vtt|srt|jpg|jpeg|webp)$/i.test(f) && !f.includes('/fixtures/'));
check('no media files outside /fixtures', media.length === 0, media.map((f) => relative(ROOT, f)).join(', '));

console.log(`\nSTATIC ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
