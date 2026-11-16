#!/usr/bin/env node
// Optional dev-machine test of the single-file release against a stand-in for Syndicate's document portal.
// Syndicate serves an uploaded zip's page under a path like /api/dynamic/documentVersions/<n>/files/, but answers
// requests for its stylesheets and scripts with its own HTML page ("MIME type text/html"). This server does the
// same: only .html pages and .mp4 videos are served; everything else gets an HTML page with status 200.
// The release is built by the real builder (Release.assemble) from the synthetic sample site.
//   node tests/syndicate-e2e.mjs
import { launch, openPage, sleep } from './cdp.mjs';
import { makePreview } from './make-site-preview.mjs';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
function check(name, cond, detail = '') { cond ? passed++ : failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${!cond && detail ? '\n     ' + detail : ''}`); }

const PREVIEW = makePreview(mkdtempSync(join(tmpdir(), 'btt-syn-src-')));
const OUT = mkdtempSync(join(tmpdir(), 'btt-syn-out-'));
const PREFIX = '/api/dynamic/documentVersions/30464/files/';
const served = [];
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  served.push(url);
  if (!url.startsWith(PREFIX)) { res.writeHead(404); res.end(); return; }
  const rel = url.slice(PREFIX.length) || 'index.html', file = join(OUT, rel);
  const ext = extname(rel).toLowerCase();
  if ((ext === '.html' || ext === '.mp4') && file.startsWith(OUT) && existsSync(file)) {
    // Like the portal, pages are announced in the wrong character set: anything non-ASCII would be misread.
    const data = readFileSync(file), type = ext === '.html' ? 'text/html; charset=windows-1252' : 'video/mp4';
    const range = req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range);
    if (range) { const a = +range[1], b = range[2] ? +range[2] : data.length - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${data.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 }); res.end(data.subarray(a, b + 1)); return; }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes' }); res.end(data); return;
  }
  // Like the portal: anything else comes back as the portal's own HTML page.
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><html><body>Portal page</body></html>');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}${PREFIX}`;

const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const CSP_WATCH = 'window.__csp = []; document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + (e.blockedURI || "")));';
try {
  /* ---------- 1. the builder makes a single-file release from the synthetic sample site ---------- */
  const files = {};
  (function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else { const rel = p.slice(PREVIEW.length + 1); if (rel.startsWith('stories/')) files[rel] = readFileSync(p).toString('base64'); } } })(PREVIEW);
  const json = (k) => readFileSync(join(PREVIEW, 'data', k + '.json'), 'utf8');
  // A release needs a video and a thumbnail for every published story: give each one the synthetic video.
  const doc = JSON.parse(json('stories')), mp4 = readFileSync(join(ROOT, 'fixtures', 'media', 'synthetic-01-timestamped-speakers.mp4')).toString('base64');
  const thumb = readFileSync(join(ROOT, 'fixtures', 'sample-site', 'thumbnails', 'synthetic-thumb-1.jpg')).toString('base64');
  for (const s of doc.stories.filter((x) => x.published === true)) {
    s.video = s.video || `stories/${s.id}/video.mp4`; files[s.video] = files[s.video] || mp4;
    s.thumbnail = s.thumbnail || `stories/${s.id}/thumbnail.jpg`; files[s.thumbnail] = files[s.thumbnail] || thumb;
  }
  const storiesJson = JSON.stringify(doc);
  const bp = await openPage(browser, `file://${join(ROOT, 'builder', 'builder.html')}#/dashboard`);
  const build = (share) => bp.eval(`(async () => {
    const B = window.BTT, st = B.makeStore(), files = ${JSON.stringify(files)};
    st.load({ stories: st.parseJson(${JSON.stringify(storiesJson)}, 'stories'), people: st.parseJson(${JSON.stringify(json('people'))}, 'people'), teams: st.parseJson(${JSON.stringify(json('teams'))}, 'teams') });
    st.assetIndex = new Set(Object.keys(files));
    st.setSettings('release', { singleFile: true });
    if (${share}) st.setSettings('share', { enabled: true, uploadUrl: 'submissions/', consentText: 'Synthetic consent.' });
    const bin = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const p = B.Release.plan(st);
    if (!p.ok) return { errors: p.errors.map((e) => e.msg) };
    const b = await B.Release.assemble(st, p, async (path) => files[path] ? new File([bin(files[path])], path.split('/').pop()) : null);
    const out = [];
    for (const f of b.files) { const bytes = typeof f.data === 'string' ? new TextEncoder().encode(f.data) : f.data instanceof Uint8Array ? f.data : new Uint8Array(await f.data.arrayBuffer()); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); out.push({ path: f.path, b64: btoa(s) }); }
    return { problems: b.problems, files: out, published: p.published.length };
  })()`);
  const r = await build(false);
  check('builder: the release builds with no problems', !!r.problems && r.problems.length === 0, JSON.stringify(r.errors || r.problems));
  if (!r.files) throw new Error('no release to test');
  const paths = r.files.map((f) => f.path).sort();
  check('single-file release: index.html, the font licence and the videos only', paths.includes('index.html') && paths.includes('LICENSE-fonts.txt') && paths.every((p) => p === 'index.html' || p === 'LICENSE-fonts.txt' || /^stories\/[^/]+\/video\.mp4$/.test(p)) && !paths.includes('share.html'), paths.join(', '));
  for (const f of r.files) { mkdirSync(dirname(join(OUT, f.path)), { recursive: true }); writeFileSync(join(OUT, f.path), Buffer.from(f.b64, 'base64')); }
  const html = readFileSync(join(OUT, 'index.html'), 'utf8');
  check('index.html loads no separate stylesheet or script', !/<link rel="stylesheet"|<script src=/.test(html));
  check('index.html CSP allows only its own inline blocks (by hash) and no network', /content="default-src 'none'; script-src 'sha256-[^"]+; style-src 'sha256-[^"]+; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'none';/.test(html) && !/unsafe-inline|unsafe-eval/.test(html));
  check('index.html is pure ASCII, so no character set can misread it', ![...readFileSync(join(OUT, 'index.html'))].some((b) => b > 127));
  check('index.html has no raw "<" inside the data', !/window\.BTT_SITE_DATA = [^\n]*<[a-z/]/i.test(html.slice(html.indexOf('window.BTT_SITE_DATA'), html.indexOf('window.BTT_SITE_DATA') + 400000).split('</script>')[0]));
  check('index.html size is reasonable', html.length < 3e6, (html.length / 1e6).toFixed(2) + ' MB');

  /* ---------- 2. served the Syndicate way ---------- */
  let p = await openPage(browser, null);
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: CSP_WATCH });
  await p.send('Page.navigate', { url: BASE + 'index.html?token=synthetic' });
  await p.waitFor('window.BTT_SITE && window.BTT_SITE.ready', 15000); await sleep(400);
  check('the site boots even though the server returns HTML for every other file', await p.eval('!window.BTT_SITE.loadError && window.BTT_SITE.debug.data.source === "bundled"'), await p.eval('String(window.BTT_SITE.loadError)'));
  check('accented names and curly quotes still display correctly (served as windows-1252)', (await p.eval('document.body.textContent')).includes('Jos\u00e9') && (await p.eval('JSON.stringify(window.BTT_SITE.debug.data.stories.map((s) => s.name))')).includes('Jos\u00e9'), await p.eval('JSON.stringify(window.BTT_SITE.debug.data.stories.map((s) => s.name))'));
  check('all published stories are there', await p.eval('window.BTT_SITE.debug.data.stories.length') === r.published);
  check('styles are applied (sidebar colour, Manrope headings)', await p.eval('getComputedStyle(document.querySelector(".sidebar")).backgroundColor === "rgb(245, 243, 253)" && getComputedStyle(document.querySelector("h1")).fontFamily.startsWith("Manrope")'));
  check('the embedded Manrope font loads (all 4 weights)', await p.eval('Promise.all([400, 600, 700, 800].map((w) => document.fonts.load(w + " 20px Manrope"))).then(() => [...document.fonts].filter((f) => f.family.replace(/"/g, "") === "Manrope").every((f) => f.status === "loaded"))'));
  check('thumbnails are built into the page and display', await p.eval('(() => { const imgs = [...document.querySelectorAll("img")]; return imgs.length > 0 && imgs.every((i) => i.src.startsWith("data:image/jpeg;base64,")); })()') && await p.eval('Promise.all([...document.images].map((i) => i.decode().then(() => i.naturalWidth > 0, () => false))).then((a) => a.every(Boolean))'));
  check('nothing but the page itself was requested so far', served.filter((u) => !u.endsWith('index.html')).length === 0, served.join(' '));
  check('no Content-Security-Policy violations', (await p.eval('window.__csp')).length === 0, (await p.eval('window.__csp')).join('\n'));
  await p.eval('location.hash = "#/story/story-0001"'); await sleep(600);
  const v = await p.eval(`new Promise((res) => { const v = document.querySelector('[data-testid=player] video'); if (!v) return res({ none: true }); const t = setTimeout(() => res({ timeout: true, src: v.currentSrc }), 8000); const go = () => { clearTimeout(t); res({ dur: v.duration, track: (v.querySelector('track') || {}).src || '' }); }; v.readyState >= 1 ? go() : v.addEventListener('loadedmetadata', go); v.load(); })`);
  check('story video plays from its separate file, captions come from the page', v.dur > 5 && String(v.track).startsWith('blob:'), JSON.stringify(v));
  check('no CSP violations on the story page', (await p.eval('window.__csp')).length === 0, (await p.eval('window.__csp')).join('\n'));
  check('no console errors', p.errors.length === 0, p.errors.join('\n'));
  await p.send('Page.close');

  /* ---------- 3. with "Share your story" switched on ---------- */
  const r2 = await build(true);
  check('with sharing on, share.html is also a single self-contained page', r2.problems.length === 0 && r2.files.some((f) => f.path === 'share.html') && !r2.files.some((f) => /^(js|css)\//.test(f.path)), JSON.stringify(r2.problems));
  const share = Buffer.from(r2.files.find((f) => f.path === 'share.html').b64, 'base64').toString('utf8');
  writeFileSync(join(OUT, 'share.html'), share);
  check('share.html may only connect to its own site (for sending)', /connect-src 'self';/.test(share) && !/<script src=|<link rel="stylesheet"/.test(share));
  p = await openPage(browser, null);
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: CSP_WATCH });
  await p.send('Page.navigate', { url: BASE + 'share.html' });
  await p.waitFor('window.BTT_SHARE && window.BTT_SHARE.ready', 15000); await sleep(300);
  check('share page boots from the single file, with its settings and the builder\'s text tools', await p.eval('BTT_SHARE.settings.enabled === true && BTT_SHARE.settings.consentText === "Synthetic consent." && !!window.BTT_KIT.Analyzer'));
  check('share page: no CSP violations or console errors', (await p.eval('window.__csp')).length === 0 && p.errors.length === 0, (await p.eval('window.__csp')).concat(p.errors).join('\n'));
  await p.send('Page.close');
} catch (e) {
  check('Syndicate E2E ran without crashing', false, e.stack);
} finally { await browser.close(); server.close(); }
console.log(`\nSYNDICATE E2E ${failed ? 'FAIL' : 'PASS'} ${passed}/${passed + failed}`);
process.exit(failed ? 1 : 0);
