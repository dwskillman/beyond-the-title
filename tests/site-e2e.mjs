#!/usr/bin/env node
// Optional dev-machine end-to-end test of the employee website (site/) with synthetic sample data.
// Serves a preview folder over http (like Syndicate) and also opens it from disk (file://).
//   node tests/site-e2e.mjs
import { launch, openPage, sleep } from './cdp.mjs';
import { makePreview } from './make-site-preview.mjs';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

let passed = 0, failed = 0;
function check(name, cond, detail = '') { cond ? passed++ : failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${!cond && detail ? '\n     ' + detail : ''}`); }

const DIR = makePreview(mkdtempSync(join(tmpdir(), 'btt-site-')));
const NO_SCRIPT_DATA = makePreview(mkdtempSync(join(tmpdir(), 'btt-site-nodata-')), { withScriptData: false });
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.vtt': 'text/vtt' };
const requests = [];
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  requests.push(rel);
  const file = join(DIR, rel);
  if (!file.startsWith(DIR) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  const data = readFileSync(file);
  const ext = rel.slice(rel.lastIndexOf('.'));
  const range = req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range);
  if (range) { const a = +range[1], b = range[2] ? +range[2] : data.length - 1; res.writeHead(206, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Content-Range': `bytes ${a}-${b}/${data.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 }); res.end(data.subarray(a, b + 1)); return; }
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes' }); res.end(data);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const HTTP = `http://127.0.0.1:${server.address().port}/index.html`;
const FILE = `file://${DIR}/index.html`;
const browser = await launch();
const ready = 'window.BTT_SITE && window.BTT_SITE.ready';
async function page(url, opts) { const p = await openPage(browser, null, opts); await p.send('Page.navigate', { url }); await p.waitFor(ready, 10000); await sleep(150); return p; }
const text = (p, sel = '#view') => p.eval(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
const go = async (p, hash) => { await p.eval(`location.hash = ${JSON.stringify(hash)}`); await sleep(250); };

try {
  /* ---------- over http (as on Syndicate) ---------- */
  let p = await page(HTTP + '#/');
  check('home loads from data/*.json over http', await p.eval('window.BTT_SITE.debug.data.source') === 'json');
  check('home: hero, featured story and people to discover', (await text(p)).includes('Discover their stories.') && await p.eval('!!document.querySelector("[data-testid=featured]")') && await p.eval('document.querySelectorAll("[data-testid=discover] [data-testid=story-card]").length') === 4);
  check('only published stories are shown (8 of 9)', await p.eval('window.BTT_SITE.debug.data.stories.length') === 8);
  check('the draft never appears on the page or in data used by search', !(await p.eval('document.body.textContent')).includes('DRAFT') && await p.eval('window.BTT_SITE.search.query("Drew").length') === 0);
  await go(p, '#/explore');
  check('explore lists all 8 stories', await p.eval('document.querySelectorAll("[data-testid=story-card]").length') === 8);
  const searches = [['Harper', 2, 'manager'], ['customer care', 1, 'team'], ['team hub', 1, 'project'], ['mentorship', 1, 'tag'], ['jose', 1, 'accent-insensitive name'], ['scam', 1, 'story text'], ['zzzz', 0, 'no match']];
  for (const [q, n, what] of searches) check(`search by ${what} (“${q}”) → ${n}`, await p.eval(`window.BTT_SITE.search.storyMatches(${JSON.stringify(q)}).length`) === n, String(await p.eval(`window.BTT_SITE.search.storyMatches(${JSON.stringify(q)}).map(s => s.name)`)));
  await go(p, '#/explore?team=learning-design');
  check('explore: team filter', await p.eval('document.querySelectorAll("[data-testid=story-card]").length') === 1 && (await text(p)).includes('Avery Example'));
  await go(p, '#/explore?manager=person-0103');
  check('explore: manager filter (3 published stories from Dana\'s reports)', await p.eval('document.querySelectorAll("[data-testid=story-card]").length') === 3);
  await go(p, '#/explore?tag=Collaboration');
  check('explore: topic filter from a tag chip', await p.eval('document.querySelectorAll("[data-testid=story-card]").length') === 3);

  // Search box: keyboard shortcut, live results, Enter opens explore
  await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK', modifiers: 4, windowsVirtualKeyCode: 75 });
  await sleep(100);
  check('⌘K focuses the search box', await p.eval('document.activeElement && document.activeElement.id') === 'site-search');
  await p.send('Input.insertText', { text: 'riley' }); await sleep(300);
  check('search panel shows a person result', (await text(p, '#search-panel')).includes('Riley Placeholder'));
  await p.key('Enter', 'Enter', 13); await sleep(300);
  check('Enter opens Explore with the query', (await p.eval('location.hash')).startsWith('#/explore?q=riley') && await p.eval('document.querySelectorAll("[data-testid=story-card]").length') === 1);

  // Story page + player
  await go(p, '#/story/story-0001');
  check('story page: headline, description, quote and related stories', (await text(p)).includes('“The project I\'m most proud of is Team Hub”') && (await text(p)).includes('Related stories'));
  check('player has the video and a captions track', await p.eval('document.querySelector("[data-testid=player] video source").getAttribute("src")') === 'stories/story-0001/video.mp4' && await p.eval('document.querySelector("[data-testid=player] track").getAttribute("src")') === 'stories/story-0001/captions.vtt');
  await p.eval('[...document.querySelectorAll("button")].find(b => b.textContent.includes("Watch this moment")).click()');
  await p.waitFor('document.querySelector("video").currentTime >= 3.5', 8000);
  check('"Watch this moment" jumps to the quote', true);
  check('captions load and show cues', await p.eval('new Promise(r => { const t = document.querySelector("video").textTracks[0]; t.mode = "showing"; setTimeout(() => r(t.cues ? t.cues.length : 0), 600); })') === 3);
  await go(p, '#/story/story-0009');
  check('draft story URL shows "not found"', (await text(p)).includes('Not found'));
  // Surprise me
  await go(p, '#/surprise'); await sleep(200);
  check('Surprise me opens a random published story', /^#\/story\/story-000[1-8]$/.test(await p.eval('location.hash')));
  // Directory pages
  await go(p, '#/people');
  check('people directory lists the 8 storytellers', await p.eval('document.querySelectorAll("[data-testid=person-card]").length') === 8);
  await go(p, '#/person/person-0003');
  check('profile page (a manager who also told a story)', (await text(p)).includes('Riley Placeholder') && (await text(p)).includes('Analytics Manager'));
  await go(p, '#/teams');
  check('teams page', await p.eval('document.querySelectorAll("[data-testid=teams] .entity").length') === 8);
  await go(p, '#/project/team-hub');
  check('project page', (await text(p)).includes('Team Hub') && await p.eval('document.querySelectorAll("[data-testid=story-card]").length') === 1);
  await go(p, '#/managers');
  check('managers page (includes a manager who tells their own story)', await p.eval('document.querySelectorAll("[data-testid=managers] .entity").length') === 4);
  await go(p, '#/manager/person-0103');
  check('manager page lists their team\'s stories', (await text(p)).includes('Stories from their team') && (await text(p)).includes('José Muestra'));
  check('no console errors over http', p.errors.length === 0, p.errors.join('\n'));
  check('only the site\'s own files were requested', requests.every((r) => /^(index\.html|css\/|js\/|data\/|stories\/)/.test(r)), requests.join(', '));
  check('no unpublished data requested (no site-data.js needed over http)', !requests.includes('data/site-data.js'));
  await p.send('Page.close');

  /* ---------- phone width ---------- */
  p = await page(HTTP + '#/', { width: 390, height: 900 });
  check('phone: no horizontal scrolling on home', await p.eval('document.scrollingElement.scrollWidth <= window.innerWidth + 1'), String(await p.eval('document.scrollingElement.scrollWidth')));
  await go(p, '#/story/story-0001');
  check('phone: no horizontal scrolling on a story', await p.eval('document.scrollingElement.scrollWidth <= window.innerWidth + 1'));
  await p.send('Page.close');

  /* ---------- opened from disk (file://) ---------- */
  p = await page(FILE + '#/');
  check('from disk: loads data/site-data.js', await p.eval('window.BTT_SITE.debug.data.source') === 'script' && await p.eval('window.BTT_SITE.debug.data.stories.length') === 8);
  check('from disk: "Preview drafts" offered', (await p.eval('(document.querySelector("[data-testid=preview-toggle]") || {}).textContent || ""')).includes('Preview drafts (1)'));
  await p.click('[data-testid=preview-toggle]'); await sleep(250);
  check('preview shows the draft with a clear label and banner', await p.eval('window.BTT_SITE.debug.data.stories.length') === 9 && !!(await p.eval('document.getElementById("preview-bar")')) && (await p.eval('document.body.textContent')).includes('Draft (preview)'));
  await go(p, '#/story/story-0004');
  check('from disk: captions play from the embedded copy', (await p.eval('document.querySelector("[data-testid=player] track").src')).startsWith('blob:'));
  check('no console errors from disk', p.errors.length === 0, p.errors.join('\n'));
  await p.send('Page.close');

  p = await page(`file://${NO_SCRIPT_DATA}/index.html#/`);
  check('from disk without site-data.js: clear guidance instead of a blank page', (await text(p)).includes('Save the project from the Content Builder'));
  await p.send('Page.close');

  /* ---------- empty site ---------- */
  const EMPTY = makePreview(mkdtempSync(join(tmpdir(), 'btt-site-empty-')));
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(EMPTY, 'data', 'site-data.js'), 'window.BTT_SITE_DATA = {"stories":{"stories":[]},"people":{"people":[]},"teams":{"teams":[]}};');
  p = await page(`file://${EMPTY}/index.html#/`);
  check('no published stories: friendly empty state', (await text(p)).includes('Stories are on their way'));
  await p.send('Page.close');
} catch (e) {
  check('site E2E completed without exceptions', false, e.stack || String(e));
} finally {
  await browser.close(); server.close();
  for (const d of [DIR, NO_SCRIPT_DATA]) rmSync(d, { recursive: true, force: true });
}
console.log(`\nSITE E2E ${failed ? 'FAIL' : 'PASS'} ${passed}/${passed + failed}`);
process.exit(failed ? 1 : 0);
