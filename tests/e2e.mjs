#!/usr/bin/env node
// Optional dev-machine end-to-end test (Node 22+ built-ins + Chrome DevTools Protocol, no npm install).
// Drives the real builder UI in headless Chrome through the Milestone 1 demonstration items.
//   node tests/e2e.mjs
// Not needed to use or publish the builder. OS folder pickers (direct folder write) can't be
// automated here and are covered by the manual checklist in tests/README.md.
import { launch, openPage, sleep } from './cdp.mjs';
import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL = `file://${ROOT}/builder/builder.html`;
const FX = (p) => join(ROOT, 'fixtures', p);
const DL = mkdtempSync(join(tmpdir(), 'btt-e2e-dl-'));
let passed = 0, failed = 0;
const results = [];
function check(name, cond, detail = '') { results.push({ name, ok: !!cond, detail }); cond ? passed++ : failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${!cond && detail ? '\n     ' + detail : ''}`); }
const stripMeta = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.updatedAt; delete c.generator; return c; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const browser = await launch();
const downloads = new Map();
browser.on((m) => {
  if (m.method === 'Browser.downloadWillBegin') downloads.set(m.params.guid, { name: m.params.suggestedFilename, state: 'started' });
  if (m.method === 'Browser.downloadProgress' && downloads.has(m.params.guid)) downloads.get(m.params.guid).state = m.params.state;
});
async function waitDownload(name, timeout = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    for (const [guid, d] of downloads) if (d.name === name && d.state === 'completed' && !d.taken) { d.taken = true; return join(DL, guid); }
    await sleep(100);
  }
  throw new Error('Download did not complete: ' + name);
}
async function newPage(hash = '#/dashboard', initScript) {
  const p = await openPage(browser, null, { downloadPath: DL });
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: DL, eventsEnabled: true });
  await p.send('Page.setInterceptFileChooserDialog', { enabled: true });
  p.dialogs = [];
  browser.on((m) => {
    if (m.sessionId !== p.sessionId) return;
    if (m.method === 'Page.javascriptDialogOpening') { p.dialogs.push(m.params); p.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); }
    if (m.method === 'Page.fileChooserOpened' && p.nextFiles) { const files = p.nextFiles; p.nextFiles = null; p.send('DOM.setFileInputFiles', { files, backendNodeId: m.params.backendNodeId }).then(() => { p.chooserDone = true; }).catch((e) => { p.chooserError = e.message; }); }
  });
  if (initScript) await p.send('Page.addScriptToEvaluateOnNewDocument', { source: initScript });
  await p.goto(URL + hash);
  return p;
}
async function choose(p, selector, files) { p.nextFiles = files; p.chooserDone = false; p.chooserError = null; await p.click(selector); const t0 = Date.now(); while (!p.chooserDone && !p.chooserError && Date.now() - t0 < 8000) await sleep(50); if (p.chooserError) throw new Error(p.chooserError); }
const S = (expr) => `window.BTT.store.${expr}`;

try {
  /* 1. Opens with no errors */
  let p = await newPage('#/dashboard');
  check('1. builder.html opens in Chrome and boots', await p.eval('window.BTT.ready === true'));
  check('1. no console errors on load', p.errors.length === 0, p.errors.join('\n'));
  check('1. self-tests pass in this browser', await p.eval('window.BTT.SelfTest.run().then(r => r.failed === 0 ? true : r.failures.join("; "))') === true);

  /* 2-3. Multiple TXT import via the real file chooser */
  await p.goto(URL + '#/import');
  await choose(p, '[data-testid=choose-files]', [FX('transcripts/synthetic-01-timestamped-speakers.txt'), FX('transcripts/synthetic-02-speaker-blocks.txt'), FX('transcripts/synthetic-07-speaker-lines.txt'), FX('transcripts/synthetic-08-utf16le.txt')]);
  await p.waitFor(S('stories.length === 4'));
  check('2. four .txt files selected and imported', await p.eval(S('stories.length')) === 4);
  check('2. import log lists every file', await p.eval('document.querySelectorAll("[data-testid=import-log] .list-row").length') === 4);
  check('2. UTF-16 transcript decoded', await p.eval(S('transcripts.get("story-0004").encoding')) === 'UTF-16 LE');
  await choose(p, '[data-testid=choose-files]', [FX('transcripts/synthetic-01-timestamped-speakers.txt')]);
  await p.waitFor('document.querySelectorAll("[data-testid=import-log] .list-row").length === 5');
  check('2. duplicate import detected and skipped', await p.eval(S('stories.length')) === 4 && await p.eval('document.querySelector("[data-testid=import-log] .list-row").textContent.includes("Duplicate")'));

  await p.goto(URL + '#/story/story-0001');
  await p.waitFor('document.querySelectorAll("[data-testid=transcript-box] .seg").length > 0');
  check('3. transcript readable (16 segments with speakers and times)', await p.eval('document.querySelectorAll("[data-testid=transcript-box] .seg").length') === 16 && await p.eval('document.querySelector("[data-testid=transcript-box]").textContent.includes("Avery Example")'));
  check('3. parse info shows detected format', (await p.eval('document.querySelector("[data-testid=parse-info]").textContent')).includes('Timestamped lines'));

  /* 4. Candidates */
  check('4. three candidate statements shown', await p.eval('document.querySelectorAll("[data-testid=candidate]").length') === 3);
  await p.click('[data-testid=candidate] [data-testid=use-quote]');
  await p.waitFor(S('get("story-0001").quote.length > 10'));
  const q1 = await p.eval(S('get("story-0001")'));
  check('4. "Use as quote" sets a verbatim quote with timestamp', /Verbatim/.test(await p.eval('document.querySelector("[data-testid=quote-badge]").textContent')) && !!q1.quoteTimestamp, JSON.stringify([q1.quote, q1.quoteTimestamp]));

  /* 5-6. Edit fields, preview updates */
  await p.type('#f-headline', 'From thirty documents to one guided path');
  await p.waitFor('document.querySelector("[data-testid=card-headline]").textContent === "From thirty documents to one guided path"');
  check('5/6. headline edit updates the live card preview', true);
  check('5. typed headline is marked as written by hand', await p.eval(S('get("story-0001").headlineSource')) === 'manual');
  await p.type('#f-description', 'Avery turned thirty onboarding documents into one guided path.');
  await p.type('#f-role', 'Learning Designer');
  await p.type('#f-team', 'Learning Design'); await p.eval('document.querySelector("#f-team").dispatchEvent(new Event("change"))');
  await p.type('#f-manager', 'Quinn Example'); await p.eval('document.querySelector("#f-manager").dispatchEvent(new Event("change"))');
  await p.click('[data-testid=field-tags] input'); await p.send('Input.insertText', { text: 'Onboarding' }); await p.key('Enter', 'Enter', 13);
  await p.waitFor('document.querySelector("[data-testid=card-meta]").textContent === "Avery Example · Learning Design"');
  check('6. preview shows name · team after editing', true);
  check('6. tags appear on the card', await p.eval('document.querySelector("[data-testid=preview] .s-tags").textContent.includes("Onboarding")'));
  await p.eval('(() => { const el = document.querySelector("#f-status"); el.value = "review"; el.dispatchEvent(new Event("change")); })()');
  check('5. complete story can move to Ready for review', await p.eval(S('get("story-0001").status')) === 'review');
  await p.eval('(() => { const el = document.querySelector("[data-testid=field-featured]"); el.click(); })()');
  check('6. featured toggle switches preview to the featured card', await p.eval('!!document.querySelector("[data-testid=featured-card]")'));

  /* 7. Multiple stories */
  await p.goto(URL + '#/story/story-0002');
  await p.waitFor('document.querySelector("[data-testid=apply-suggestions]")');
  await p.click('[data-testid=apply-suggestions]');
  await p.waitFor(S('get("story-0002").headline.length > 0'));
  const s2 = await p.eval(S('get("story-0002")'));
  check('7. second story edited independently (apply top suggestions)', s2.headline && s2.quote && s2.tags.length > 0, JSON.stringify(s2));
  await p.eval('(() => { const el = document.querySelector("#f-status"); el.value = "review"; el.dispatchEvent(new Event("change")); })()');
  check('5. incomplete story is blocked from review', await p.eval(S('get("story-0002").status')) === 'draft');

  /* 8. Export valid JSON */
  await p.goto(URL + '#/export');
  await p.click('[data-testid=export-stories]');
  const file1 = await waitDownload('stories.json');
  const exp1 = JSON.parse(readFileSync(file1, 'utf8'));
  check('8. exported stories.json is valid JSON with 4 stories', exp1.schemaVersion === 1 && exp1.stories.length === 4);
  const e1 = exp1.stories.find((s) => s.id === 'story-0001');
  check('8. exported record keeps edits, paths and flags', e1.headline === 'From thirty documents to one guided path' && e1.status === 'review' && e1.published === false && e1.featured === true && e1.transcript === 'stories/story-0001/transcript.txt' && e1.teamId === 'learning-design', JSON.stringify(e1));
  await p.click('[data-testid=export-people]'); const people = JSON.parse(readFileSync(await waitDownload('people.json'), 'utf8'));
  check('8. people.json includes the employee and the manager', people.people.some((x) => x.name === 'Avery Example') && people.people.some((x) => x.name === 'Quinn Example' && x.isManager));
  await p.click('[data-testid=export-zip]');
  const zipName = await p.eval('new Promise(r => setTimeout(() => r(document.querySelector("dialog.modal b") && document.querySelector("dialog.modal b").textContent), 400))');
  const zipPath = await waitDownload(zipName);
  let zipOk = false, zipList = '';
  try { zipList = execFileSync('unzip', ['-l', zipPath]).toString(); execFileSync('unzip', ['-tq', zipPath]); zipOk = true; } catch (e) { zipList = String(e); }
  check('8. update package is a valid zip (unzip -t)', zipOk, zipList);
  check('8. package has data files, 4 transcripts and instructions', ['data/stories.json', 'data/people.json', 'data/teams.json', 'stories/story-0004/transcript.txt', 'HOW-TO-APPLY.txt'].every((f) => zipList.includes(f)), zipList);
  const utf16Orig = readFileSync(FX('transcripts/synthetic-08-utf16le.txt'));
  const utf16Zip = execFileSync('unzip', ['-p', zipPath, 'stories/story-0004/transcript.txt']);
  check('8. transcripts are packaged byte-for-byte (UTF-16 original)', Buffer.compare(utf16Orig, utf16Zip) === 0);
  check('no console errors during editing and export', p.errors.length === 0, p.errors.join('\n'));
  await p.send('Page.close').catch(() => {});

  /* 9. Import existing JSON without data loss */
  p = await newPage('#/export');
  await choose(p, '[data-testid=import-json]', [file1]);
  await p.waitFor(S('stories.length === 4'));
  await p.click('[data-testid=export-stories]');
  const exp2 = JSON.parse(readFileSync(await waitDownload('stories.json'), 'utf8'));
  check('9. re-imported stories.json exports identically (apart from timestamp)', deepEq(stripMeta(exp1), stripMeta(exp2)));
  check('9. transcripts not loaded after JSON-only import is handled', await p.eval(`(location.hash = '#/story/story-0001', new Promise(r => setTimeout(() => r(document.body.textContent.includes('Transcript not loaded')), 300)))`));
  await p.send('Page.close').catch(() => {});

  p = await newPage('#/export');
  await choose(p, '[data-testid=import-json]', [FX('data/edge-cases.stories.json')]);
  await p.waitFor(S('stories.length === 2'));
  await p.goto(URL + '#/stories');
  await sleep(300);
  check('security: script/HTML in JSON is rendered as text', await p.eval('document.querySelectorAll("#view img, #view script").length') === 0 && (await p.eval('document.querySelector("#view").textContent')).includes('<img src=x onerror'));
  check('security: no alert() fired', p.dialogs.filter((d) => d.type === 'alert').length === 0);
  await p.goto(URL + '#/export');
  await p.click('[data-testid=export-stories]');
  const exp3 = JSON.parse(readFileSync(await waitDownload('stories.json'), 'utf8'));
  const orig = JSON.parse(readFileSync(FX('data/edge-cases.stories.json'), 'utf8'));
  check('9. unknown fields, key order and unicode survive import → export', deepEq(stripMeta(exp3), stripMeta(orig)));
  await p.send('Page.close').catch(() => {});

  p = await newPage('#/export');
  await choose(p, '[data-testid=import-json]', [FX('data/duplicate-ids.stories.json')]);
  await p.waitFor(S('stories.length === 2'));
  await p.eval('document.querySelector("dialog.modal [data-testid] , dialog.modal .btn-primary") && document.querySelector("dialog.modal .btn-primary").click()');
  await p.goto(URL + '#/stories');
  await p.waitFor('document.querySelector("[data-testid=fix-ids]")');
  await p.click('[data-testid=fix-ids]');
  await p.click('[data-testid=modal-confirm]');
  await p.waitFor(S('stories[1].id === "story-0002"'));
  check('9. duplicate story IDs fixed in one click (others untouched)', await p.eval(S('stories[0].id')) === 'story-0001' && await p.eval(S('stories[1].name')) === 'Second Duplicate' && await p.eval('!document.querySelector("[data-testid=fix-ids]")'));
  await p.send('Page.close').catch(() => {});

  /* 10. Unsupported / blocked folder access falls back gracefully */
  p = await newPage('#/dashboard', "window.showDirectoryPicker = async () => { throw new DOMException('Blocked by policy (simulated)', 'SecurityError'); };");
  await p.click('[data-testid=open-folder]');
  await p.waitFor('document.querySelector("[data-testid=choose-readonly]")');
  check('10. blocked folder access offers the read-only fallback', (await p.eval('document.querySelector("dialog.modal").textContent')).includes('read-only'));
  let roOk = false, roDetail = '';
  try {
    await choose(p, '[data-testid=choose-readonly]', [FX('sample-project')]);
    await p.waitFor(S('mode === "readonly"'), 6000);
    roOk = await p.eval(S('stories.length')) === 2 && await p.eval(S('transcripts.size')) === 2 && await p.eval(S('assetExists("stories/story-0001/transcript.txt")')) === true;
  } catch (e) { roDetail = e.message; }
  check('10. read-only folder loads the sample project (JSON + transcripts)', roOk, roDetail || 'directory upload via CDP may be unsupported');
  check('10. read-only mode shows Export instead of Save', await p.eval('!document.querySelector("[data-testid=save-project]") && !!document.querySelector("[data-testid=go-export]")'));
  check('no console errors in fallback flow', p.errors.length === 0, p.errors.join('\n'));
  await p.send('Page.close').catch(() => {});

  p = await newPage('#/dashboard', 'delete window.showDirectoryPicker; delete Window.prototype.showDirectoryPicker;');
  await p.click('[data-testid=open-folder]');
  await p.waitFor('document.querySelector("dialog.modal")');
  check('10. missing File System Access API is explained, not a crash', (await p.eval('document.querySelector("dialog.modal").textContent')).includes('doesn\'t offer direct folder access') && p.errors.length === 0, p.errors.join('\n'));
  await p.send('Page.close').catch(() => {});

  /* Diagnostics */
  p = await newPage('#/diagnostics');
  await sleep(300);
  check('diagnostics: capability probes rendered', await p.eval('document.querySelectorAll("[data-testid^=diag-]").length') >= 20);
  await choose(p, '[data-testid=diag-run-tFile]', [FX('transcripts/synthetic-05-low-signal.txt')]);
  await p.waitFor('window.BTT.Diagnostics.results.get("tFile") && window.BTT.Diagnostics.results.get("tFile").status === "pass"');
  check('diagnostics: live file-selection test passes', true);
  const report = await p.eval('window.BTT.Diagnostics.report()');
  check('diagnostics: report has no file names', !report.includes('synthetic-05') && report.includes('Select files'));
  await p.send('Page.close').catch(() => {});

  /* Direct "Save to Project" path. The OS folder picker can't be automated, so showDirectoryPicker
     is stubbed to return a real writable directory handle (Chrome's origin-private file system has
     the same API). OPFS needs an http origin, so a throwaway localhost server serves the repo. */
  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = join(ROOT, rel);
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const HTTP = `http://127.0.0.1:${server.address().port}/builder/builder.html`;
  try {
    p = await openPage(browser, null, { downloadPath: DL });
    await p.send('Page.setInterceptFileChooserDialog', { enabled: true });
    browser.on((m) => { if (m.sessionId === p.sessionId && m.method === 'Page.fileChooserOpened' && p.nextFiles) { const files = p.nextFiles; p.nextFiles = null; p.send('DOM.setFileInputFiles', { files, backendNodeId: m.params.backendNodeId }).then(() => { p.chooserDone = true; }); } if (m.sessionId === p.sessionId && m.method === 'Page.javascriptDialogOpening') p.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });
    await p.send('Page.addScriptToEvaluateOnNewDocument', { source: "window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('proj', { create: true });" });
    await p.goto(HTTP + '#/dashboard');
    const seed = {};
    for (const rel of ['data/stories.json', 'data/people.json', 'data/teams.json', 'stories/story-0001/transcript.txt', 'stories/story-0002/transcript.txt']) seed[rel] = readFileSync(FX('sample-project/' + rel), 'utf8');
    const opfs = `(async () => { const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('proj', { create: true });
      const dir = async (parts) => { let d = root; for (const x of parts) d = await d.getDirectoryHandle(x, { create: true }); return d; };
      const write = async (rel, text) => { const ps = rel.split('/'); const d = await dir(ps.slice(0, -1)); const w = await (await d.getFileHandle(ps.pop(), { create: true })).createWritable(); await w.write(text); await w.close(); };
      const read = async (rel) => { const ps = rel.split('/'); const d = await dir(ps.slice(0, -1)); return (await (await d.getFileHandle(ps.pop())).getFile()).text(); };
      const list = async (rel) => { const out = []; for await (const k of (await dir(rel.split('/'))).keys()) out.push(k); return out.sort(); };
      return { write, read, list }; })()`;
    await p.eval(`(async () => { const fs = await ${opfs}; const seed = ${JSON.stringify(seed)}; for (const [k, v] of Object.entries(seed)) await fs.write(k, v); return true; })()`);
    await p.click('[data-testid=open-folder]');
    await p.waitFor(S('mode === "direct"'));
    check('direct: project folder opens with write access', await p.eval(S('canWrite')) === true && await p.eval(S('stories.length')) === 2 && await p.eval(S('transcripts.size')) === 2);
    await p.goto(HTTP + '#/import');
    p.nextFiles = [FX('transcripts/synthetic-06-webvtt-voices.txt')]; p.chooserDone = false;
    await p.click('[data-testid=choose-files]');
    await p.waitFor(S('stories.length === 3'));
    await p.goto(HTTP + '#/story/story-0002');
    await p.waitFor('document.querySelector("#f-description")');
    await p.type('#f-description', 'Jordan cut nightly alerts by about 80 percent.');
    await p.click('[data-testid=save-project]');
    await p.waitFor('document.querySelector("[data-testid=save-plan]")');
    const planText = await p.eval('document.querySelector("[data-testid=save-plan]").textContent');
    check('direct: save shows exactly which files will be written', planText.includes('data/stories.json') && planText.includes('stories/story-0003/transcript.txt') && planText.includes('backups/stories-'), planText);
    await p.click('[data-testid=modal-confirm]');
    await p.waitFor(S('hasUnsaved() === false'));
    const after = await p.eval(`(async () => { const fs = await ${opfs}; return { stories: JSON.parse(await fs.read('data/stories.json')), backups: await fs.list('backups'), t3: await fs.read('stories/story-0003/transcript.txt'), t1: await fs.read('stories/story-0001/transcript.txt') }; })()`);
    check('direct: stories.json written with all 3 stories and the edit', after.stories.stories.length === 3 && after.stories.stories.find((s) => s.id === 'story-0002').description === 'Jordan cut nightly alerts by about 80 percent.');
    check('direct: previous stories.json backed up first', after.backups.some((b) => /^stories-.*\.json$/.test(b)), after.backups.join(', '));
    check('direct: new transcript written byte-for-byte; existing one untouched', after.t3 === readFileSync(FX('transcripts/synthetic-06-webvtt-voices.txt'), 'utf8') && after.t1 === seed['stories/story-0001/transcript.txt']);
    const backupText = await p.eval(`(async () => { const fs = await ${opfs}; const b = (await fs.list('backups')).find((x) => x.startsWith('stories-')); return fs.read('backups/' + b); })()`);
    check('direct: backup is the exact previous file', backupText === seed['data/stories.json']);
    await p.click('[data-testid=save-project]').catch(() => {});
    await sleep(400);
    check('direct: saving again with no changes writes nothing', !(await p.eval('!!document.querySelector("[data-testid=save-plan]")')));
    // Someone edits stories.json outside the builder → conflict warning, backup of their version kept.
    await p.eval(`(async () => { const fs = await ${opfs}; const d = JSON.parse(await fs.read('data/stories.json')); d.stories[0].headline = 'Edited elsewhere'; await fs.write('data/stories.json', JSON.stringify(d, null, 2)); })()`);
    await p.type('#f-description', 'Jordan cut nightly alerts by about 80 percent, and response times improved.');
    await p.click('[data-testid=save-project]');
    await p.waitFor('document.querySelector("[data-testid=save-plan]")');
    check('direct: changes made outside the builder are detected before overwriting', (await p.eval('document.querySelector("dialog.modal").textContent')).includes('Changed outside the builder'));
    await p.click('[data-testid=modal-confirm]');
    await p.waitFor(S('hasUnsaved() === false'));
    const backups2 = await p.eval(`(async () => { const fs = await ${opfs}; const out = []; for (const b of (await fs.list('backups')).filter((x) => x.startsWith('stories-'))) out.push(await fs.read('backups/' + b)); return out; })()`);
    check('direct: the outside edit is preserved in a backup', backups2.some((t) => t.includes('Edited elsewhere')));
    check('no console errors in direct-save flow', p.errors.length === 0, p.errors.join('\n'));
    await p.send('Page.close').catch(() => {});
  } finally { server.close(); }

  /* Static: no network */
  p = await newPage('#/dashboard');
  const csp = await p.eval('document.querySelector("meta[http-equiv=Content-Security-Policy]").content');
  check('security: CSP blocks all network connections', /connect-src 'none'/.test(csp) && /default-src 'none'/.test(csp));
  check('security: fetch() to the network is refused', await p.eval('fetch("https://example.com").then(() => false, () => true)'));
  await p.send('Page.close').catch(() => {});
} catch (e) {
  check('E2E run completed without exceptions', false, e.stack || String(e));
} finally {
  await browser.close();
}
console.log(`\nE2E ${failed ? 'FAIL' : 'PASS'} ${passed}/${passed + failed}`);
process.exit(failed ? 1 : 0);
