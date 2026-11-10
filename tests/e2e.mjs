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
  if (hash !== null) await p.goto(URL + hash);
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
  check('0.5 import log says which fields were filled from the transcript', (await p.eval('document.querySelector("[data-testid=import-log]").textContent')).includes('Filled from the transcript: name'));
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

  /* v0.5: fields filled from the transcript, description choices, Copilot directory lookup */
  const t3 = await p.eval(S('get("story-0003")'));
  check('0.5 import fills name, headline, description, quote and tags from the transcript', t3.name === 'Taylor Mockname' && t3.headline && t3.description.includes('Taylor') && t3.quote && t3.tags.length > 0 && t3.fieldSources.name === 'auto', JSON.stringify(t3));
  await p.goto(URL + '#/story/story-0003');
  await p.waitFor('document.querySelectorAll("[data-testid=description-suggestion]").length > 0');
  check('0.5 name shows where it came from', (await p.eval('(document.querySelector("[data-testid=name-evidence]") || {}).textContent || ""')).includes('I\'m Taylor Mockname') && (await p.eval('document.querySelector("#f-name").closest(".field").textContent')).includes('From transcript'));
  check('0.5 description suggestions offered (exact words + templates)', await p.eval('document.querySelectorAll("[data-testid=description-suggestion]").length') >= 2 && (await p.eval('document.querySelector("[data-testid=description-suggestion]").textContent')).includes('Exact words'));
  const pickText = await p.eval('document.querySelectorAll("[data-testid=description-suggestion] .hl-text")[1].textContent');
  await p.eval('document.querySelectorAll("[data-testid=description-suggestion] [data-testid=use-description]")[1].click()');
  await p.waitFor(S(`get("story-0003").description === ${JSON.stringify(pickText)}`));
  check('0.5 "Use" sets the chosen description', await p.eval(S('get("story-0003").fieldSources.description')) === 'chosen' && await p.eval('document.querySelector("#f-description").value') === pickText);
  // Highlight words in the transcript, then "Use as description"
  await p.eval(`(() => { const seg = [...document.querySelectorAll("[data-testid=transcript-box] .seg-text")].find((x) => x.textContent.includes("We invited eight customers"));
    const node = [...seg.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes("We invited")) || seg.firstChild; const r = document.createRange();
    const i = node.textContent.indexOf("We invited"); r.setStart(node, i); r.setEnd(node, node.textContent.indexOf("with us") + 7); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); })()`);
  await p.waitFor('!document.querySelector("[data-testid=use-selection-desc]").disabled');
  await p.eval('document.querySelector("[data-testid=use-selection-desc]").click()');
  await p.waitFor(S('get("story-0003").description.startsWith("Taylor on ")'));
  check('0.5 "Use as description" quotes the highlighted words', (await p.eval(S('get("story-0003").description'))).includes('“We invited eight customers who use screen readers to test every new screen with us”'), await p.eval(S('get("story-0003").description')));
  // Copilot prompt names the employee and asks for the directory lookup
  await p.click('[data-testid=copilot-copy]');
  await p.waitFor('document.querySelector("[data-testid=copilot-prompt]")');
  const prompt = await p.eval('document.querySelector("[data-testid=copilot-prompt]").value');
  check('0.5 Copilot prompt includes the name and the directory lookup', prompt.includes('- Name: Taylor Mockname') && /company directory/i.test(prompt) && prompt.includes('JOB TITLE:') && prompt.includes('MANAGER:'), prompt.slice(0, 400));
  await p.eval('(() => { const n = document.querySelector("[data-testid=copilot-name]"); n.value = "Taylor Q. Mockname"; n.dispatchEvent(new Event("input")); })()');
  check('0.5 name can be corrected before copying', (await p.eval('document.querySelector("[data-testid=copilot-prompt]").value')).includes('- Name: Taylor Q. Mockname') && await p.eval(S('get("story-0003").name')) === 'Taylor Mockname');
  await p.eval('[...document.querySelectorAll("dialog.modal button")].find((b) => b.textContent.trim() === "Cancel").click()');
  await p.waitFor('!document.querySelector("dialog.modal[open]")');
  // Paste a (synthetic) reply and apply it
  const reply = ['NAME: Taylor Mockname', 'JOB TITLE: Senior Product Designer', 'TEAM: Mobile Experience', 'MANAGER: Quinn Example (Director, Digital Design)', 'DIRECTORY NOTE: NONE',
    'HEADLINE 1: Designing with screen reader users', 'DESCRIPTION 1: Meet Taylor and hear how customers who use screen readers shaped a redesign.', 'DESCRIPTION 2: Taylor shares what changed when customers tested every screen.',
    'QUOTE: We invited eight customers who use screen readers to test every new screen with us.', 'TAGS: Accessibility, Mobile'].join('\n');
  await p.eval(`(() => { const t = document.querySelector("[data-testid=copilot-paste]"); t.value = ${JSON.stringify(reply)}; })()`);
  await p.click('[data-testid=copilot-read]');
  await p.waitFor('document.querySelector("[data-testid=copilot-apply]")');
  const pre = await p.eval('Object.fromEntries(["role","team","manager","description","headline","tags"].map((k) => [k, !!(document.querySelector("[data-testid=cp-use-" + k + "]") || {}).checked]))');
  check('0.5 review pre-selects empty and auto-filled fields, not the chosen description', pre.role && pre.team && pre.manager && pre.headline && pre.tags && !pre.description, JSON.stringify(pre));
  await p.click('[data-testid=copilot-apply]');
  await p.waitFor(S('get("story-0003").role === "Senior Product Designer"'));
  const t3b = await p.eval(`(() => { const st = window.BTT.store, s = st.get("story-0003"); const m = st.person(s.managerId); return { team: st.teamName(s.teamId), mgr: m && m.name, mgrTitle: m && m.title, mgrIsManager: m && m.isManager, src: s.fieldSources, desc: s.description, hl: s.headline, hlSrc: s.headlineSource, tags: s.tags, title: st.person(s.personId).title }; })()`);
  check('0.5 Copilot reply applied: job title, team, manager (with title), headline, tags', t3b.team === 'Mobile Experience' && t3b.mgr === 'Quinn Example' && t3b.mgrIsManager && t3b.mgrTitle === 'Director, Digital Design' && t3b.hl === 'Designing with screen reader users' && t3b.hlSrc === 'copilot' && t3b.tags.includes('Mobile') && t3b.title === 'Senior Product Designer' && t3b.src.role === 'copilot' && t3b.src.team === 'copilot', JSON.stringify(t3b));
  check('0.5 the description you chose was kept', t3b.desc.startsWith('Taylor on '), t3b.desc);
  await sleep(300);
  check('0.5 form shows Copilot as the source of the job title', (await p.eval('document.querySelector("#f-role").closest(".field").textContent')).includes('From Copilot'), await p.eval('document.querySelector("#f-role").closest(".field").textContent'));
  await p.eval('(() => { const el = document.querySelector("#f-status"); el.value = "review"; el.dispatchEvent(new Event("change")); })()');
  check('0.5 story filled from transcript + Copilot can move to Ready for review', await p.eval(S('get("story-0003").status')) === 'review');
  check('no console errors in the auto-fill and Copilot flow', p.errors.length === 0, p.errors.join('\n'));

  /* 8. Export valid JSON */
  await p.goto(URL + '#/export');
  await p.eval('document.querySelectorAll("#toasts > *").forEach((t) => t.remove())'); // long notifications can cover the buttons
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

  /* ---------------- Milestone 2: media ---------------- */
  const { mkdirSync, copyFileSync, writeFileSync: wf } = await import('node:fs');
  const exportDir = mkdtempSync(join(tmpdir(), 'btt-socialive-'));
  const SOC = join(exportDir, 'Socialive export');
  mkdirSync(SOC);
  copyFileSync(FX('transcripts/synthetic-01-timestamped-speakers.txt'), join(SOC, 'synthetic-01-timestamped-speakers.txt'));
  copyFileSync(FX('media/synthetic-01-timestamped-speakers.mp4'), join(SOC, 'synthetic-01-timestamped-speakers.mp4'));
  copyFileSync(FX('media/synthetic-01-timestamped-speakers.vtt'), join(SOC, 'synthetic-01-timestamped-speakers.vtt'));
  copyFileSync(FX('transcripts/synthetic-02-speaker-blocks.txt'), join(SOC, 'synthetic-02-speaker-blocks.txt'));
  copyFileSync(FX('media/synthetic-01-timestamped-speakers.mp4'), join(SOC, 'unlabelled clip.mp4'));
  wf(join(SOC, 'notes.docx'), 'ignored');
  const MP4 = readFileSync(FX('media/synthetic-01-timestamped-speakers.mp4'));

  p = await newPage('#/import');
  await choose(p, '[data-testid=import-folder]', [SOC]);
  await p.waitFor(S('stories.length === 2') + ' && ' + S('media.get("story-0001") && window.BTT.store.media.get("story-0001").captions'), 20000);
  const m1 = await p.eval(`(() => { const s = ${S('get("story-0001")')}; const m = ${S('media.get("story-0001")')}; return { video: s.video, duration: s.duration, thumb: s.thumbnail, captions: s.captions, tsrc: m.thumbnail && m.thumbnail.source, tsize: m.thumbnail && m.thumbnail.size, cues: m.captions.check.cues }; })()`);
  check('M2: folder import makes stories from transcripts', await p.eval(S('stories.length')) === 2);
  check('M2: video matched by name and its duration read (6 s)', m1.video === 'stories/story-0001/video.mp4' && m1.duration === 6, JSON.stringify(m1));
  check('M2: thumbnail auto-captured from the video on file://', m1.thumb === 'stories/story-0001/thumbnail.jpg' && m1.tsrc === 'auto' && m1.tsize > 500, JSON.stringify(m1));
  check('M2: captions matched and validated (3 cues)', m1.captions === 'stories/story-0001/captions.vtt' && m1.cues === 3);
  check('M2: unmatched video listed for manual assignment', await p.eval(S('unmatched.length')) === 1 && await p.eval(S('unmatched[0].file.name')) === 'unlabelled clip.mp4');
  await p.waitFor('location.hash === "#/media"');
  await p.eval('(() => { const row = document.querySelector("[data-testid=unmatched-row]"); const sel = row.querySelector("select"); sel.value = "story-0002"; })()');
  await p.eval('[...document.querySelectorAll("[data-testid=unmatched-row] button")].find(b => b.textContent.includes("Assign")).click()');
  await p.waitFor(S('get("story-0002").video === "stories/story-0002/video.mp4"'), 15000);
  check('M2: manual assignment attaches the video to the chosen story', await p.eval(S('unmatched.length')) === 0);
  check('M2: media report lists each story', await p.eval('document.querySelectorAll("[data-testid=media-row]").length') === 2);

  /* v0.5.1: one transcript + its video in one go (names differ); review without a team; Copilot copy keeps line breaks */
  {
    const one = join(exportDir, 'one person');
    mkdirSync(one);
    copyFileSync(FX('transcripts/synthetic-04-plain.txt'), join(one, 'transcript_2026-11-10.txt'));
    copyFileSync(FX('media/synthetic-01-timestamped-speakers.mp4'), join(one, 'IMG_0420.mp4'));
    const q = await newPage('#/import');
    await choose(q, '[data-testid=choose-files]', [join(one, 'transcript_2026-11-10.txt'), join(one, 'IMG_0420.mp4')]);
    await q.waitFor(S('stories.length === 1') + ' && ' + S('get("story-0001").video'), 20000);
    check('0.5.1 a video imported with its transcript attaches automatically, even with a different name', await q.eval(S('get("story-0001").video')) === 'stories/story-0001/video.mp4' && await q.eval(S('unmatched.length')) === 0);
    await q.goto(URL + '#/story/story-0001');
    await q.waitFor('document.querySelector("#f-role")');
    check('0.5.1 Team is optional in the form', !(await q.eval('document.querySelector("#f-team").closest(".field").querySelector(".req")')) && (await q.eval('document.querySelector("#f-team").closest(".field").textContent')).includes('optional'));
    await q.type('#f-role', 'Customer Service Specialist');
    await q.eval('(() => { const el = document.querySelector("#f-status"); el.value = "review"; el.dispatchEvent(new Event("change")); })()');
    check('0.5.1 story with no team can move to Ready for review', await q.eval(S('get("story-0001").status')) === 'review' && !(await q.eval(S('get("story-0001").teamId'))));
    // Capture what the Copilot dialog puts on the clipboard
    await q.eval(`(() => { window.__clip = null; navigator.clipboard.write = async (items) => { const it = items[0]; window.__clip = {}; for (const t of it.types) window.__clip[t] = await (await it.getType(t)).text(); }; })()`);
    await q.click('[data-testid=copilot-copy]');
    await q.waitFor('document.querySelector("[data-testid=copilot-do-copy]")');
    await q.eval('(() => { const a = document.querySelector("[data-testid=copilot-ack]"); if (a && !a.checked) { a.click(); } })()');
    await q.eval('document.querySelector("[data-testid=copilot-do-copy]").click()');
    await q.waitFor('window.__clip && window.__clip["text/html"]');
    const clip = await q.eval('window.__clip');
    check('0.5.1 Copilot copy puts line breaks on the clipboard as HTML and as CRLF text', /JOB TITLE: [^<]*<br>TEAM:/.test(clip['text/html']) && clip['text/plain'].includes('\r\nJOB TITLE:') && clip['text/html'].includes('Morgan Fixture'), JSON.stringify(clip).slice(0, 300));
    check('no console errors in the single-import flow', q.errors.length === 0, q.errors.join('\n'));
    await q.send('Page.close').catch(() => {});
  }

  await p.goto(URL + '#/story/story-0001');
  await p.waitFor('document.querySelector("[data-testid=video-player]") && document.querySelector("[data-testid=video-player]").readyState >= 2', 15000);
  await p.eval('(() => { const v = document.querySelector("[data-testid=video-player]"); v.currentTime = 4; return new Promise(r => v.addEventListener("seeked", r, { once: true })); })()');
  await p.click('[data-testid=capture-frame]');
  await p.waitFor(S('media.get("story-0001").thumbnail.source === "frame"'));
  check('M2: "Use this frame as thumbnail" captures the paused frame', Math.abs(await p.eval(S('media.get("story-0001").thumbnail.time')) - 4) < 0.2);
  check('M2: card preview shows the real thumbnail', await p.eval('!!document.querySelector("[data-testid=preview] .s-media img")'));
  check('M2: player has the captions track', await p.eval('!!document.querySelector("[data-testid=video-player] track")'));
  await p.type('#f-role', 'Learning Designer');
  await p.type('#f-team', 'Learning Design'); await p.eval('document.querySelector("#f-team").dispatchEvent(new Event("change"))');
  await p.type('#f-headline', 'The project I\'m most proud of is Team Hub');
  await p.type('#f-description', 'Avery turned thirty onboarding documents into one guided path.');
  await p.eval('(() => { const el = document.querySelector("#f-status"); el.value = "approved"; el.dispatchEvent(new Event("change")); })()');
  await p.waitFor(S('get("story-0001").status === "approved"'));
  await p.goto(URL + '#/story/story-0001');
  await p.waitFor('document.querySelector("[data-testid=field-published]") && !document.querySelector("[data-testid=field-published]").disabled');
  await p.click('[data-testid=field-published]');
  await p.waitFor(S('get("story-0001").published === true'));
  check('M2: approved story with video + thumbnail can be published', await p.eval(S('get("story-0001").status')) === 'published');

  await p.goto(URL + '#/export');
  await p.click('[data-testid=export-zip]');
  await p.waitFor('document.querySelector("[data-testid=zip-with-videos]")');
  await p.click('[data-testid=zip-with-videos]');
  await p.waitFor('[...document.querySelectorAll("dialog.modal h2")].some(h => h.textContent.includes("Update package downloaded"))', 15000);
  const zipName2 = await p.eval('document.querySelector("dialog.modal b").textContent');
  const zip2 = await waitDownload(zipName2, 15000);
  let list2 = ''; let zipOk2 = false;
  try { list2 = execFileSync('unzip', ['-l', zip2]).toString(); execFileSync('unzip', ['-tq', zip2]); zipOk2 = true; } catch (e) { list2 = String(e); }
  check('M2: package with videos is a valid zip', zipOk2, list2);
  check('M2: package holds video, thumbnail and captions', ['stories/story-0001/video.mp4', 'stories/story-0001/thumbnail.jpg', 'stories/story-0001/captions.vtt', 'stories/story-0002/video.mp4'].every((f) => list2.includes(f)), list2);
  check('M2: packaged video is byte-identical', Buffer.compare(execFileSync('unzip', ['-p', zip2, 'stories/story-0001/video.mp4']), MP4) === 0);
  const jpg = execFileSync('unzip', ['-p', zip2, 'stories/story-0001/thumbnail.jpg']);
  check('M2: packaged thumbnail is a JPEG', jpg[0] === 0xFF && jpg[1] === 0xD8);
  const pj = JSON.parse(execFileSync('unzip', ['-p', zip2, 'data/stories.json']).toString());
  const ps1 = pj.stories.find((x) => x.id === 'story-0001');
  check('M2: exported record is published with media paths and duration', ps1.published === true && ps1.status === 'published' && ps1.duration === 6 && ps1.captions === 'stories/story-0001/captions.vtt', JSON.stringify(ps1));
  // Milestone 4: release zip (published story-0001 only)
  await p.eval('document.querySelectorAll("dialog[open]").forEach((d) => d.querySelector(".modal-foot .btn-primary").click())');
  await p.eval('location.hash = "#/release"');
  await p.waitFor('document.querySelector("[data-testid=release-checks]")');
  check('M4: release checks pass with 1 published story', (await p.eval('document.querySelector("[data-testid=release-checks]").textContent')).includes('1 published story ready'));
  await p.click('[data-testid=release-zip]');
  await p.waitFor('[...document.querySelectorAll(".banner")].some(b => b.textContent.includes("Release ready"))', 20000);
  const relName = await p.eval('[...document.querySelectorAll(".banner")].find(b => b.textContent.includes("Release ready")).textContent.match(/beyond-the-title-release-[^ ]+\\.zip/)[0]');
  const relZip = await waitDownload(relName, 15000);
  const relList = execFileSync('unzip', ['-l', relZip]).toString();
  check('M4: release zip has the website, data and published media', ['index.html', 'js/app.js', 'css/styles.css', 'data/stories.json', 'data/site-data.js', 'stories/story-0001/video.mp4', 'stories/story-0001/thumbnail.jpg', 'stories/story-0001/captions.vtt'].every((f) => relList.includes(f)), relList);
  check('M4: release zip leaves out drafts, transcripts and backups', !relList.includes('story-0002') && !relList.includes('transcript.txt') && !relList.includes('backups/'), relList);
  const relDir = mkdtempSync(join(tmpdir(), 'btt-release-'));
  execFileSync('unzip', ['-q', relZip, '-d', relDir]);
  const relStories = JSON.parse(readFileSync(join(relDir, 'data', 'stories.json'), 'utf8'));
  check('M4: released records hold only site fields', relStories.stories.length === 1 && !('source' in relStories.stories[0]) && !('status' in relStories.stories[0]) && !('transcript' in relStories.stories[0]));
  const rp = await openPage(browser, null);
  await rp.send('Page.navigate', { url: `file://${relDir}/index.html#/` });
  await rp.waitFor('window.BTT_SITE && window.BTT_SITE.ready', 10000); await sleep(300);
  check('M4: unzipped release opens in Chrome showing only the published story', await rp.eval('window.BTT_SITE.debug.data.stories.length') === 1 && await rp.eval('!document.querySelector("[data-testid=preview-toggle]")') && rp.errors.length === 0, rp.errors.join('\n'));
  await rp.send('Page.close').catch(() => {});
  check('no console errors in media flow', p.errors.length === 0, p.errors.join('\n'));
  await p.send('Page.close').catch(() => {});

  /* Diagnostics video test on file:// */
  p = await newPage('#/diagnostics');
  await choose(p, '[data-testid=diag-run-tVideo]', [FX('media/synthetic-01-timestamped-speakers.mp4')]);
  await p.waitFor('window.BTT.Diagnostics.results.get("tVideo") && window.BTT.Diagnostics.results.get("tVideo").status !== "pending"', 15000);
  check('M2: diagnostics video test reads the MP4 and captures a frame', await p.eval('window.BTT.Diagnostics.results.get("tVideo").status') === 'pass', await p.eval('window.BTT.Diagnostics.results.get("tVideo").detail'));
  await p.send('Page.close').catch(() => {});

  /* Direct save of media, reopen last folder, scan for hand-copied files, People & Teams (OPFS stand-in folder) */
  const server2 = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = join(ROOT, rel);
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(readFileSync(file));
  });
  await new Promise((r) => server2.listen(0, '127.0.0.1', r));
  const HTTP2 = `http://127.0.0.1:${server2.address().port}/builder/builder.html`;
  try {
    p = await newPage(null);
    await p.send('Page.addScriptToEvaluateOnNewDocument', { source: "window.showDirectoryPicker = async (o) => (await navigator.storage.getDirectory()).getDirectoryHandle(window.__pick || (o && o.id === 'btt-release' ? 'rel' : 'proj2'), { create: true });" });
    await p.goto(HTTP2 + '#/dashboard');
    await p.click('[data-testid=open-folder]');
    await p.waitFor('document.querySelector("[data-testid=modal-confirm]")');
    await p.click('[data-testid=modal-confirm]');
    await p.waitFor(S('mode === "direct"'));
    await p.goto(HTTP2 + '#/import');
    await choose(p, '[data-testid=choose-files]', [join(SOC, 'synthetic-01-timestamped-speakers.txt'), join(SOC, 'synthetic-01-timestamped-speakers.mp4'), join(SOC, 'synthetic-01-timestamped-speakers.vtt'), join(SOC, 'synthetic-02-speaker-blocks.txt')]);
    await p.waitFor(S('media.get("story-0001") && window.BTT.store.media.get("story-0001").captions'), 20000);
    await p.click('[data-testid=save-project]');
    await p.waitFor('document.querySelector("[data-testid=save-plan]")');
    const plan2 = await p.eval('document.querySelector("[data-testid=save-plan]").textContent');
    check('M2 direct: save plan lists the video, thumbnail and captions', ['stories/story-0001/video.mp4', 'stories/story-0001/thumbnail.jpg', 'stories/story-0001/captions.vtt'].every((x) => plan2.includes(x)), plan2);
    await p.click('[data-testid=modal-confirm]');
    await p.waitFor(S('hasUnsaved() === false'), 20000);
    const opfs2 = `(async () => { const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('proj2');
      const get = async (rel) => { const ps = rel.split('/'); let d = root; for (const x of ps.slice(0, -1)) d = await d.getDirectoryHandle(x, { create: true }); return d.getFileHandle(ps.pop(), { create: false }).then((f) => f.getFile()).catch(() => null); };
      const put = async (rel, blob) => { const ps = rel.split('/'); let d = root; for (const x of ps.slice(0, -1)) d = await d.getDirectoryHandle(x, { create: true }); const w = await (await d.getFileHandle(ps.pop(), { create: true })).createWritable(); await w.write(blob); await w.close(); };
      return { get, put }; })()`;
    const saved = await p.eval(`(async () => { const fs = await ${opfs2}; const v = await fs.get('stories/story-0001/video.mp4'), t = await fs.get('stories/story-0001/thumbnail.jpg'), c = await fs.get('stories/story-0001/captions.vtt'); return { v: v && v.size, t: t && t.size, c: c && (await c.text()).startsWith('WEBVTT') }; })()`);
    check('M2 direct: video written in full, thumbnail and captions saved', saved.v === MP4.length && saved.t > 500 && saved.c === true, JSON.stringify(saved));
    check('M2 direct: after saving, assets show as in the project folder', await p.eval(S('assetState(window.BTT.store.get("story-0001"), "video")')) === 'saved' && !(await p.eval(S('media.has("story-0001")'))));
    // A video copied into a story folder by hand → Scan project folder links it and reads its length.
    await p.eval(`(async () => { const fs = await ${opfs2}; await fs.put('stories/story-0002/video.mp4', new Blob([new Uint8Array(${JSON.stringify([...MP4])})], { type: 'video/mp4' })); })()`);
    await p.goto(HTTP2 + '#/media');
    await p.click('[data-testid=scan-folder]');
    await p.waitFor(S('get("story-0002").video === "stories/story-0002/video.mp4"') + ' && ' + S('get("story-0002").duration === 6'), 15000);
    check('M2 direct: "Scan project folder" links a hand-copied video and reads its duration', true);
    // People & Teams
    await p.goto(HTTP2 + '#/people');
    const pid = await p.eval(S('get("story-0001").personId'));
    await p.type(`[data-testid=person-name-${pid}]`, 'Avery Q. Example');
    await p.eval(`document.querySelector("[data-testid=person-name-${pid}]").dispatchEvent(new Event("change"))`);
    check('M2: renaming a person updates their stories', await p.eval(S('get("story-0001").name')) === 'Avery Q. Example');
    await p.click('[data-testid=save-project]'); await p.waitFor('document.querySelector("[data-testid=modal-confirm]")'); await p.click('[data-testid=modal-confirm]');
    await p.waitFor(S('hasUnsaved() === false'), 15000);
    // Reopen last folder after a reload
    await p.goto(HTTP2 + '?reload=1#/dashboard'); // a real reload: the in-memory session is gone
    await p.waitFor('document.querySelector("[data-testid=reopen-folder]")');
    check('M2: nothing survives a reload except the folder shortcut', await p.eval(S('stories.length')) === 0);
    check('M2: "Reopen" shortcut offered after reload', (await p.eval('document.querySelector("[data-testid=reopen-folder]").textContent')).includes('proj2'));
    await p.click('[data-testid=reopen-folder]');
    await p.waitFor(S('mode === "direct" && window.BTT.store.stories.length === 2'), 15000);
    check('M2: reopened folder loads stories with saved media', await p.eval(S('assetState(window.BTT.store.get("story-0001"), "thumbnail")')) === 'saved' && await p.eval(S('get("story-0001").name')) === 'Avery Q. Example');
    // Milestone 3: install the website files, and site-data.js is written on save
    await p.eval('location.hash = "#/export"'); // same document: keep the reopened folder
    await p.waitFor('document.querySelector("[data-testid=install-site]")', 10000);
    check('M3: website shown as not installed yet', (await p.eval('document.querySelector("[data-testid=website-card]").textContent')).includes('Not installed'));
    await p.click('[data-testid=install-site]');
    await p.waitFor('document.querySelector("[data-testid=site-plan]")');
    await p.click('[data-testid=modal-confirm]');
    await p.waitFor('document.querySelector("[data-testid=website-card]") && document.querySelector("[data-testid=website-card]").textContent.includes("up to date")', 15000);
    const siteIdx = await p.eval(`(async () => { const fs = await ${opfs2}; const f = await fs.get('index.html'); const a = await fs.get('js/app.js'); return { idx: f && await f.text(), app: a && await a.text() }; })()`);
    check('M3: website files installed byte-for-byte', siteIdx.idx === readFileSync(join(ROOT, 'site', 'index.html'), 'utf8') && siteIdx.app === readFileSync(join(ROOT, 'site', 'js', 'app.js'), 'utf8'));
    const sdText = await p.eval(`(async () => { const fs = await ${opfs2}; const f = await fs.get('data/site-data.js'); return f && await f.text(); })()`);
    const sd = sdText && JSON.parse(sdText.slice(sdText.indexOf('= ') + 2, sdText.lastIndexOf(';')));
    check('M3: save wrote data/site-data.js with stories and caption text', !!sd && sd.stories.stories.length === 2 && Object.values(sd.captions).some((c) => c.startsWith('WEBVTT')));
    await p.click('[data-testid=save-project]'); await sleep(500);
    check('M3: site-data.js is stable (saving again writes nothing)', !(await p.eval('!!document.querySelector("[data-testid=save-plan]")')));
    // Milestone 4: write the release to a folder; refuse the project folder; re-release removes stale files
    await p.eval(`(async () => { const S = window.BTT.store, M = window.BTT;
      for (const id of ['story-0001', 'story-0002']) { const s = S.get(id); Object.assign(s, { role: 'Analyst', teamId: S.ensureTeam('Learning Design'), headline: 'Headline ' + id, description: 'Description ' + id });
        if (S.assetState(s, 'thumbnail') === 'none') { const v = await M.ProjectIO.readFile(S.dirHandle, s.video); const im = await new Promise((r) => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.toBlob(r, 'image/jpeg'); }); s.thumbnail = 'stories/' + id + '/thumbnail.jpg'; S.media.set(id, Object.assign(S.media.get(id) || {}, { thumbnail: { blob: im, source: 'file' } })); void v; }
        S.set(s, 'status', 'published'); } })()`);
    await p.eval('location.hash = "#/release"');
    await p.waitFor('document.querySelector("[data-testid=release-checks]") && document.querySelector("[data-testid=release-checks]").textContent.includes("2 published stories ready")', 10000);
    await p.eval('window.__pick = "proj2"');
    await p.click('[data-testid=release-write]');
    await p.waitFor('[...document.querySelectorAll("dialog.modal h2")].some(h => h.textContent.includes("project folder"))');
    check('M4: refuses to write a release into the project folder', true);
    await p.eval('document.querySelector("dialog.modal .btn-primary").click(); window.__pick = null');
    await p.eval(`(async () => { const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('notempty', { create: true }); const w = await (await d.getFileHandle('keep.txt', { create: true })).createWritable(); await w.write('x'); await w.close(); })()`);
    await p.eval('window.__pick = "notempty"');
    await p.click('[data-testid=release-write]');
    await p.waitFor('[...document.querySelectorAll("dialog.modal h2")].some(h => h.textContent.includes("Choose an empty folder"))');
    check('M4: refuses a non-empty folder that isn\'t a previous release', true);
    await p.eval('document.querySelector("dialog.modal .btn-primary").click(); window.__pick = null');
    await p.click('[data-testid=release-write]');
    await p.waitFor('document.querySelector("[data-testid=modal-confirm]")', 15000);
    await p.click('[data-testid=modal-confirm]');
    await p.waitFor('[...document.querySelectorAll(".banner")].some(b => b.textContent.includes("Release ready"))', 20000);
    const rel = await p.eval(`(async () => { const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('rel'); const out = []; const walk = async (d, pre) => { for await (const [n, hd] of d.entries()) { if (hd.kind === 'file') out.push(pre + n); else await walk(hd, pre + n + '/'); } }; await walk(root, ''); return out.sort(); })()`);
    check('M4: release folder has the site, data and both published stories\' media', ['index.html', 'js/app.js', 'data/stories.json', 'data/site-data.js', 'stories/story-0001/video.mp4', 'stories/story-0002/video.mp4', '.btt-release.json'].every((f) => rel.includes(f)), rel.join(', '));
    check('M4: release folder has no transcripts or backups', !rel.some((f) => /transcript\.txt|^backups\//.test(f)), rel.join(', '));
    // Unpublish story-0002 → re-release removes its files
    await p.eval('window.BTT.store.set(window.BTT.store.get("story-0002"), "status", "approved")');
    await p.eval('location.hash = "#/dashboard"'); await sleep(100); await p.eval('location.hash = "#/release"');
    await p.waitFor('document.querySelector("[data-testid=release-checks]") && document.querySelector("[data-testid=release-checks]").textContent.includes("1 published story ready")', 10000);
    await p.click('[data-testid=release-write]');
    await p.waitFor('document.querySelector("[data-testid=release-stale]")', 15000);
    check('M4: re-release lists files of the unpublished story for removal', (await p.eval('document.querySelector("[data-testid=release-stale]").textContent')).includes('stories/story-0002/video.mp4'));
    await p.click('[data-testid=modal-confirm]');
    await sleep(1500);
    const rel2 = await p.eval(`(async () => { const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('rel'); const out = []; const walk = async (d, pre) => { for await (const [n, hd] of d.entries()) { if (hd.kind === 'file') out.push(pre + n); else await walk(hd, pre + n + '/'); } }; await walk(root, ''); return out.sort(); })()`);
    const relJson = await p.eval(`(async () => { const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('rel'); const d = await root.getDirectoryHandle('data'); return JSON.parse(await (await (await d.getFileHandle('stories.json')).getFile()).text()); })()`);
    check('M4: re-release removed the unpublished story\'s files and record', !rel2.some((f) => f.includes('story-0002')) && relJson.stories.length === 1 && rel2.includes('stories/story-0001/video.mp4'), rel2.join(', '));
    check('no console errors in direct media flow', p.errors.length === 0, p.errors.join('\n'));
    await p.send('Page.close').catch(() => {});
  } finally { server2.close(); }

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
