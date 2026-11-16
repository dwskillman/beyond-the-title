#!/usr/bin/env node
// Optional dev-machine check of REAL on-device speech recognition, through the share page's own
// js/transcribe.js. Not part of the regular suite: Chrome downloads its speech pack (from Google) the first
// time, so it needs internet access on this dev machine. Synthetic speech only (macOS `say`).
//   node tests/speech-check.mjs
// Checks:
//   1. live mode (as while recording): the voice is fed as a microphone-like audio track;
//   2. file mode (an uploaded video): a recorded MP4 with the voice is played silently into the recogniser.
import { launch, openPage } from './cdp.mjs';
import { startMock } from './mock-syndicate.mjs';
import { makePreview } from './make-site-preview.mjs';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let passed = 0, failed = 0;
function check(name, cond, detail = '') { cond ? passed++ : failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? '\n     ' + detail : ''}`); }

const SITE = makePreview(mkdtempSync(join(tmpdir(), 'btt-speech-site-')));
const d = JSON.parse(readFileSync(join(SITE, 'data', 'stories.json'), 'utf8')); d.settings = { share: { enabled: true } };
writeFileSync(join(SITE, 'data', 'stories.json'), JSON.stringify(d));
const WORK = mkdtempSync(join(tmpdir(), 'btt-speech-'));
const LINES = 'Hi, my name is Jordan Sample. [[slnc 900]] I lead the data quality group. [[slnc 1100]] The thing I am proudest of is the mentoring circle we started for new analysts.';
execFileSync('say', ['-o', join(WORK, 'voice.aiff'), LINES]);
execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', join(WORK, 'voice.aiff'), join(SITE, 'voice.wav')]);
const mock = await startMock({ root: SITE, uploadDir: WORK });
const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const EXPECT = ['jordan', 'data quality', 'mentoring', 'analysts'];
try {
  const p = await openPage(browser, null);
  await p.send('Page.navigate', { url: mock.url + '/share.html' });
  await p.waitFor('window.BTT_SHARE && window.BTT_SHARE.ready', 15000);
  let status = await p.eval('BTT_TRANSCRIBE.status("en-US")');
  console.log('on-device status before setup:', status);
  if (status === 'downloadable') {
    console.log('installing the speech pack (Chrome downloads it from Google)…');
    await p.eval('BTT_TRANSCRIBE.install("en-US")', { userGesture: true });
    for (let i = 0; i < 40 && status !== 'available'; i++) { await new Promise((r) => setTimeout(r, 3000)); status = await p.eval('BTT_TRANSCRIBE.status("en-US")'); }
  }
  check('on-device speech recognition is available after setup', status === 'available', 'status: ' + status);
  if (status === 'available') {
    const live = await p.eval(`(async () => {
      const ac = new AudioContext(); await ac.resume();
      const buf = await ac.decodeAudioData(await (await fetch('voice.wav')).arrayBuffer());
      const dest = ac.createMediaStreamDestination(), src = ac.createBufferSource(); src.buffer = buf; src.connect(dest);
      const session = BTT_TRANSCRIBE.start({ lang: 'en-US', track: dest.stream.getAudioTracks()[0] });
      src.start(); await new Promise((r) => { src.onended = r; }); await new Promise((r) => setTimeout(r, 1500));
      return session.stop();
    })()`, { userGesture: true });
    const liveText = live.map((s) => s.text).join(' ');
    check('live mode: the synthetic voice is transcribed on the computer', EXPECT.every((w) => liveText.toLowerCase().includes(w)), liveText);
    check('live mode: timed segments in order', live.length >= 2 && live.every((s, i) => s.end > s.start && (!i || s.start >= live[i - 1].start)), JSON.stringify(live));
    const file = await p.eval(`(async () => {
      // Record a short MP4 (a still picture plus the voice), like a video an employee uploads.
      const ac = new AudioContext(); await ac.resume();
      const buf = await ac.decodeAudioData(await (await fetch('voice.wav')).arrayBuffer());
      const dest = ac.createMediaStreamDestination(), src = ac.createBufferSource(); src.buffer = buf; src.connect(dest);
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const g = cv.getContext('2d'); let f = 0;
      const iv = setInterval(() => { g.fillStyle = '#5A0EEA'; g.fillRect(0, 0, 320, 180); g.fillStyle = '#fff'; g.fillText('synthetic ' + f++, 20, 90); }, 40);
      const rec = new MediaRecorder(new MediaStream([...cv.captureStream(25).getVideoTracks(), ...dest.stream.getAudioTracks()]), { mimeType: 'video/mp4' });
      const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((r) => { rec.onstop = r; });
      rec.start(500); src.start(); await new Promise((r) => { src.onended = r; }); await new Promise((r) => setTimeout(r, 500)); rec.stop(); await done; clearInterval(iv);
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const job = BTT_TRANSCRIBE.transcribeMedia(blob, { lang: 'en-US' });
      const segs = await job.promise;
      return { size: blob.size, segs };
    })()`, { userGesture: true });
    const fileText = file.segs.map((s) => s.text).join(' ');
    check('file mode: an uploaded MP4 is transcribed by playing it silently into the recogniser', EXPECT.every((w) => fileText.toLowerCase().includes(w)), fileText);
  }
  check('no console errors', p.errors.length === 0, p.errors.join('\n'));
} catch (e) {
  check('speech check ran without crashing', false, e.stack);
} finally { await browser.close(); await mock.close(); }
console.log(`\nSPEECH CHECK ${failed ? 'FAIL' : 'PASS'} ${passed}/${passed + failed}`);
process.exit(failed ? 1 : 0);
