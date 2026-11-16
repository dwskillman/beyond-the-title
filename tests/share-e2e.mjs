#!/usr/bin/env node
// Optional dev-machine end-to-end test of the "Share your story" page (site/share.html) against a stand-in
// for Syndicate with uploads switched on (tests/mock-syndicate.mjs). Synthetic data only.
//
// Headless Chrome can't open a real camera here, so the page gets a synthetic camera (an animated canvas plus a
// quiet tone) through getUserMedia. MediaRecorder, the uploads and everything else are real. Speech recognition
// is replaced by a scripted stand-in that behaves like Chrome's on-device mode; tests/speech-check.mjs runs the
// real on-device engine.
//   node tests/share-e2e.mjs
import { launch, openPage, sleep } from './cdp.mjs';
import { startMock } from './mock-syndicate.mjs';
import { makePreview } from './make-site-preview.mjs';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync, rmSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
function check(name, cond, detail = '') { cond ? passed++ : failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${!cond && detail ? '\n     ' + detail : ''}`); }

const SITE = makePreview(mkdtempSync(join(tmpdir(), 'btt-share-site-')));
const UP = mkdtempSync(join(tmpdir(), 'btt-share-up-'));
const DL = mkdtempSync(join(tmpdir(), 'btt-share-dl-'));
const SHARE = { enabled: true, uploadUrl: 'submissions/', method: 'put', chunkMB: 0.25, maxMinutes: 2, prompts: ['Say your name and your job title.', 'Tell us about a project you are proud of.'], consentText: 'I agree to the synthetic test terms.', contact: 'Questions? Contact the synthetic test team.', allowSpeechDownload: true, language: 'en-US' };
function storiesDoc(share) { const d = JSON.parse(readFileSync(join(SITE, 'data', 'stories.json'), 'utf8')); d.settings = { share }; return JSON.stringify(d); }
writeFileSync(join(SITE, 'data', 'stories.json'), storiesDoc(SHARE));
const mock = await startMock({ root: SITE, uploadDir: UP });
const BASE = mock.url + '/share.html';

const FAKE_MEDIA = `(() => {
  if (!navigator.mediaDevices) return;
  navigator.mediaDevices.getUserMedia = async () => {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); let f = 0;
    const tick = () => { g.fillStyle = 'hsl(' + ((f * 4) % 360) + ',55%,42%)'; g.fillRect(0, 0, 640, 360); g.fillStyle = '#fff'; g.font = '44px sans-serif'; g.fillText('Synthetic camera ' + f++, 40, 190); };
    tick(); setInterval(tick, 33);
    const ac = new AudioContext(), osc = ac.createOscillator(), gain = ac.createGain(), dest = ac.createMediaStreamDestination();
    gain.gain.value = 0.03; osc.connect(gain); gain.connect(dest); osc.start();
    return new MediaStream([...cv.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  };
})();`;
const PHRASES = ["Hi I'm Jordan sample", 'I lead the data quality group', "The thing I'm proudest of is the mentoring circle we started for new analysts", 'Outside work I coach youth soccer'];
const FAKE_SR = (status = 'available') => `(() => {
  window.__srCalls = []; window.__srStatus = ${JSON.stringify(status)};
  const SCRIPT = ${JSON.stringify(PHRASES)};
  const mk = (t, fin) => { const r = [{ transcript: t, confidence: 0.9 }]; r.isFinal = fin; return r; };
  class FakeSR {
    constructor() { this._pl = false; this.lang = 'en-US'; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this._timers = []; this._results = []; this._on = false; }
    get processLocally() { return this._pl; } set processLocally(v) { this._pl = v === true; }
    static available(o) { __srCalls.push('available:' + (o && o.processLocally)); return Promise.resolve(window.__srStatus); }
    static install() { __srCalls.push('install'); window.__srStatus = 'available'; return Promise.resolve(true); }
    start(track) {
      __srCalls.push('start:' + (track ? 'track' : 'mic') + ':' + this._pl);
      if (!this._pl) throw new Error('This would have used cloud recognition');
      this._on = true; let t = 300;
      SCRIPT.forEach((phrase, pi) => {
        const words = phrase.split(' ');
        words.forEach((w, wi) => { t += 110; this._timers.push(setTimeout(() => this._emit(pi, words.slice(0, wi + 1).join(' '), false), t)); });
        if (pi < SCRIPT.length - 1) { t += 200; this._timers.push(setTimeout(() => this._emit(pi, phrase, true), t)); }
        t += 300;
      });
    }
    _emit(i, text, fin) { if (!this._on) return; this._results[i] = mk(text, fin); this.onresult && this.onresult({ resultIndex: i, results: this._results.slice() }); }
    stop() { this._finish(); } abort() { this._finish(); }
    _finish() { if (!this._on) return; this._on = false; this._timers.forEach(clearTimeout); setTimeout(() => this.onend && this.onend(), 30); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
})();`;
// An older browser: recognition exists but has no on-device mode. It must never be started.
const OLD_SR = `(() => { window.__srCalls = []; class OldSR { start() { __srCalls.push('start'); } stop() {} abort() {} } window.SpeechRecognition = OldSR; window.webkitSpeechRecognition = OldSR; })();`;

const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const foreign = [];
async function sharePage(init, url = BASE) {
  const p = await openPage(browser, null, { downloadPath: DL });
  await browser.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: DL, eventsEnabled: true });
  await p.send('Network.enable');
  await p.send('Page.setInterceptFileChooserDialog', { enabled: true });
  browser.on((m) => {
    if (m.sessionId !== p.sessionId) return;
    if (m.method === 'Network.requestWillBeSent') { const u = m.params.request.url; if (!/^(blob:|data:)/.test(u) && !u.startsWith(mock.url)) foreign.push(u); }
    if (m.method === 'Page.fileChooserOpened' && p.nextFiles) { const files = p.nextFiles; p.nextFiles = null; p.send('DOM.setFileInputFiles', { files, backendNodeId: m.params.backendNodeId }).then(() => { p.chooserDone = true; }); }
    if (m.method === 'Page.javascriptDialogOpening') p.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  });
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: init });
  await p.send('Page.navigate', { url });
  await p.waitFor('window.BTT_SHARE && window.BTT_SHARE.ready', 15000);
  return p;
}
const T = (p, id) => p.eval(`(document.querySelector('[data-testid="${id}"]') || {}).textContent || ''`);
const has = (p, id) => p.eval(`!!document.querySelector('[data-testid="${id}"]')`);
const setVal = (p, sel, v, i = 0) => p.eval(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
async function choose(p, selector, files) { p.nextFiles = files; p.chooserDone = false; await p.click(selector); const t0 = Date.now(); while (!p.chooserDone && Date.now() - t0 < 8000) await sleep(50); }
async function waitDownload(before, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const now = readdirSync(DL).filter((f) => !before.includes(f) && !f.endsWith('.crdownload')); if (now.length) { await sleep(200); return join(DL, now[0]); } await sleep(100); }
  return null;
}
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
function readSubmission(id) {
  const dir = join(UP, id), manifest = JSON.parse(readFileSync(join(dir, 'submission.json'), 'utf8'));
  const files = {};
  for (const f of manifest.files) files[f.name] = f.parts ? Buffer.concat(f.parts.map((p) => readFileSync(join(dir, p)))) : readFileSync(join(dir, f.name));
  return { dir, manifest, files };
}

let submissionId = null;
try {
  /* ---------- 1. Before you start ---------- */
  let p = await sharePage(FAKE_MEDIA + FAKE_SR('downloadable'));
  check('opens over http with no errors', p.errors.length === 0, p.errors.join('\n'));
  check('settings come from data/stories.json (settings.share)', await p.eval('BTT_SHARE.settings.enabled === true && BTT_SHARE.settings.chunkMB === 0.25'));
  await p.waitFor('BTT_SHARE.engine !== "unknown"');
  check('checks: secure page, camera, video format (MP4 preferred)', await p.eval('[...document.querySelectorAll("[data-testid=checks] .check-row")].slice(0, 3).every((r) => r.dataset.state === "ok")') && (await T(p, 'checks')).includes('Records as MP4'));
  check('checks: a speech pack that is not installed offers "Set up transcription" (download allowed)', await has(p, 'speech-install') && (await T(p, 'engine-text')).includes('one-time setup'));
  await p.click('[data-testid="speech-install"]');
  await p.waitFor('BTT_SHARE.engine === "available"');
  check('"Set up transcription" installs on click, then reports ready', (await p.eval('__srCalls')).includes('install') && (await T(p, 'engine-text')).startsWith('Ready.'));
  check('availability is always asked for on-device mode', (await p.eval('__srCalls')).filter((c) => c.startsWith('available')).every((c) => c === 'available:true'));
  await p.click('[data-testid="test-send"]');
  await p.waitFor('document.querySelector("[data-testid=test-send-result]").textContent.includes("HTTP") || document.querySelector("[data-testid=test-send-result]").textContent.includes("couldn")');
  check('"Test sending": uploads work and what was sent can\'t be read back', (await T(p, 'test-send-result')).includes('Sending works (HTTP 201)') && (await T(p, 'test-send-result')).includes('can\'t be read back'), await T(p, 'test-send-result'));
  check('"Test sending" wrote one synthetic note under submissions/_check/', existsSync(join(UP, '_check')) && readdirSync(join(UP, '_check')).length === 1 && readFileSync(join(UP, '_check', readdirSync(join(UP, '_check'))[0]), 'utf8').includes('Synthetic text only'));
  mock.config.readable = true;
  await p.click('[data-testid="test-send"]');
  await p.waitFor('document.querySelector("[data-testid=test-send-result]").textContent.includes("anyone who can open")');
  check('"Test sending" warns when the submissions folder is publicly readable', true);
  mock.config.readable = false;

  /* ---------- 2. Record ---------- */
  await p.click('[data-testid="go-record"]');
  check('record: the camera is off until "Turn on camera" is clicked', await has(p, 'cam-on') && !(await p.eval('!!document.querySelector("video.live")')));
  check('record: the first question card is shown', (await T(p, 'prompt-text')).startsWith('Say your name'));
  await p.click('[data-testid="cam-on"]');
  await p.waitFor('document.querySelector("[data-testid=rec-start]")');
  check('record: live preview with a start button', await p.eval('!!document.querySelector("video.live") && document.querySelector("video.live").srcObject instanceof MediaStream'));
  await p.click('[data-testid="rec-start"]');
  await p.waitFor('document.querySelector("[data-testid=rec-stop]")', 6000);
  await sleep(1500);
  check('record: recording shows a timer and live words (from the on-device engine, via the microphone track)', (await T(p, 'rec-time')).includes('/ 02:00') && (await p.eval('__srCalls')).includes('start:track:true'));
  await sleep(6500);
  check('record: live words appear while talking', (await T(p, 'live-words')).length > 5, await T(p, 'live-words'));
  await p.click('[data-testid="rec-stop"]');
  await p.waitFor('document.querySelector("[data-testid=review-video]")', 10000);
  const vinfo = await p.eval('({ type: BTT_SHARE.state.video.type, size: BTT_SHARE.state.video.size, dur: BTT_SHARE.state.video.duration, segs: BTT_SHARE.state.segments.length })');
  check('record: an MP4 recording of about 8 seconds', vinfo.type === 'video/mp4' && vinfo.size > 10000 && vinfo.dur > 7 && vinfo.dur < 12, JSON.stringify(vinfo));
  check('record: the camera turns off after recording', await p.eval('!document.querySelector("video.live")'));
  check('record: the transcript has every phrase, including the last one still being spoken', vinfo.segs >= 4 && (await p.eval('BTT_SHARE.state.segments.map((s) => s.text).join(" ")')).includes('Outside work I coach youth soccer'), await p.eval('JSON.stringify(BTT_SHARE.state.segments)'));
  check('record: phrases get a capital letter and a full stop, with rising times', await p.eval('BTT_SHARE.state.segments.every((s, i, a) => /^[A-Z]/.test(s.text) || i > 0) && BTT_SHARE.state.segments[0].text === "Hi I\'m Jordan sample." && BTT_SHARE.state.segments.every((s, i, a) => s.end > s.start && (!i || s.start >= a[i - 1].start))'), await p.eval('JSON.stringify(BTT_SHARE.state.segments)'));
  await p.click('[data-testid="rec-use"]');

  /* ---------- 3. Your words ---------- */
  await p.waitFor('document.querySelectorAll("[data-testid=seg-text]").length >= 4');
  await setVal(p, '[data-testid=seg-text]', "Hi I'm Jordan Sample.", 0);
  check('words: segments are editable, and an edit is recorded', await p.eval('BTT_SHARE.state.edited === true'));
  await p.click('[data-testid="words-next"]');

  /* ---------- 4. About you ---------- */
  await p.waitFor('document.querySelector("[data-testid=in-name]")');
  check('about: name filled in from the (corrected) self-introduction', await p.eval('document.querySelector("[data-testid=in-name]").value') === 'Jordan Sample');
  check('about: headline suggestions from their own words', await p.eval('document.querySelectorAll("[data-testid^=opt-headline-]").length') >= 2);
  check('about: description suggestions use their name', await p.eval('[...document.querySelectorAll("[data-field=description] .choice-text")].some((x) => x.textContent.includes("Jordan"))'));
  check('about: verbatim quote suggestions with times', await p.eval('document.querySelectorAll("[data-testid^=opt-quote-]").length') >= 1);
  await p.click('[data-testid="about-next"]');
  await sleep(200);
  check('about: required fields are checked (job title, manager, headline, description)', (await T(p, 'errsum')).includes('Job title is required') && (await T(p, 'errsum')).includes('A headline is required') && (await T(p, 'errsum')).includes('manager'), await T(p, 'errsum'));
  await p.type('[data-testid="in-role"]', 'Data Quality Lead');
  await p.type('[data-testid="in-managerName"]', 'Morgan Fixture');
  await p.click('[data-testid="opt-headline-0"]');
  await p.click('[data-testid="opt-description-0"]');
  await p.click('[data-testid="own-quote"]');
  await p.type('[data-testid="in-quote-own"]', 'words I never said');
  check('about: a quote that isn\'t in the transcript is flagged', (await T(p, 'quote-check')).includes('aren\'t in your transcript'));
  await p.click('[data-testid="opt-quote-0"]');
  await p.click('[data-testid="tag"]');
  await p.waitFor('BTT_SHARE.state.thumb && document.querySelector("[data-testid=thumb-img]").naturalWidth > 0', 10000);
  check('about: a thumbnail is captured from the video automatically', await p.eval('BTT_SHARE.state.thumb.blob.type === "image/jpeg" && BTT_SHARE.state.thumb.blob.size > 1000'));
  check('about: team is optional', !(await T(p, 'errsum')).includes('Team'));
  await p.click('[data-testid="about-next"]');

  /* ---------- 5. Send ---------- */
  await p.waitFor('document.querySelector("[data-testid=send]")');
  check('send: preview card and summary', (await p.eval('document.querySelector(".preview-card .card-meta").textContent')) === 'Jordan Sample · Data Quality Lead' && (await p.eval('document.querySelector(".summary").textContent')).includes('Morgan Fixture'));
  check('send: Send is disabled until the agreement is ticked', await p.eval('document.querySelector("[data-testid=send]").disabled'));
  await p.click('[data-testid="consent"]');
  check('send: the consent text comes from the builder settings', (await p.eval('document.querySelector(".consent").textContent')).includes('synthetic test terms'));
  const t0 = Date.now();
  await p.click('[data-testid="send"]');
  await p.waitFor('document.querySelector("[data-testid=done]")', 30000);
  submissionId = await T(p, 'ref');
  check('send: success screen with a reference ID', /^\d{8}-\d{6}-[0-9a-f]{6}$/.test(submissionId), submissionId);
  const puts = mock.log.filter((e) => e.method === 'PUT' && e.at >= t0 && e.path.includes(submissionId));
  check('send: everything was PUT under submissions/<id>/, with submission.json last', puts.length > 3 && puts.every((e) => e.status === 201) && puts[puts.length - 1].path.endsWith('/submission.json'), puts.map((e) => e.path.split('/').pop()).join(' '));
  check('send: the video was split into parts no bigger than the chunk size (0.25 MB)', puts.filter((e) => /video\.mp4\.part\d{3}$/.test(e.path)).length >= 2 && puts.every((e) => e.size <= 0.25 * 1024 * 1024 + 1));
  const sub = readSubmission(submissionId);
  const m = sub.manifest;
  check('package: submission.json format, person and story', m.format === 'btt-submission' && m.version === 1 && m.id === submissionId && m.person.name === 'Jordan Sample' && m.person.role === 'Data Quality Lead' && m.person.managerName === 'Morgan Fixture' && m.person.teamName === null && m.story.headline && m.story.description && m.story.quote && m.story.tags.length === 1, JSON.stringify(m.person));
  check('package: consent text and time are recorded', m.consent.text === SHARE.consentText && !isNaN(Date.parse(m.consent.agreedAt)));
  check('package: transcript engine and the edit are recorded', m.transcript.engine === 'chrome-on-device' && m.transcript.edited === true);
  check('package: every file (re-joined from its parts) matches its size and SHA-256', m.files.every((f) => sub.files[f.name].length === f.size && sha(sub.files[f.name]) === f.sha256), m.files.map((f) => f.name).join(','));
  check('package: video, transcript, captions and thumbnail', ['video.mp4', 'transcript.txt', 'captions.vtt', 'thumbnail.jpg'].every((n) => sub.files[n]) && sub.files['thumbnail.jpg'][0] === 0xFF && sub.files['thumbnail.jpg'][1] === 0xD8);
  const tx = sub.files['transcript.txt'].toString('utf8');
  check('package: the transcript is WebVTT with the employee\'s name as the speaker', tx.startsWith('WEBVTT') && tx.includes('<v Jordan Sample>Hi I\'m Jordan Sample.') && tx.includes('-->'), tx.slice(0, 200));
  check('package: the quote is verbatim from the transcript', tx.replace(/\s+/g, ' ').includes(m.story.quote.split(' ').slice(0, 4).join(' ')));

  /* ---------- the uploaded video plays and seeks when served by the website ---------- */
  mkdirSync(join(SITE, 'media-check'), { recursive: true });
  writeFileSync(join(SITE, 'media-check', 'video.mp4'), sub.files['video.mp4']);
  const play = await p.eval(`new Promise((res) => {
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; document.body.append(v);
    const out = {}; const t = setTimeout(() => res(Object.assign(out, { timeout: true })), 12000);
    v.addEventListener('loadedmetadata', () => { out.duration = v.duration; out.w = v.videoWidth; const target = isFinite(v.duration) ? v.duration / 2 : 3; v.addEventListener('seeked', () => { out.seekedTo = v.currentTime; clearTimeout(t); res(out); }, { once: true }); v.currentTime = target; });
    v.addEventListener('error', () => { clearTimeout(t); res({ error: v.error && v.error.code }); });
    v.src = 'media-check/video.mp4';
  })`);
  check('the recorded MP4 reports its length and seeks when served over http (byte ranges)', isFinite(play.duration) && play.duration > 7 && play.seekedTo > 2 && play.w === 640, JSON.stringify(play));
  check('no requests to any other site', foreign.length === 0, foreign.join(' '));
  check('nothing was stored in the browser (no localStorage, sessionStorage or IndexedDB)', await p.eval('localStorage.length === 0 && sessionStorage.length === 0 && indexedDB.databases().then((d) => d.length === 0)'));
  check('no console errors during the whole flow', p.errors.length === 0, p.errors.join('\n'));
  await p.send('Page.close').catch(() => {});

  /* ---------- upload a file, type the words, and the server refuses (405) ---------- */
  p = await sharePage(FAKE_MEDIA + FAKE_SR('unavailable'));
  check('no on-device speech: the check says to type instead', (await T(p, 'engine-text')).includes('type or paste'));
  const vidFile = join(DL, 'synthetic-upload.mp4'); writeFileSync(vidFile, sub.files['video.mp4']);
  await p.click('[data-testid="go-record"]');
  await choose(p, '[data-testid="pick-file"]', [vidFile]);
  await p.waitFor('document.querySelector("[data-testid=review-video]")', 10000);
  check('upload: a video file can be used instead of recording', (await T(p, 'video-info')).includes('synthetic-upload.mp4') && await p.eval('BTT_SHARE.state.video.source === "file" && BTT_SHARE.state.video.duration > 7'), await T(p, 'video-info'));
  await p.click('[data-testid="rec-use"]');
  await p.waitFor('document.querySelector("[data-testid=typed-transcript]")');
  check('words: without speech recognition the person can type or paste', !(await has(p, 'transcribe-file')));
  await setVal(p, '[data-testid=typed-transcript]', 'My name is Riley Placeholder. <img src=x onerror="window.__xss=1"> I support the mobile app team and I am proud of the accessibility review we started last spring.');
  await p.click('[data-testid="words-next"]');
  await p.waitFor('document.querySelector("[data-testid=in-name]")');
  check('typed words: name found, suggestions offered, and HTML in the words stays text', await p.eval('document.querySelector("[data-testid=in-name]").value') === 'Riley Placeholder' && await p.eval('!window.__xss && ![...document.images].some((i) => i.getAttribute("src") === "x")'));
  await p.type('[data-testid="in-role"]', 'Accessibility Analyst');
  await p.type('[data-testid="in-managerName"]', 'Avery Example');
  await p.click('[data-testid="own-headline"]');
  await p.type('[data-testid="in-headline-own"]', 'Making the app work for everyone');
  await p.click('[data-testid="own-description"]');
  await p.type('[data-testid="in-description-own"]', 'Riley talks about the accessibility review.');
  await p.waitFor('BTT_SHARE.state.thumb', 10000);
  await p.click('[data-testid="about-next"]');
  await p.waitFor('document.querySelector("[data-testid=send]")');
  await p.click('[data-testid="consent"]');
  mock.config.fail = { status: 405, match: /PUT/ };
  await p.click('[data-testid="send"]');
  await p.waitFor('document.querySelector("[data-testid=send-error]")', 15000);
  check('server refuses (405): a plain explanation, and the recording is kept', (await T(p, 'send-error')).includes('doesn\'t accept uploads') && (await T(p, 'send-error')).includes('405') && await p.eval('!!BTT_SHARE.state.video && BTT_SHARE.state.step === "send"'), await T(p, 'send-error'));
  check('after a failure, "Download a copy" becomes the main button', await p.eval('document.querySelector("[data-testid=download-copy]").classList.contains("btn-primary") && document.querySelector("[data-testid=send]").textContent === "Try again"'));
  const before = readdirSync(DL);
  await p.click('[data-testid="download-copy"]');
  const zipPath = await waitDownload(before);
  const listing = zipPath ? execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' }) : '';
  const copyId = await p.eval('BTT_SHARE.state.subId');
  check('the downloaded copy is a zip of the same submission folder', !!zipPath && ['video.mp4', 'transcript.txt', 'thumbnail.jpg', 'submission.json'].every((n) => listing.includes(copyId + '/' + n)) && !listing.includes('captions.vtt'), listing);
  if (zipPath) { const unz = mkdtempSync(join(tmpdir(), 'btt-share-unz-')); execFileSync('unzip', ['-q', zipPath, '-d', unz]); const mm = JSON.parse(readFileSync(join(unz, copyId, 'submission.json'), 'utf8')); check('the copy\'s submission.json has no parts, and the files match their hashes', mm.files.every((f) => !f.parts && sha(readFileSync(join(unz, copyId, f.name))) === f.sha256) && mm.transcript.engine === 'typed'); copyFileSync(zipPath, join(DL, 'copy-for-builder.zip')); }
  mock.config.fail = { status: 500, once: true };
  await p.click('[data-testid="send"]');
  await p.waitFor('document.querySelector("[data-testid=done]")', 30000);
  check('"Try again" after a passing server error (500 once, retried automatically) sends it', existsSync(join(UP, copyId, 'submission.json')));
  await p.send('Page.close').catch(() => {});

  /* ---------- the cloud-speech guard ---------- */
  p = await sharePage(FAKE_MEDIA + OLD_SR);
  check('guard: recognition without on-device mode is reported as unsupported', await p.eval('BTT_SHARE.engine') === 'unsupported' && (await T(p, 'engine-text')).includes('can\'t transcribe on the computer'));
  check('guard: start() can\'t be reached, so audio is never sent to a cloud service', await p.eval('(() => { try { BTT_TRANSCRIBE.start({ lang: "en-US" }); return false; } catch (e) { return true; } })()') && (await p.eval('__srCalls')).length === 0);
  await p.send('Page.close').catch(() => {});

  /* ---------- POST mode ---------- */
  mock.config.overrides['/data/stories.json'] = { type: 'application/json', body: storiesDoc(Object.assign({}, SHARE, { method: 'post' })) };
  p = await sharePage(FAKE_MEDIA + FAKE_SR('available'));
  await p.click('[data-testid="test-send"]');
  await p.waitFor('document.querySelector("[data-testid=test-send-result]").textContent.includes("HTTP")');
  const post = mock.log.filter((e) => e.method === 'POST').pop();
  check('POST mode: "Test sending" posts a multipart form (submissionId, path, part, parts, file)', (await T(p, 'test-send-result')).includes('Sending works (HTTP 201)') && post && post.fields.submissionId === '_check' && /^check-[0-9a-f]+\.txt$/.test(post.fields.path) && post.fields.part === '1' && post.fields.parts === '1');
  delete mock.config.overrides['/data/stories.json'];
  await p.send('Page.close').catch(() => {});

  /* ---------- switched off ---------- */
  mock.config.overrides['/data/stories.json'] = { type: 'application/json', body: storiesDoc(Object.assign({}, SHARE, { enabled: false })) };
  p = await sharePage(FAKE_MEDIA + FAKE_SR('available'));
  check('when sharing is switched off, the page says so and offers nothing to record', (await p.eval('document.body.textContent')).includes('Sharing isn\'t open right now') && !(await has(p, 'go-record')));
  delete mock.config.overrides['/data/stories.json'];
  await p.send('Page.close').catch(() => {});

  /* ---------- phone width ---------- */
  p = await openPage(browser, null, { width: 390, height: 844 });
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE_MEDIA + FAKE_SR('available') });
  await p.send('Page.navigate', { url: BASE });
  await p.waitFor('window.BTT_SHARE && window.BTT_SHARE.ready', 15000);
  check('phone width: no horizontal scrolling', await p.eval('document.documentElement.scrollWidth <= innerWidth'));
  await p.send('Page.close').catch(() => {});

  /* ---------- the Content Builder imports what was sent ---------- */
  const SUBS = join(mkdtempSync(join(tmpdir(), 'btt-share-subs-')), 'submissions');
  cpSync(UP, SUBS, { recursive: true }); // as if copied from Syndicate's submissions folder (includes the _check notes)
  mkdirSync(join(SUBS, '20261116-120000-abcdef')); writeFileSync(join(SUBS, '20261116-120000-abcdef', 'video.mp4.part001'), 'an upload that never finished');
  const bp = await openPage(browser, null, { downloadPath: DL });
  await bp.send('Page.setInterceptFileChooserDialog', { enabled: true });
  browser.on((m) => { if (m.sessionId === bp.sessionId && m.method === 'Page.fileChooserOpened' && bp.nextFiles) { const files = bp.nextFiles; bp.nextFiles = null; bp.send('DOM.setFileInputFiles', { files, backendNodeId: m.params.backendNodeId }).then(() => { bp.chooserDone = true; }); } });
  await bp.goto(`file://${join(ROOT, 'builder', 'builder.html')}#/import`);
  const B = (x) => `window.BTT.store.${x}`;
  // 1. The downloaded .zip copy (the upload that was refused with 405, sent later)
  await choose(bp, '[data-testid="import-submission-zip"]', [join(DL, 'copy-for-builder.zip')]);
  await bp.waitFor(B('stories.length === 1') + ' && ' + B('media.get("story-0001") && window.BTT.store.media.get("story-0001").thumbnail'), 20000);
  const z = await bp.eval(`(() => { const s = ${B('get("story-0001")')}, m = ${B('media.get("story-0001")')}; return { name: s.name, role: s.role, headline: s.headline, status: s.status, sub: s.submission && s.submission.id, engine: s.submission && s.submission.transcript.engine, video: s.video, duration: s.duration, thumb: m.thumbnail && m.thumbnail.source, captions: s.captions, src: s.fieldSources }; })()`);
  check('builder: a downloaded .zip copy imports as a story (typed transcript, no captions)', z.name === 'Riley Placeholder' && z.role === 'Accessibility Analyst' && z.headline === 'Making the app work for everyone' && z.sub === copyId && z.engine === 'typed' && z.video === 'stories/story-0001/video.mp4' && z.duration > 7 && z.thumb === 'file' && !z.captions, JSON.stringify(z));
  // 2. The whole submissions folder: Jordan's recording, Riley again, the _check notes and an unfinished upload
  await bp.eval('location.hash = "#/import"'); await sleep(300);
  await choose(bp, '[data-testid="import-submissions"]', [SUBS]);
  await bp.waitFor(B('stories.length === 2') + ' && ' + B('media.get("story-0002") && window.BTT.store.media.get("story-0002").captions'), 20000);
  await bp.waitFor('document.querySelectorAll("[data-testid=import-log] .list-row").length >= 4', 10000);
  const j = await bp.eval(`(() => { const st = window.BTT.store, s = st.get('story-0002'), m = st.media.get('story-0002'); return { name: s.name, role: s.role, manager: st.personName(s.managerId), managerIsManager: !!(st.person(s.managerId) || {}).isManager, team: s.teamId, headline: s.headline, description: s.description, quote: s.quote, quoteStart: s.quoteStart, tags: s.tags, status: s.status, src: s.fieldSources, sub: s.submission, video: s.video, type: m.video.file.type, duration: s.duration, thumb: m.thumbnail.source, thumbTime: m.thumbnail.time, cues: m.captions.check.cues, speaker: st.transcripts.get('story-0002').employeeSpeaker }; })()`);
  check('builder: the uploaded folder becomes a story with the employee\'s own details', j.name === 'Jordan Sample' && j.role === 'Data Quality Lead' && j.manager === 'Morgan Fixture' && j.managerIsManager && j.team === null && j.headline === m.story.headline && j.description === m.story.description, JSON.stringify(j));
  check('builder: details are marked "From the employee"', ['name', 'role', 'manager', 'headline', 'description', 'quote', 'tags'].every((k) => j.src[k] === 'submitted'), JSON.stringify(j.src));
  check('builder: the quote is verified against the transcript and timed', j.quote === m.story.quote && typeof j.quoteStart === 'number');
  check('builder: the video (joined from its parts), thumbnail and captions are attached', j.video === 'stories/story-0002/video.mp4' && j.type === 'video/mp4' && j.duration > 7 && j.thumb === 'file' && j.cues >= 4, JSON.stringify(j));
  check('builder: the transcript speaker is the employee', j.speaker === 'Jordan Sample');
  check('builder: a complete submission is Ready for review, with the consent record kept', j.status === 'review' && j.sub.id === submissionId && j.sub.consent.text === SHARE.consentText && j.sub.transcript.edited === true);
  const logText = await bp.eval('document.querySelector("[data-testid=import-log]").textContent');
  check('builder: the same submission is never imported twice (Riley again → Duplicate)', logText.includes('Already imported as story-0001'), logText.slice(0, 600));
  check('builder: an unfinished upload is listed as Incomplete and skipped', logText.includes('Incomplete') && logText.includes('upload hasn\'t finished'));
  check('builder: "Test sending" notes are ignored, not imported as transcripts', await bp.eval(B('stories.length')) === 2 && !logText.includes('check-'));
  await bp.eval('location.hash = "#/story/story-0002"'); await sleep(400);
  check('builder: the story shows it was sent by the employee', (await bp.eval('(document.querySelector("[data-testid=submission-banner]") || {}).textContent || ""')).includes('Sent by the employee') && (await bp.eval('document.body.textContent')).includes('From the employee · review'));
  // 3. Share settings on the Release page
  await bp.eval('location.hash = "#/release"'); await sleep(400);
  check('builder: share settings start switched off', await bp.eval('!document.querySelector("[data-testid=share-enabled]").checked'));
  await bp.click('[data-testid="share-enabled"]'); await sleep(300);
  await bp.type('[data-testid="share-url"]', 'http://insecure.example.test/'); await bp.eval('document.querySelector("[data-testid=share-url]").dispatchEvent(new Event("change"))');
  check('builder: an http:// upload address is refused', (await bp.eval('document.querySelector("[data-testid=share-url-error]").textContent')).includes('https'));
  await bp.type('[data-testid="share-url"]', 'submissions/'); await bp.eval('document.querySelector("[data-testid=share-url]").dispatchEvent(new Event("change"))');
  check('builder: switching sharing on saves it in stories.json', await bp.eval('JSON.parse(window.BTT.store.serialize("stories")).settings.share.enabled === true && JSON.parse(window.BTT.store.serialize("stories")).settings.share.uploadUrl === "submissions/"'));
  check('builder: no console errors while importing submissions', bp.errors.length === 0, bp.errors.join('\n'));
} catch (e) {
  check('share E2E ran without crashing', false, e.stack);
} finally {
  await browser.close();
  await mock.close();
}
export const SHARE_UPLOADS = UP;
console.log(`\nSHARE E2E ${failed ? 'FAIL' : 'PASS'} ${passed}/${passed + failed}`);
if (process.env.BTT_KEEP_UPLOADS) console.log('Uploads kept in ' + UP);
else rmSync(UP, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
