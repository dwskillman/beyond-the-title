#!/usr/bin/env node
// Dev-machine static checks (optional). Fails if the builder could reach the network,
// renders data as HTML, uses browser storage, or drifts from the committed fixtures.
//   node tests/check-static.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBlock, buildSiteBlock, buildDocsBlock, siteFiles } from './embed-fixtures.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'builder', 'builder.html'), 'utf8');
const scriptStart = html.lastIndexOf('<script>\n/* =====');
const code = html.slice(scriptStart, html.lastIndexOf('</script>'));
const fixtures = (html.match(/<!-- FIXTURES:BEGIN -->[\s\S]*?<!-- FIXTURES:END -->/) || [''])[0];
const siteBlock = (html.match(/<!-- SITE:BEGIN -->[\s\S]*?<!-- SITE:END -->/) || [''])[0];
const docsBlock = (html.match(/<!-- DOCS:BEGIN -->[\s\S]*?<!-- DOCS:END -->/) || [''])[0];
const outsideFixtures = html.replace(fixtures, '').replace(siteBlock, '').replace(docsBlock, '');
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
const fm = (code.match(/\/\* FolderMemory:BEGIN[\s\S]*?\/\* FolderMemory:END \*\//) || [''])[0];
check('no browser storage outside the folder-shortcut module', !!fm && !/localStorage|sessionStorage|indexedDB/.test(code.replace(fm, '')));
check('folder-shortcut module stores only a directory handle', !/localStorage|sessionStorage/.test(fm) && (fm.match(/\.put\(/g) || []).length === 1 && /put\(handle, KEY\)/.test(fm));
check('no network APIs (fetch / XMLHttpRequest / WebSocket / sendBeacon)', !/\bfetch\(|XMLHttpRequest|new WebSocket|sendBeacon|EventSource/.test(code));
check('embedded fixtures identical to /fixtures', fixtures === buildBlock(), 'run: node tests/embed-fixtures.mjs');
check('embedded website files identical to /site', siteBlock === buildSiteBlock(), 'run: node tests/embed-fixtures.mjs');
check('embedded admin guide identical to docs/admin-guide.md', docsBlock === buildDocsBlock(), 'run: node tests/embed-fixtures.mjs');

// Employee website (site/): same rules, plus fetch() only for its own relative data files.
const siteHtml = readFileSync(join(ROOT, 'site', 'index.html'), 'utf8');
const siteJs = siteFiles().filter((f) => f.endsWith('.js')).map((f) => [f, readFileSync(join(ROOT, 'site', f), 'utf8')]);
const siteCss = readFileSync(join(ROOT, 'site', 'css', 'styles.css'), 'utf8');
const siteAll = [siteHtml, siteCss, ...siteJs.map((x) => x[1])].join('\n');
const siteUrls = [...siteAll.matchAll(/https?:\/\/[^\s'")%]+/g)].map((m) => m[0]).filter((u) => !u.startsWith('http://www.w3.org/2000/svg'));
check('site: no external URLs', siteUrls.length === 0, siteUrls.join(', '));
check('site: CSP meta tag limits everything to its own files', /http-equiv="Content-Security-Policy" content="default-src 'self';[^"]*connect-src 'self'/.test(siteHtml));
check('site: scripts are local files only', [...siteHtml.matchAll(/<script[^>]*src="([^"]+)"/g)].every((m) => /^js\/[a-z-]+\.js$/.test(m[1])));
check('site: no inline <script> or style="" in index.html', !/<script>(?!\s*<\/script>)/.test(siteHtml) && !/\sstyle="/.test(siteHtml));
const siteInner = siteJs.flatMap(([f, t]) => t.split('\n').map((l, i) => [f, i, l])).filter(([, , l]) => /\.innerHTML\s*=/.test(l) && !/static-icon/.test(l));
check('site: innerHTML only for constant icons', siteInner.length === 0, siteInner.map(([f, i, l]) => `${f}:${i + 1} ${l.trim()}`).join('\n'));
check('site: no eval / document.write / insertAdjacentHTML', siteJs.every(([, t]) => !/\beval\(|new Function\(|document\.write|insertAdjacentHTML/.test(t)));
check('site: no browser storage', siteJs.every(([, t]) => !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(t)));
const fetches = siteJs.flatMap(([, t]) => [...t.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1].trim()));
check('site: fetch() only reads its own data files', fetches.length > 0 && fetches.every((a) => a === 'path'), fetches.join(', '));
check('site: no XMLHttpRequest / WebSocket / sendBeacon', siteJs.every(([, t]) => !/XMLHttpRequest|new WebSocket|sendBeacon|EventSource/.test(t)));
check('no raw U+2028/U+2029 characters in builder or site code (they break JS regexes)', !/[\u2028\u2029]/.test(code) && siteJs.every(([, t]) => !/[\u2028\u2029]/.test(t)));
const fontCss = readFileSync(join(ROOT, 'site', 'css', 'fonts.css'), 'utf8');
const fontUrls = [...fontCss.matchAll(/url\(([^)]{0,40})/g)].map((m) => m[1]);
check('site: fonts are embedded as data: URIs (no font files or font servers)', fontUrls.length === 4 && fontUrls.every((u) => u.startsWith('data:font/woff;base64,')) && /font-family:"Manrope"/.test(fontCss));
check('site: CSP allows fonts only from data: URIs', /font-src data:;/.test(siteHtml) && siteHtml.includes('href="css/fonts.css"'));
check('site: stylesheet uses no external url()', !/url\(/.test(siteCss.replace(/url\("data:[^"]*"\)/g, '')));
check('site: font licence ships with the site', /SIL OPEN FONT LICENSE Version 1\.1/.test(readFileSync(join(ROOT, 'site', 'LICENSE-fonts.txt'), 'utf8')) && siteFiles().includes('LICENSE-fonts.txt'));
check('site: no setAttribute("style") (CSP-safe styling)', siteJs.every(([, t]) => !/setAttribute\(['"]style/.test(t)));

// Public-repo hygiene: only synthetic content, no company names, no real-looking contact data.
const skip = new Set(['.git', 'node_modules', 'test-output', 'release', 'workspace', 'tmp']); // git-ignored output folders
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { if (skip.has(n)) continue; const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(ROOT);
const textFiles = files.filter((f) => /\.(html|md|mjs|js|json|txt|sh|css)$|\.gitignore$/.test(f) && !f.includes('check-static.mjs'));
const hits = [];
for (const f of textFiles) {
  const t = readFileSync(f, 'utf8');
  if (/wells\s*fargo|\bwfc\b|@wellsfargo/i.test(t)) hits.push(relative(ROOT, f) + ': company name');
  // Anchored at the start of a run and length-bounded, so long base64 runs (embedded fonts) stay linear.
  for (const m of t.match(/(?<![\w.+-])[\w.+-]{1,64}@[\w-]+\.[\w.]+/g) || []) if (!/noreply@anthropic\.com|example\.(com|test)/.test(m)) hits.push(relative(ROOT, f) + ': ' + m);
}
check('repository contains no company names or email addresses', hits.length === 0, hits.join('\n'));
const media = files.filter((f) => /\.(mp4|mov|m4v|webm|vtt|srt|jpg|jpeg|webp)$/i.test(f) && !f.includes('/fixtures/'));
check('no media files outside /fixtures', media.length === 0, media.map((f) => relative(ROOT, f)).join(', '));

console.log(`\nSTATIC ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
