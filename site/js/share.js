/* Beyond the Title: "Share your story" page.
   An employee records (or uploads) a short video, checks the words that were transcribed on their own computer,
   adds their details, picks a headline, description and quote from suggestions made from their own words, and
   sends it to the Beyond the Title team.

   Privacy and safety:
   - Everything stays in this tab's memory until Send. Nothing is written to browser storage.
   - The camera and microphone are only requested after "Turn on camera" is clicked, and are switched off
     when the person leaves the recording step.
   - The only network requests are the uploads to the address set in the Content Builder (same site by
     default, enforced by the page's Content-Security-Policy), and the one-click "Test sending" check.
   - All text is rendered with DOM APIs (textContent), never as HTML. */
(function () {
  'use strict';
  var B = window.BTT_SITE, h = B.h, icon = B.icon, K = window.BTT_KIT, T = window.BTT_TRANSCRIBE;
  var root = document.getElementById('share-root');
  var live = document.getElementById('share-live');

  var DEFAULT_PROMPTS = [
    'Introduce yourself: your name, your job title and the team or group you work with.',
    'What does a typical day look like for you?',
    'Tell us about a project or a moment you\'re proud of.',
    'What\'s something people might not know about your work?'
  ];
  var DEFAULT_CONSENT = 'I agree that the Beyond the Title team may review this video, its transcript and the details I have entered, and, once approved, show them to colleagues on this site. I can ask for my story to be removed at any time.';
  var LIMITS = { name: 80, role: 120, managerName: 80, teamName: 80, project: 80, headline: 160, description: 600, quote: 400, typed: 60000, tags: 4, fileMB: 500 };
  var STEPS = [['start', 'Before you start'], ['record', 'Record'], ['words', 'Your words'], ['about', 'About you'], ['send', 'Review & send']];
  var VIDEO_EXT = /\.(mp4|m4v|mov|webm)$/i;

  var settings = null, engine = 'unknown', st = fresh(), ui = {};

  function fresh() {
    return {
      step: 'start', video: null, segments: [], edited: false, typed: '', engineUsed: 'none', ts: null,
      details: { name: '', role: '', managerName: '', teamName: '', project: '' }, namePrefilled: false,
      story: { headline: '', headlineSource: '', description: '', descriptionSource: '', quote: '', quoteStart: null, quoteSource: '', tags: [] },
      thumb: null, consent: false, subId: null, sent: {}, pkg: null, sending: false
    };
  }

  /* ---------------------------------------------------------------- helpers */
  function btn(label, o) {
    o = o || {};
    return h('button', { type: 'button', class: 'btn ' + (o.kind === 'primary' ? 'btn-primary' : o.kind === 'ghost' ? 'btn-ghost' : 'btn-secondary') + (o.size === 'sm' ? ' btn-sm' : ''), onclick: o.onclick, disabled: o.disabled, 'data-testid': o.testid, 'aria-describedby': o.describedby }, o.icon ? icon(o.icon) : null, label);
  }
  function say(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 30); }
  function clock(s) { return K.TextUtil.clock(s) || '00:00'; }
  function fmtBytes(n) { return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB'; }
  function hex(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
  function makeId() {
    var d = new Date(), p = function (x) { return String(x).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '-' + hex(3);
  }
  function wait(el, ok, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { done(); reject(new Error('timeout')); }, ms || 15000);
      function y() { done(); resolve(); } function n() { done(); reject(new Error('This video could not be read. MP4 (H.264) works best.')); }
      function done() { clearTimeout(t); el.removeEventListener(ok, y); el.removeEventListener('error', n); }
      el.addEventListener(ok, y); el.addEventListener('error', n);
    });
  }
  var urls = [];
  function objectUrl(blob) { var u = URL.createObjectURL(blob); urls.push(u); return u; }
  function field(label, input, o) {
    o = o || {};
    var id = 'f-' + o.key, hintId = id + '-hint', errId = id + '-err';
    input.id = id;
    if (o.hint) input.setAttribute('aria-describedby', hintId + ' ' + errId); else input.setAttribute('aria-describedby', errId);
    return h('div', { class: 'field', 'data-field': o.key },
      h('label', { for: id }, label, o.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : h('span', { class: 'opt' }, ' (optional)')),
      input,
      o.hint ? h('p', { class: 'hint', id: hintId }, o.hint) : null,
      h('p', { class: 'err', id: errId, role: 'alert' }));
  }
  function setErr(key, msg) {
    var f = root.querySelector('[data-field="' + key + '"]'); if (!f) return;
    f.classList.toggle('has-err', !!msg);
    var e = f.querySelector('.err'); if (e) e.textContent = msg || '';
    var inp = f.querySelector('input,textarea'); if (inp) inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function textInput(key, value, max, o) {
    o = o || {};
    var el = h(o.area ? 'textarea' : 'input', { class: 'input', maxlength: max, rows: o.rows || null, autocomplete: o.autocomplete || 'off', 'data-testid': 'in-' + key, placeholder: o.placeholder || null });
    el.value = value || '';
    el.addEventListener('input', function () { if (o.onInput) o.onInput(el.value); setErr(key, ''); });
    return el;
  }

  /* ---------------------------------------------------------------- settings */
  function normalize(s) {
    s = s && typeof s === 'object' ? s : {};
    var str = function (v, d, max) { return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : d; };
    var num = function (v, d, lo, hi) { return typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    var prompts = Array.isArray(s.prompts) ? s.prompts.filter(function (x) { return typeof x === 'string' && x.trim(); }).map(function (x) { return x.trim().slice(0, 240); }).slice(0, 12) : [];
    return {
      enabled: s.enabled === true,
      uploadUrl: str(s.uploadUrl, 'submissions/', 500),
      method: s.method === 'post' ? 'post' : 'put',
      chunkMB: num(s.chunkMB, 20, 0.05, 1000),
      maxMinutes: num(s.maxMinutes, 5, 1, 30),
      prompts: prompts.length ? prompts : DEFAULT_PROMPTS,
      consentText: str(s.consentText, DEFAULT_CONSENT, 1500),
      contact: str(s.contact, '', 300),
      allowSpeechDownload: s.allowSpeechDownload !== false,
      language: /^[a-z]{2,3}(-[A-Z]{2})?$/.test(s.language || '') ? s.language : 'en-US'
    };
  }

  /* ---------------------------------------------------------------- layout */
  function render() {
    stopCamera();
    var idx = STEPS.findIndex(function (x) { return x[0] === st.step; });
    var stepper = st.step === 'done' ? null : h('ol', { class: 'stepper', 'aria-label': 'Steps' }, STEPS.map(function (s, i) {
      return h('li', { class: i < idx ? 'is-done' : i === idx ? 'is-current' : '', 'aria-current': i === idx ? 'step' : null },
        h('span', { class: 'num', 'aria-hidden': 'true' }, i < idx ? icon('check') : String(i + 1)), h('span', { class: 'lbl' }, s[1]));
    }));
    var body = ({ start: viewStart, record: viewRecord, words: viewWords, about: viewAbout, send: viewSend, done: viewDone })[st.step]();
    root.replaceChildren.apply(root, [stepper].concat(body).filter(Boolean));
    var hd = root.querySelector('h1'); if (hd && render.count++) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: false }); }
    window.scrollTo(0, 0);
  }
  render.count = 0;
  function go(step) { st.step = step; render(); }
  function head(eyebrow, title, lede) { return h('div', { class: 'page-head share-head' }, h('div', null, h('p', { class: 'eyebrow' }, eyebrow), h('h1', null, title), lede ? h('p', null, lede) : null)); }
  function navRow(back, next) { return h('div', { class: 'share-nav' }, back || h('span'), next || null); }
  function startOver() {
    var row = h('div', { class: 'confirm-row', role: 'group', 'aria-label': 'Start over' },
      h('span', null, 'Start over? Your recording and everything you typed will be deleted.'),
      btn('Yes, start over', { size: 'sm', testid: 'start-over-yes', onclick: function () { reset(); } }),
      btn('Cancel', { size: 'sm', onclick: function () { row.remove(); } }));
    return h('div', { class: 'start-over' }, h('button', { type: 'button', class: 'linkish', 'data-testid': 'start-over', onclick: function (e) { e.currentTarget.parentNode.append(row); } }, 'Start over'));
  }
  function reset() { if (ui.mediaJob) ui.mediaJob.cancel(); urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = []; st = fresh(); render(); say('Started over.'); }

  /* ---------------------------------------------------------------- step 1: before you start */
  function pickMime() {
    if (!window.MediaRecorder) return null;
    return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(function (t) { return MediaRecorder.isTypeSupported(t); }) || '';
  }
  function canRecord() { return !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && pickMime() !== null); }
  function checkRow(state, title, text, extra) {
    return h('li', { class: 'check-row is-' + state, 'data-state': state },
      h('span', { class: 'check-ico', 'aria-hidden': 'true' }, icon(state === 'ok' ? 'checkCircle' : state === 'bad' ? 'alert' : 'clock')),
      h('div', null, h('p', { class: 'check-title' }, title, h('span', { class: 'sr-only' }, state === 'ok' ? ' (ready)' : state === 'bad' ? ' (problem)' : ' (check)')), h('p', { class: 'check-text' }, text), extra || null));
  }
  function engineText() {
    switch (engine) {
      case 'available': return ['ok', 'Ready. Your words are turned into text on this computer. The sound is never sent anywhere.'];
      case 'downloadable': return settings.allowSpeechDownload ? ['warn', 'Needs a one-time setup: Chrome downloads its speech pack from Google. Your recordings are still never sent anywhere.'] : ['warn', 'Not set up on this computer. You can type or paste your words instead.'];
      case 'downloading': return ['warn', 'Chrome is setting it up. This can take a minute.'];
      case 'unsupported': return ['warn', 'This version of Chrome can\'t transcribe on the computer itself. You can type or paste your words instead.'];
      case 'unknown': return ['warn', 'Checking…'];
      default: return ['warn', 'Not available on this computer. You can type or paste your words instead.'];
    }
  }
  function viewStart() {
    var mime = pickMime(), et = engineText();
    var setup = engine === 'downloadable' && settings.allowSpeechDownload ? btn('Set up transcription', { size: 'sm', testid: 'speech-install', onclick: installSpeech }) : null;
    var sendRow = location.protocol === 'file:'
      ? checkRow('warn', 'Sending', 'This copy of the page was opened from disk, so it can\'t send. Open it from the website, or download a copy at the end.')
      : checkRow('warn', 'Sending', 'Checks that the website accepts stories. It sends one short test note, never your video.', h('div', { class: 'row' }, btn('Test sending', { size: 'sm', testid: 'test-send', onclick: testSending }), h('span', { class: 'check-result', 'data-testid': 'test-send-result', role: 'status' })));
    return [
      head('Share your story', 'Tell colleagues about your work', 'Record a short video (one to three minutes is ideal), check the words, add your details and send it to the Beyond the Title team. Nothing leaves this computer until you press Send.'),
      h('div', { class: 'share-grid' },
        h('section', { class: 'panel', 'aria-labelledby': 'how-h' },
          h('h2', { id: 'how-h' }, 'How it works'),
          h('ol', { class: 'how' },
            h('li', null, h('strong', null, 'Record'), ' yourself with your computer\'s camera, or upload a video you already have.'),
            h('li', null, h('strong', null, 'Check your words.'), ' They\'re typed out on this computer while you talk. Fix anything it misheard.'),
            h('li', null, h('strong', null, 'Add your details'), ' and choose a headline and a quote from your own words.'),
            h('li', null, h('strong', null, 'Send it.'), ' The team reviews every story before it appears on the site.')),
          h('div', { class: 'row', style: { marginTop: '18px' } },
            btn('Start recording', { kind: 'primary', icon: 'video', testid: 'go-record', onclick: function () { go('record'); } }),
            btn('Upload a video instead', { icon: 'upload', testid: 'go-upload', onclick: function () { go('record'); setTimeout(function () { ui.fileInput && ui.fileInput.click(); }, 0); } }))),
        h('section', { class: 'panel', 'aria-labelledby': 'chk-h' },
          h('h2', { id: 'chk-h' }, 'Check this computer'),
          h('ul', { class: 'checks', 'data-testid': 'checks' },
            checkRow(window.isSecureContext ? 'ok' : 'bad', 'Secure page', window.isSecureContext ? 'Chrome allows the camera and microphone here.' : 'This page isn\'t on a secure (https) address, so Chrome won\'t allow the camera. You can still upload a video.'),
            checkRow(canRecord() ? 'ok' : 'bad', 'Camera and microphone', canRecord() ? 'Chrome will ask your permission when you turn the camera on.' : 'Recording isn\'t available in this browser. You can upload a video instead.'),
            checkRow(mime ? 'ok' : 'bad', 'Video format', mime ? 'Records as ' + (/mp4/.test(mime) ? 'MP4' : 'WebM') + ' at 720p.' : 'This browser can\'t record video.'),
            h('li', { class: 'check-row is-' + et[0], 'data-state': et[0], 'data-testid': 'engine-row' },
              h('span', { class: 'check-ico', 'aria-hidden': 'true' }, icon(et[0] === 'ok' ? 'checkCircle' : 'clock')),
              h('div', null, h('p', { class: 'check-title' }, 'Transcription on this computer'), h('p', { class: 'check-text', 'data-testid': 'engine-text' }, et[1]), setup)),
            sendRow)))
    ];
  }
  function installSpeech(e) {
    var b = e.currentTarget; b.disabled = true; engine = 'downloading'; refreshEngineRow();
    T.install(settings.language).then(function () { return pollEngine(20); });
  }
  function pollEngine(n) {
    return T.status(settings.language).then(function (s) {
      engine = s; refreshEngineRow();
      if ((s === 'downloading' || s === 'downloadable') && n > 0) return new Promise(function (r) { setTimeout(r, 3000); }).then(function () { return pollEngine(n - 1); });
    });
  }
  function refreshEngineRow() { if (st.step === 'start') render(); }

  /* "Test sending": one short synthetic text note, then a read-back to make sure the folder isn't public. */
  function testSending(e) {
    var b = e.currentTarget, out = root.querySelector('[data-testid="test-send-result"]');
    b.disabled = true; out.className = 'check-result'; out.textContent = 'Sending a test note…';
    var name = 'check-' + hex(4) + '.txt', blob = new Blob(['Beyond the Title upload test. Synthetic text only, safe to delete.\n'], { type: 'text/plain' });
    upload('_check', name, blob, 1, 1).then(function (res) {
      if (!res.ok) { out.className = 'check-result bad'; out.textContent = explain(res); return; }
      if (settings.method !== 'put') { out.className = 'check-result ok'; out.textContent = 'Sending works (HTTP ' + res.status + ').'; return; }
      return fetch(uploadUrl('_check', name), { cache: 'no-store', credentials: 'same-origin', redirect: 'manual' }).then(function (r) {
        return r.ok ? r.text().then(function (t) { return t.indexOf('Beyond the Title upload test') >= 0; }) : false;
      }).catch(function () { return false; }).then(function (readable) {
        out.className = 'check-result ' + (readable ? 'bad' : 'ok');
        out.textContent = readable
          ? 'Sending works, but anyone who can open this site can also read what was sent. Ask the site owner to block reading the submissions folder before collecting stories.'
          : 'Sending works (HTTP ' + res.status + '), and what\'s sent can\'t be read back from the site.';
      });
    }).catch(function (err) { out.className = 'check-result bad'; out.textContent = networkText(err); })
      .then(function () { b.disabled = false; say(out.textContent); });
  }

  /* ---------------------------------------------------------------- step 2: record */
  function stopCamera() {
    if (ui.levelRaf) cancelAnimationFrame(ui.levelRaf);
    if (ui.audioCtx) { ui.audioCtx.close().catch(function () {}); ui.audioCtx = null; }
    if (ui.stream) { ui.stream.getTracks().forEach(function (t) { t.stop(); }); ui.stream = null; }
    if (ui.recTimer) { clearInterval(ui.recTimer); ui.recTimer = null; }
    if (ui.maxTimer) { clearTimeout(ui.maxTimer); ui.maxTimer = null; }
    if (ui.session) { ui.session.abort(); ui.session = null; }
    if (ui.recorder && ui.recorder.state !== 'inactive') { ui.discard = true; try { ui.recorder.stop(); } catch (e) { /* stopped */ } }
  }
  function viewRecord() {
    ui.stage = h('div', { class: 'stage', 'data-testid': 'stage' });
    ui.prompt = 0;
    ui.fileInput = h('input', { type: 'file', accept: 'video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm', class: 'sr-only', tabIndex: -1, 'aria-hidden': 'true', 'data-testid': 'file-input' });
    ui.fileInput.addEventListener('change', function () { var f = ui.fileInput.files[0]; ui.fileInput.value = ''; if (f) useFile(f); });
    var promptBox = h('div', { class: 'prompt-card', 'aria-live': 'polite' });
    function showPrompt() {
      var ps = settings.prompts;
      promptBox.replaceChildren(h('p', { class: 'prompt-count' }, 'Question ' + (ui.prompt + 1) + ' of ' + ps.length), h('p', { class: 'prompt-text', 'data-testid': 'prompt-text' }, ps[ui.prompt]),
        h('div', { class: 'row' }, ui.prompt > 0 ? btn('Previous', { size: 'sm', onclick: function () { ui.prompt--; showPrompt(); } }) : null,
          ui.prompt < ps.length - 1 ? btn('Next question', { size: 'sm', testid: 'next-prompt', onclick: function () { ui.prompt++; showPrompt(); } }) : null));
    }
    showPrompt();
    if (st.video) showReview(); else showOff();
    return [
      head('Step 2', 'Record your story', 'Up to ' + K.TextUtil.plural(settings.maxMinutes, 'minute') + '. The question cards are only for you; they aren\'t recorded.'),
      h('div', { class: 'record-grid' },
        h('div', null, ui.stage,
          h('p', { class: 'small muted upload-line' }, 'Prefer to record on your phone or in another app? ', h('button', { type: 'button', class: 'linkish', 'data-testid': 'pick-file', onclick: function () { ui.fileInput.click(); } }, 'Upload a video file'), ' (MP4, MOV or WebM, up to ' + LIMITS.fileMB + ' MB).', ui.fileInput)),
        h('aside', { class: 'record-side' }, promptBox,
          h('div', { class: 'panel tips' }, h('h2', null, 'Tips'),
            h('ul', null, h('li', null, 'Face a window or a lamp, not away from it.'), h('li', null, 'Keep the camera at eye level and your head and shoulders in the frame.'), h('li', null, 'Start by saying your name and your job title.'), h('li', null, 'Speak in your own words. There\'s no script.'))))),
      navRow(btn('Back', { onclick: function () { go('start'); } }), h('div', { class: 'row' }, startOver(), btn('Use this video', { kind: 'primary', testid: 'rec-use', disabled: !st.video, onclick: function () { go('words'); } })))
    ];
  }
  function stageMsg(iconName, title, text, actions) {
    return h('div', { class: 'stage-msg' }, h('span', { class: 'stage-ico', 'aria-hidden': 'true' }, icon(iconName)), h('p', { class: 'stage-title' }, title), text ? h('p', { class: 'stage-text' }, text) : null, actions ? h('div', { class: 'row', style: { justifyContent: 'center' } }, actions) : null);
  }
  function setUseEnabled(on) { var b = root.querySelector('[data-testid="rec-use"]'); if (b) b.disabled = !on; }
  function showOff(errText) {
    stopCamera(); setUseEnabled(!!st.video);
    if (!canRecord()) { ui.stage.replaceChildren(stageMsg('alert', 'Recording isn\'t available here', window.isSecureContext ? 'This browser can\'t record from the camera. Upload a video instead.' : 'Chrome only allows the camera on secure (https) pages. Upload a video instead.', [btn('Upload a video file', { kind: 'primary', icon: 'upload', onclick: function () { ui.fileInput.click(); } })])); return; }
    ui.stage.replaceChildren(stageMsg('video', errText ? 'The camera didn\'t start' : 'Your camera is off', errText || 'Chrome will ask for permission to use your camera and microphone.', [btn('Turn on camera', { kind: 'primary', icon: 'video', testid: 'cam-on', onclick: cameraOn })]));
  }
  function cameraError(e) {
    var n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Camera or microphone access was blocked. Allow it with the camera icon in Chrome\'s address bar, or upload a video instead. If your organization blocks the camera, uploading is the way to go.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No camera or microphone was found.';
    if (n === 'NotReadableError') return 'The camera is being used by another app (for example a meeting). Close it and try again.';
    return 'Chrome couldn\'t start the camera (' + (n || 'unknown error') + ').';
  }
  function cameraOn() {
    ui.stage.replaceChildren(stageMsg('video', 'Starting the camera…', 'If Chrome asks, choose Allow.'));
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then(function (stream) {
        if (st.step !== 'record') { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        ui.stream = stream; showLive();
      }).catch(function (e) { showOff(cameraError(e)); });
  }
  function levelMeter() {
    var bar = h('span', { class: 'level-bar' }), wrap = h('span', { class: 'level', title: 'Microphone level', 'aria-hidden': 'true' }, icon('mic'), h('span', { class: 'level-track' }, bar));
    try {
      ui.audioCtx = new AudioContext(); ui.audioCtx.resume().catch(function () {}); var an = ui.audioCtx.createAnalyser(); an.fftSize = 512;
      ui.audioCtx.createMediaStreamSource(ui.stream).connect(an);
      var data = new Uint8Array(an.fftSize);
      (function tick() { an.getByteTimeDomainData(data); var m = 0; for (var i = 0; i < data.length; i++) m = Math.max(m, Math.abs(data[i] - 128)); bar.style.width = Math.min(100, m / 1.1) + '%'; ui.levelRaf = requestAnimationFrame(tick); })();
    } catch (e) { /* the meter is optional */ }
    return wrap;
  }
  function showLive() {
    var v = h('video', { class: 'live', muted: true, playsInline: true, 'aria-label': 'Camera preview' });
    v.srcObject = ui.stream; v.play().catch(function () {});
    var hint = engine === 'available' ? 'Your words are typed out as you speak, on this computer.' : 'Transcription isn\'t set up, so you\'ll type your words afterwards.';
    ui.stage.replaceChildren(v, h('div', { class: 'stage-bar' }, levelMeter(), h('span', { class: 'stage-note' }, hint), btn('Start recording', { kind: 'primary', testid: 'rec-start', onclick: countdown })));
  }
  function countdown() {
    var n = 3, o = h('div', { class: 'countdown', 'aria-live': 'assertive' }, String(n));
    ui.stage.querySelector('.stage-bar').replaceChildren(h('span', { class: 'stage-note' }, 'Get ready…'));
    ui.stage.append(o);
    var t = setInterval(function () { n--; if (n > 0) o.textContent = String(n); else { clearInterval(t); o.remove(); startRecording(); } }, 800);
  }
  function startRecording() {
    var mime = pickMime(), chunks = [];
    var rec;
    try { rec = new MediaRecorder(ui.stream, { mimeType: mime, videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 }); }
    catch (e) { showOff('This browser couldn\'t start recording (' + e.name + '). Upload a video instead.'); return; }
    ui.recorder = rec; ui.discard = false; ui.liveText = h('p', { class: 'live-words', 'data-testid': 'live-words', 'aria-hidden': 'true' });
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var t0 = performance.now(), max = settings.maxMinutes * 60;
    var timer = h('span', { class: 'rec-time', 'data-testid': 'rec-time' }, '00:00 / ' + clock(max));
    rec.onstop = function () {
      var secs = (performance.now() - t0) / 1000;
      clearInterval(ui.recTimer); ui.recTimer = null; clearTimeout(ui.maxTimer); ui.maxTimer = null;
      var session = ui.session; ui.session = null;
      if (ui.discard) { if (session) session.abort(); return; }
      var type = (rec.mimeType || mime || 'video/webm').split(';')[0];
      var blob = new Blob(chunks, { type: type });
      st.video = { blob: blob, type: type, ext: /mp4/.test(type) ? 'mp4' : 'webm', duration: Math.round(secs * 10) / 10, source: 'recorded', size: blob.size };
      st.segments = []; st.typed = ''; st.edited = false; st.thumb = null; st.ts = null; st.pkg = null;
      stopCamera();
      ui.stage.replaceChildren(stageMsg('clock', 'Finishing…', null));
      (session ? session.stop() : Promise.resolve([])).then(function (segs) { st.segments = segs; st.engineUsed = segs.length ? 'chrome-on-device' : 'none'; showReview(); say('Recording finished. ' + clock(st.video.duration) + ' long.'); });
    };
    rec.start(1000);
    if (engine === 'available') {
      try {
        ui.session = T.start({ lang: settings.language, track: ui.stream.getAudioTracks()[0],
          onUpdate: function (segs, interim) { var words = (segs.map(function (s) { return s.text; }).join(' ') + ' ' + interim).trim().split(/\s+/); ui.liveText.textContent = words.slice(-14).join(' '); },
          onError: function () { ui.liveText.textContent = 'Transcription stopped. You can type your words afterwards.'; } });
      } catch (e) { ui.session = null; }
    }
    ui.recTimer = setInterval(function () { timer.textContent = clock((performance.now() - t0) / 1000) + ' / ' + clock(max); }, 250);
    ui.maxTimer = setTimeout(function () { if (rec.state === 'recording') rec.stop(); say('The maximum length was reached, so recording stopped.'); }, max * 1000);
    ui.stage.querySelector('.stage-bar').replaceChildren(h('span', { class: 'rec-dot', 'aria-hidden': 'true' }), timer, ui.liveText, btn('Stop', { kind: 'primary', icon: 'stop', testid: 'rec-stop', onclick: function () { if (rec.state === 'recording') rec.stop(); } }));
    say('Recording.');
  }
  function showReview() {
    var v = h('video', { controls: true, playsInline: true, preload: 'metadata', 'data-testid': 'review-video', 'aria-label': 'Your video' });
    v.src = objectUrl(st.video.blob);
    var info = (st.video.source === 'file' ? st.video.name + ' · ' : '') + clock(st.video.duration) + ' · ' + fmtBytes(st.video.size);
    ui.stage.replaceChildren(v, h('div', { class: 'stage-bar' }, h('span', { class: 'stage-note', 'data-testid': 'video-info' }, info),
      btn(st.video.source === 'file' ? 'Choose another file' : 'Record again', { testid: 'rec-again', icon: 'refresh', onclick: function () { st.video = null; st.segments = []; st.typed = ''; st.thumb = null; st.ts = null; st.pkg = null; showOff(); } })));
    setUseEnabled(true);
  }
  function probeVideo(blob) {
    var v = document.createElement('video'); v.preload = 'metadata'; v.muted = true;
    var url = URL.createObjectURL(blob);
    var p = wait(v, 'loadedmetadata'); v.src = url;
    return p.then(function () {
      if (isFinite(v.duration) && v.duration > 0) return v.duration;
      // Browser recordings can report an unknown (infinite) length until the end has been read.
      var q = wait(v, 'durationchange', 8000); v.currentTime = 1e9; return q.then(function () { return v.duration; }).catch(function () { return null; });
    }).then(function (d) { return { duration: isFinite(d) && d > 0 ? Math.round(d * 10) / 10 : null, width: v.videoWidth }; })
      .finally(function () { v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); });
  }
  function useFile(f) {
    if (!VIDEO_EXT.test(f.name)) { say('Choose an MP4, MOV, M4V or WebM video.'); showOff('That file isn\'t a supported video. Choose an MP4, MOV, M4V or WebM file.'); return; }
    if (f.size > LIMITS.fileMB * 1024 * 1024) { showOff('That video is larger than ' + LIMITS.fileMB + ' MB. Please use a shorter or smaller file.'); return; }
    stopCamera();
    ui.stage.replaceChildren(stageMsg('clock', 'Reading the video…', null));
    probeVideo(f).then(function (info) {
      if (!info.width) throw new Error('This file has no picture Chrome can show. MP4 (H.264) works best.');
      var ext = f.name.split('.').pop().toLowerCase();
      st.video = { blob: f, type: f.type || (ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4'), ext: ext, duration: info.duration, source: 'file', size: f.size, name: f.name };
      st.segments = []; st.typed = ''; st.edited = false; st.engineUsed = 'none'; st.thumb = null; st.ts = null; st.pkg = null;
      showReview(); say('Video added.');
    }).catch(function (e) { showOff(e.message === 'timeout' ? 'Chrome couldn\'t read this video in time. MP4 (H.264) works best.' : e.message); });
  }

  /* ---------------------------------------------------------------- step 3: your words */
  function viewWords() {
    var parts = [head('Step 3', 'Check your words', st.segments.length ? 'This is what was heard while you talked. Fix anything it got wrong, like names and capital letters. Please don\'t add things you didn\'t say: your quote has to match the video.' : 'Your transcript helps people search for your story and gives you headline and quote suggestions.')];
    var body;
    if (st.segments.length) {
      body = h('div', { class: 'panel' },
        h('p', { class: 'small muted' }, 'Typed out on this computer. Times are approximate.'),
        h('ol', { class: 'segs', 'data-testid': 'segments' }, st.segments.map(function (s, i) {
          var ta = h('textarea', { class: 'input seg-text', rows: 1, 'aria-label': 'Words at ' + clock(s.start), 'data-testid': 'seg-text' }); ta.value = s.text;
          ta.addEventListener('input', function () { st.segments[i].text = ta.value; st.edited = true; st.ts = null; st.pkg = null; });
          return h('li', { class: 'seg' }, h('span', { class: 'seg-time' }, clock(s.start)), ta);
        })));
    } else {
      var canDo = st.video && st.video.source === 'file' && engine === 'available';
      var ta = h('textarea', { class: 'input', rows: 10, maxlength: LIMITS.typed, 'data-testid': 'typed-transcript', placeholder: 'Type or paste what you said in the video.' }); ta.value = st.typed;
      ta.addEventListener('input', function () { st.typed = ta.value; st.ts = null; st.pkg = null; });
      ui.mediaBox = h('div', { class: 'media-job', role: 'status' });
      body = h('div', { class: 'stack' },
        canDo ? h('div', { class: 'panel' }, h('h2', null, 'Transcribe this video on this computer'), h('p', { class: 'muted' }, 'This plays the sound silently into Chrome\'s speech recognition, so it takes about as long as the video (' + clock(st.video.duration) + '). Nothing is sent anywhere.'),
          h('div', { class: 'row' }, btn('Transcribe now', { kind: 'primary', icon: 'text', testid: 'transcribe-file', onclick: transcribeFile })), ui.mediaBox) : null,
        h('div', { class: 'panel' }, h('h2', null, 'Or type your words'), field('What you said', ta, { key: 'typed', hint: canDo ? 'Optional if you use "Transcribe now".' : engine === 'available' ? null : 'Transcription isn\'t set up on this computer, so please type or paste it.' })));
    }
    parts.push(body, navRow(btn('Back', { onclick: function () { go('record'); } }), h('div', { class: 'row' }, startOver(), btn('Next', { kind: 'primary', testid: 'words-next', onclick: wordsNext }))));
    return parts;
  }
  function transcribeFile(e) {
    var b = e.currentTarget; b.disabled = true;
    var bar = h('span', { class: 'progress-bar' }), txt = h('span', { class: 'small muted' }, 'Listening… 0%');
    ui.mediaBox.replaceChildren(h('div', { class: 'progress' }, bar), txt, btn('Cancel', { size: 'sm', onclick: function () { ui.mediaJob && ui.mediaJob.cancel(); } }));
    ui.mediaJob = T.transcribeMedia(st.video.blob, { lang: settings.language, onProgress: function (f) { bar.style.width = Math.round(f * 100) + '%'; txt.textContent = 'Listening… ' + Math.round(f * 100) + '%'; } });
    ui.mediaJob.promise.then(function (segs) {
      ui.mediaJob = null;
      if (!segs.length) { ui.mediaBox.textContent = 'No words were recognised. You can type them instead.'; b.disabled = false; return; }
      st.segments = segs; st.engineUsed = 'chrome-on-device'; st.ts = null; render(); say('Transcript ready.');
    }).catch(function (err) { ui.mediaJob = null; b.disabled = false; ui.mediaBox.textContent = err.message === 'cancelled' ? 'Cancelled.' : 'Transcription didn\'t work: ' + err.message + ' You can type your words instead.'; });
  }
  function wordsNext() {
    if (st.segments.length) {
      st.segments = st.segments.map(function (s) { return Object.assign({}, s, { text: s.text.replace(/\s+/g, ' ').trim() }); }).filter(function (s) { return s.text; });
      st.engineUsed = 'chrome-on-device';
    } else st.engineUsed = st.typed.trim() ? 'typed' : 'none';
    st.ts = null; buildTs(); go('about');
  }
  function vttTime(x) { var ms = Math.round(x * 1000), p = function (n, l) { return String(n).padStart(l || 2, '0'); }; return p(Math.floor(ms / 3600000)) + ':' + p(Math.floor((ms % 3600000) / 60000)) + ':' + p(Math.floor((ms % 60000) / 1000)) + '.' + p(ms % 1000, 3); }
  function vttEsc(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/-->/g, '→'); }
  /** The transcript as WebVTT, the caption format the Content Builder already reads (speaker as a voice tag). */
  function toVtt(segs, speaker) {
    var v = speaker ? '<v ' + vttEsc(speaker).replace(/[<>]/g, '') + '>' : '';
    return 'WEBVTT\n\n' + segs.map(function (s) { return vttTime(s.start) + ' --> ' + vttTime(Math.max(s.end, s.start + 0.3)) + '\n' + v + vttEsc(s.text); }).join('\n\n') + '\n';
  }
  function transcriptText(speaker) { return st.segments.length ? toVtt(st.segments, speaker) : st.typed.trim() ? st.typed.replace(/\r\n?/g, '\n').trim() + '\n' : ''; }
  function buildTs() {
    var text = transcriptText(null);
    st.ts = text ? K.prepareTranscript({ fileName: 'transcript.txt', text: text, formatOverride: null, parsedWith: undefined, employeeSpeaker: undefined }) : null;
    return st.ts;
  }

  /* ---------------------------------------------------------------- step 4: about you */
  function choiceGroup(key, legend, options, current, own) {
    // options: [{ text, source, testid }]. own: { area, max, placeholder }
    var name = 'ch-' + key, ownSel = !!current.value && !options.some(function (o) { return o.text === current.value; });
    var ownInput = textInput(key + '-own', ownSel ? current.value : '', own.max, { area: own.area, rows: own.area ? 3 : null, placeholder: own.placeholder, onInput: function (v) { ownRadio.checked = true; current.set(v, 'own'); } });
    var ownRadio = h('input', { type: 'radio', name: name, value: '__own', checked: ownSel || (!options.length && true), 'data-testid': 'own-' + key });
    ownRadio.addEventListener('change', function () { current.set(ownInput.value, 'own'); ownInput.focus(); });
    var items = options.map(function (o, i) {
      var r = h('input', { type: 'radio', name: name, value: String(i), checked: current.value === o.text, 'data-testid': 'opt-' + key + '-' + i });
      r.addEventListener('change', function () { current.set(o.text, o.source); });
      return h('label', { class: 'choice' }, r, h('span', { class: 'choice-text' }, o.text, o.note ? h('span', { class: 'choice-note' }, o.note) : null));
    });
    return h('fieldset', { class: 'choices field', 'data-field': key },
      h('legend', null, legend, h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')),
      items, h('label', { class: 'choice choice-own' }, ownRadio, h('span', { class: 'choice-text' }, options.length ? 'Write my own' : 'Write it yourself'), ownInput),
      h('p', { class: 'err', role: 'alert' }));
  }
  function headlineOptions() {
    if (!st.ts) return [];
    return (st.ts.headlines || []).map(function (x) { return { text: x.kind === 'quote' ? K.Quote.stripEdges(x.text) : x.text, source: x.kind === 'quote' ? 'quote' : 'suggested', note: x.kind === 'quote' ? 'Your own words' : null }; })
      .filter(function (o) { return o.text && o.text.length <= LIMITS.headline; });
  }
  function descriptionOptions() {
    if (!st.ts) return [];
    return K.Descriptions.suggest(st.ts.analysis, st.ts, { name: st.details.name.trim(), team: st.details.teamName.trim() || null })
      .map(function (d) { return { text: d.text, source: 'suggested', note: d.kind === 'words' ? 'Uses your own words' : null }; })
      .filter(function (o) { return o.text.length <= LIMITS.description; });
  }
  function quoteOptions() {
    if (!st.ts) return [];
    return st.ts.analysis.candidates.slice(0, 3).map(function (c) {
      var q = K.Quote.stripEdges(c.text).replace(/\s+/g, ' '), v = K.Quote.verify(q, st.ts);
      return v.status === 'verbatim' && q.length <= LIMITS.quote ? { text: q, start: v.start } : null;
    }).filter(Boolean);
  }
  function viewAbout() {
    if (!st.ts && st.engineUsed !== 'none') buildTs();
    var d = st.details;
    if (!st.namePrefilled && !d.name && st.ts) { var n = K.nameFromTranscript(st.ts); if (n && n.name) d.name = n.name; st.namePrefilled = true; }
    var descWrap = h('div', { 'data-testid': 'desc-wrap' });
    function renderDesc() {
      descWrap.replaceChildren(choiceGroup('description', 'Description', descriptionOptions(), { value: st.story.description, set: function (v, src) { st.story.description = v; st.story.descriptionSource = src; st.pkg = null; } }, { area: true, max: LIMITS.description, placeholder: 'One or two sentences about your story.' }));
    }
    var nameIn = textInput('name', d.name, LIMITS.name, { autocomplete: 'name', onInput: function (v) { d.name = v; st.pkg = null; } });
    nameIn.addEventListener('change', renderDesc);
    var you = h('section', { class: 'panel', 'aria-labelledby': 'you-h' }, h('h2', { id: 'you-h' }, 'You'),
      h('div', { class: 'form-grid' },
        field('Your name', nameIn, { key: 'name', required: true, hint: st.ts && d.name ? 'From your introduction. Please check the spelling.' : 'As you\'d like it shown.' }),
        field('Job title', textInput('role', d.role, LIMITS.role, { autocomplete: 'organization-title', onInput: function (v) { d.role = v; st.pkg = null; } }), { key: 'role', required: true }),
        field('Your manager\'s name', textInput('managerName', d.managerName, LIMITS.managerName, { onInput: function (v) { d.managerName = v; st.pkg = null; } }), { key: 'managerName', required: true }),
        field('Team', textInput('teamName', d.teamName, LIMITS.teamName, { onInput: function (v) { d.teamName = v; st.pkg = null; } }), { key: 'teamName', hint: 'Only if you\'re on a named team.' }),
        field('Project', textInput('project', d.project, LIMITS.project, { placeholder: st.ts && st.ts.analysis.projects[0] ? 'For example: ' + st.ts.analysis.projects[0].name : null, onInput: function (v) { d.project = v; st.pkg = null; } }), { key: 'project', hint: 'A project you talk about, if any.' })));
    renderDesc();
    var story = h('section', { class: 'panel', 'aria-labelledby': 'story-h' }, h('h2', { id: 'story-h' }, 'Your story'),
      h('p', { class: 'small muted' }, st.ts ? 'Suggestions are made from your own words. Pick one or write your own.' : 'Without a transcript there are no suggestions, so please write your own.'),
      choiceGroup('headline', 'Headline', headlineOptions(), { value: st.story.headline, set: function (v, src) { st.story.headline = v; st.story.headlineSource = src; st.pkg = null; } }, { max: LIMITS.headline, placeholder: 'A short title for your story' }),
      descWrap,
      st.ts ? quoteGroup() : null,
      st.ts ? tagGroup() : null);
    return [
      head('Step 4', 'About you and your story', 'Required fields are marked with *.'),
      h('div', { class: 'errsum', role: 'alert', 'data-testid': 'errsum', hidden: true }),
      you, story, thumbPanel(),
      navRow(btn('Back', { onclick: function () { go('words'); } }), h('div', { class: 'row' }, startOver(), btn('Next', { kind: 'primary', testid: 'about-next', onclick: aboutNext })))
    ];
  }
  function quoteGroup() {
    var opts = quoteOptions(), name = 'ch-quote', q = st.story;
    var status = h('p', { class: 'hint', 'data-testid': 'quote-check', role: 'status' });
    var ownIn = textInput('quote-own', q.quoteSource === 'own' ? q.quote : '', LIMITS.quote, { area: true, rows: 2, placeholder: 'Copy the exact words from your transcript', onInput: function (v) { ownRadio.checked = true; checkOwn(v); } });
    var ownRadio = h('input', { type: 'radio', name: name, value: '__own', checked: q.quoteSource === 'own', 'data-testid': 'own-quote' });
    function checkOwn(v) {
      var t = K.Quote.stripEdges(String(v || '')).replace(/\s+/g, ' '), r = t ? K.Quote.verify(t, st.ts) : null;
      q.quote = t; q.quoteSource = 'own'; q.quoteStart = r && r.status === 'verbatim' ? r.start : null; st.pkg = null;
      status.textContent = !t ? '' : r.status === 'verbatim' ? 'These words are in your transcript.' : 'These words aren\'t in your transcript exactly. A quote has to match what you said.';
      status.className = 'hint ' + (!t ? '' : r.status === 'verbatim' ? 'ok' : 'bad');
    }
    ownRadio.addEventListener('change', function () { checkOwn(ownIn.value); ownIn.focus(); });
    var none = h('input', { type: 'radio', name: name, value: '__none', checked: !q.quote && q.quoteSource !== 'own', 'data-testid': 'no-quote' });
    none.addEventListener('change', function () { q.quote = ''; q.quoteStart = null; q.quoteSource = ''; st.pkg = null; });
    return h('fieldset', { class: 'choices field', 'data-field': 'quote' },
      h('legend', null, 'A quote from your video', h('span', { class: 'opt' }, ' (optional)')),
      opts.map(function (o, i) {
        var r = h('input', { type: 'radio', name: name, value: String(i), checked: q.quote === o.text && q.quoteSource === 'suggested', 'data-testid': 'opt-quote-' + i });
        r.addEventListener('change', function () { q.quote = o.text; q.quoteStart = o.start; q.quoteSource = 'suggested'; st.pkg = null; });
        return h('label', { class: 'choice' }, r, h('span', { class: 'choice-text' }, '“' + o.text + '”', h('span', { class: 'choice-note' }, 'At ' + clock(o.start))));
      }),
      h('label', { class: 'choice choice-own' }, ownRadio, h('span', { class: 'choice-text' }, 'Choose other words'), ownIn, status),
      h('label', { class: 'choice' }, none, h('span', { class: 'choice-text' }, 'No quote')),
      h('p', { class: 'err', role: 'alert' }));
  }
  function tagGroup() {
    var tags = st.ts.analysis.tags.slice(0, 8).map(function (t) { return t.tag; });
    if (!tags.length) return null;
    var note = h('p', { class: 'hint' }, 'Pick up to ' + LIMITS.tags + '. They help colleagues find your story.');
    return h('fieldset', { class: 'field tags-field' }, h('legend', null, 'Topics', h('span', { class: 'opt' }, ' (optional)')),
      h('div', { class: 'tags' }, tags.map(function (t) {
        var b = h('button', { type: 'button', class: 'chip chip-toggle', 'aria-pressed': st.story.tags.indexOf(t) >= 0 ? 'true' : 'false', 'data-testid': 'tag' }, t);
        b.addEventListener('click', function () {
          var i = st.story.tags.indexOf(t);
          if (i >= 0) st.story.tags.splice(i, 1);
          else if (st.story.tags.length < LIMITS.tags) st.story.tags.push(t);
          else { say('You can pick up to ' + LIMITS.tags + ' topics.'); return; }
          b.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true'); st.pkg = null;
        });
        return b;
      })), note);
  }
  function thumbPanel() {
    var v = h('video', { muted: true, playsInline: true, preload: 'auto', 'aria-label': 'Choose a picture from your video', 'data-testid': 'thumb-video' });
    v.src = objectUrl(st.video.blob);
    var dur = st.video.duration || 1;
    var slider = h('input', { type: 'range', min: 0, max: Math.max(0.1, dur - 0.1), step: 0.1, value: st.thumb ? st.thumb.time : Math.min(3, dur * 0.2), 'aria-label': 'Position in the video', 'data-testid': 'thumb-slider' });
    var img = h('img', { alt: 'The picture that will show on your story card', class: 'thumb-img', 'data-testid': 'thumb-img' });
    var state = h('p', { class: 'small muted', role: 'status' });
    if (st.thumb) img.src = st.thumb.url;
    slider.addEventListener('input', function () { v.currentTime = +slider.value; });
    function grab() {
      return captureFrame(v).then(function (blob) {
        st.thumb = { blob: blob, time: Math.round(v.currentTime * 10) / 10, url: objectUrl(blob) }; img.src = st.thumb.url; st.pkg = null;
        state.textContent = 'Picture from ' + clock(st.thumb.time) + '.';
      }).catch(function () { state.textContent = 'That picture couldn\'t be taken. Try another moment.'; });
    }
    v.addEventListener('loadeddata', function once() {
      v.removeEventListener('loadeddata', once);
      var t = +slider.value; var seek = wait(v, 'seeked', 8000); v.currentTime = t;
      seek.then(function () { if (!st.thumb) return grab(); }).catch(function () { if (!st.thumb) grab(); });
    });
    return h('section', { class: 'panel', 'aria-labelledby': 'th-h' }, h('h2', { id: 'th-h' }, 'Picture for your story card'),
      h('div', { class: 'thumb-grid' },
        h('div', null, v, slider, h('div', { class: 'row' }, btn('Use this picture', { size: 'sm', testid: 'thumb-use', onclick: function () { grab(); } }))),
        h('div', null, img, state)));
  }
  function captureFrame(v) {
    var w = v.videoWidth, hh = v.videoHeight;
    if (!w || !hh) return Promise.reject(new Error('no picture'));
    var scale = Math.min(1, 1280 / w), c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(hh * scale);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error('encode')); }, 'image/jpeg', 0.86); });
  }
  function aboutNext() {
    var d = st.details, errs = [];
    function need(key, label, v, max) { v = String(v || '').trim(); if (!v) errs.push([key, label + ' is required.']); else if (v.length > max) errs.push([key, label + ' is too long.']); }
    ['name', 'role', 'managerName', 'teamName', 'project', 'headline', 'description', 'quote'].forEach(function (k) { setErr(k, ''); });
    need('name', 'Your name', d.name, LIMITS.name); need('role', 'Job title', d.role, LIMITS.role); need('managerName', 'Your manager\'s name', d.managerName, LIMITS.managerName);
    need('headline', 'A headline', st.story.headline, LIMITS.headline); need('description', 'A description', st.story.description, LIMITS.description);
    if (st.story.quote && st.story.quoteSource === 'own' && st.story.quoteStart === null && st.ts && K.Quote.verify(st.story.quote, st.ts).status !== 'verbatim') errs.push(['quote', 'The quote has to be words from your transcript, exactly as said.']);
    if (!st.thumb) errs.push(['thumb', 'Please choose a picture for your story card.']);
    var sum = root.querySelector('[data-testid="errsum"]');
    if (errs.length) {
      errs.forEach(function (e) { setErr(e[0], e[1]); });
      sum.hidden = false; sum.replaceChildren(h('p', null, h('strong', null, 'Please check ' + K.TextUtil.plural(errs.length, 'thing') + ':')), h('ul', null, errs.map(function (e) { return h('li', null, e[1]); })));
      sum.setAttribute('tabindex', '-1'); sum.focus();
      return;
    }
    ['name', 'role', 'managerName', 'teamName', 'project'].forEach(function (k) { d[k] = d[k].replace(/\s+/g, ' ').trim(); });
    st.story.headline = st.story.headline.replace(/\s+/g, ' ').trim(); st.story.description = st.story.description.replace(/\s+/g, ' ').trim();
    go('send');
  }

  /* ---------------------------------------------------------------- step 5: review & send */
  function viewSend() {
    var d = st.details, s = st.story;
    var card = h('div', { class: 'card preview-card', 'aria-label': 'Preview of your story card' },
      h('div', { class: 'card-media' }, st.thumb ? h('img', { src: st.thumb.url, alt: '' }) : null, h('span', { class: 'play', 'aria-hidden': 'true' }, icon('play')), st.video.duration ? h('span', { class: 'dur' }, clock(st.video.duration)) : null),
      h('div', { class: 'card-body' }, h('p', { class: 'card-title' }, s.headline), h('p', { class: 'card-meta' }, d.name + (d.role ? ' · ' + d.role : ''))));
    var rows = [['Name', d.name], ['Job title', d.role], ['Manager', d.managerName], ['Team', d.teamName || 'Not given'], ['Project', d.project || 'Not given'], ['Description', s.description], ['Quote', s.quote ? '“' + s.quote + '”' : 'None'], ['Topics', s.tags.length ? s.tags.join(', ') : 'None'],
      ['Video', clock(st.video.duration) + ' · ' + fmtBytes(st.video.size) + ' · ' + st.video.ext.toUpperCase()],
      ['Transcript', st.engineUsed === 'chrome-on-device' ? 'Typed out on this computer' + (st.edited ? ', corrected by you' : '') : st.engineUsed === 'typed' ? 'Typed by you' : 'None']];
    var consent = h('input', { type: 'checkbox', checked: st.consent, 'data-testid': 'consent', id: 'consent' });
    ui.sendBtn = btn('Send my story', { kind: 'primary', icon: 'send', testid: 'send', disabled: !st.consent, onclick: sendNow });
    consent.addEventListener('change', function () { st.consent = consent.checked; ui.sendBtn.disabled = !st.consent || st.sending; });
    ui.sendBox = h('div', { class: 'send-box', 'data-testid': 'send-box', role: 'status', 'aria-live': 'polite' });
    ui.dlBtn = btn('Download a copy', { icon: 'download', testid: 'download-copy', onclick: downloadCopy });
    return [
      head('Step 5', 'Check and send', 'This is how your story card will look. The Beyond the Title team reviews every story before it appears on the site.'),
      h('div', { class: 'send-grid' },
        h('div', null, card),
        h('section', { class: 'panel' },
          h('dl', { class: 'summary' }, rows.map(function (r) { return [h('dt', null, r[0]), h('dd', null, r[1])]; })),
          h('label', { class: 'consent', for: 'consent' }, consent, h('span', null, settings.consentText)),
          h('div', { class: 'row' }, ui.sendBtn, ui.dlBtn),
          ui.sendBox,
          settings.contact ? h('p', { class: 'small muted', style: { marginTop: '12px' } }, settings.contact) : null)),
      navRow(btn('Back', { onclick: function () { if (!st.sending) { st.pkg = null; go('about'); } } }), startOver())
    ];
  }

  /** The files of a submission. Hashes are computed once and reused if sending is retried. */
  async function buildPackage() {
    if (st.pkg) return st.pkg;
    var id = st.subId || (st.subId = makeId());
    var files = [{ name: 'video.' + st.video.ext, type: st.video.type, blob: st.video.blob, duration: st.video.duration }];
    var tx = transcriptText(st.details.name);
    if (tx) files.push({ name: 'transcript.txt', type: 'text/plain', blob: new Blob([tx], { type: 'text/plain' }) });
    if (st.segments.length) files.push({ name: 'captions.vtt', type: 'text/vtt', blob: new Blob([tx], { type: 'text/vtt' }) });
    files.push({ name: 'thumbnail.jpg', type: 'image/jpeg', blob: st.thumb.blob, time: st.thumb.time });
    for (var i = 0; i < files.length; i++) files[i].sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await files[i].blob.arrayBuffer())), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    var d = st.details, s = st.story;
    var manifest = {
      format: 'btt-submission', version: 1, id: id, createdAt: new Date().toISOString(), tool: 'Beyond the Title share page ' + B.VERSION,
      consent: { text: settings.consentText, agreedAt: new Date().toISOString() },
      person: { name: d.name, role: d.role, managerName: d.managerName, teamName: d.teamName || null },
      story: { headline: s.headline, headlineSource: s.headlineSource || 'own', description: s.description, descriptionSource: s.descriptionSource || 'own', quote: s.quote || null, quoteStart: s.quote ? s.quoteStart : null, quoteSource: s.quote ? s.quoteSource : null, tags: s.tags.slice(), project: d.project || null },
      transcript: { engine: st.engineUsed, edited: !!st.edited, language: settings.language },
      video: { source: st.video.source, duration: st.video.duration },
      files: files.map(function (f) { var o = { name: f.name, type: f.type, size: f.blob.size, sha256: f.sha256 }; if (f.duration) o.duration = f.duration; if (f.time !== undefined) o.time = f.time; return o; })
    };
    st.pkg = { id: id, files: files, manifest: manifest };
    return st.pkg;
  }
  /** Splits files bigger than the chunk size into numbered parts, so server request-size limits don't matter. */
  function uploadPlan(pkg) {
    var size = Math.max(1, Math.round(settings.chunkMB * 1024 * 1024)), plan = [];
    var manifest = JSON.parse(JSON.stringify(pkg.manifest));
    pkg.files.forEach(function (f, fi) {
      if (f.blob.size <= size) { plan.push({ key: f.name, name: f.name, blob: f.blob, part: 1, parts: 1 }); return; }
      var n = Math.ceil(f.blob.size / size), names = [];
      for (var i = 0; i < n; i++) { var nm = f.name + '.part' + String(i + 1).padStart(3, '0'); names.push(nm); plan.push({ key: nm, name: nm, blob: f.blob.slice(i * size, Math.min(f.blob.size, (i + 1) * size), 'application/octet-stream'), part: i + 1, parts: n }); }
      manifest.files[fi].parts = names;
    });
    // submission.json goes last: it marks the submission as complete.
    plan.push({ key: 'submission.json', name: 'submission.json', blob: new Blob([JSON.stringify(manifest, null, 2) + '\n'], { type: 'application/json' }), part: 1, parts: 1 });
    return plan;
  }
  function uploadBase() {
    var u = settings.uploadUrl;
    if (settings.method === 'put' && u.slice(-1) !== '/') u += '/';
    var url = new URL(u, location.href);
    if (!/^https?:$/.test(url.protocol)) throw new Error('The upload address must be a web address.');
    return url;
  }
  function uploadUrl(id, name) { return new URL(encodeURIComponent(id) + '/' + encodeURIComponent(name), uploadBase()).href; }
  function upload(id, name, blob, part, parts) {
    if (settings.method === 'post') {
      var fd = new FormData();
      fd.append('submissionId', id); fd.append('path', name); fd.append('part', String(part)); fd.append('parts', String(parts)); fd.append('file', blob, name);
      return fetch(uploadBase().href, { method: 'POST', body: fd, credentials: 'same-origin', cache: 'no-store', redirect: 'manual' });
    }
    return fetch(uploadUrl(id, name), { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type || 'application/octet-stream' }, credentials: 'same-origin', cache: 'no-store', redirect: 'manual' });
  }
  function explain(res) {
    var s = res.status;
    if (res.type === 'opaqueredirect' || s === 0) return 'The website redirected the upload, usually to a sign-in page. Open the site in a new tab, sign in, then try again.';
    if (s === 401 || s === 403) return 'The website refused the upload (HTTP ' + s + '). Ask the site owner to check upload permissions for the submissions folder.';
    if (s === 404 || s === 405 || s === 501) return 'This website doesn\'t accept uploads at that address (HTTP ' + s + '). Ask the site owner to switch on uploads, or download a copy and send it another approved way.';
    if (s === 413) return 'The website said the upload is too large (HTTP 413). Ask the site owner to lower the part size in the Content Builder\'s share settings.';
    if (s >= 500) return 'The website had a problem (HTTP ' + s + '). Try again in a moment.';
    return 'The upload didn\'t work (HTTP ' + s + ').';
  }
  function networkText(err) { return 'The upload couldn\'t reach the website. It may be offline, or the address may be blocked. (' + (err && err.message || err) + ')'; }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  async function sendOne(id, item) {
    for (var attempt = 0; ; attempt++) {
      var res = null, err = null;
      try { res = await upload(id, item.name, item.blob, item.part, item.parts); } catch (e) { err = e; }
      if (res && res.ok) return;
      var retry = err || (res && (res.status >= 500 || res.status === 408 || res.status === 429));
      if (!retry || attempt >= 3) throw new Error(err ? networkText(err) : explain(res));
      await sleep([1000, 3000, 6000][attempt]);
    }
  }
  async function sendNow() {
    if (st.sending || !st.consent) return;
    if (location.protocol === 'file:') { ui.sendBox.className = 'send-box bad'; ui.sendBox.textContent = 'This copy of the page was opened from disk, so it can\'t send. Open it from the website, or download a copy.'; return; }
    st.sending = true; ui.sendBtn.disabled = true; ui.dlBtn.disabled = true;
    var bar = h('span', { class: 'progress-bar' }), txt = h('p', { class: 'small' }, 'Preparing…');
    ui.sendBox.className = 'send-box'; ui.sendBox.replaceChildren(h('div', { class: 'progress' }, bar), txt);
    try {
      var pkg = await buildPackage(), plan = uploadPlan(pkg);
      var total = plan.reduce(function (n, p) { return n + p.blob.size; }, 0), done = plan.filter(function (p) { return st.sent[p.key]; }).reduce(function (n, p) { return n + p.blob.size; }, 0);
      for (var i = 0; i < plan.length; i++) {
        var p = plan[i]; if (st.sent[p.key]) continue;
        txt.textContent = 'Sending ' + (i + 1) + ' of ' + plan.length + '… (' + fmtBytes(done) + ' of ' + fmtBytes(total) + ')';
        await sendOne(pkg.id, p);
        st.sent[p.key] = true; done += p.blob.size; bar.style.width = Math.round(done / total * 100) + '%';
      }
      st.sending = false; go('done'); say('Your story was sent.');
    } catch (e) {
      st.sending = false; ui.sendBtn.disabled = !st.consent; ui.dlBtn.disabled = false;
      ui.sendBox.className = 'send-box bad';
      ui.sendBox.replaceChildren(h('p', { 'data-testid': 'send-error' }, h('strong', null, 'Not sent. '), e.message), h('p', { class: 'small' }, 'Your recording is still here. You can try again, or download a copy and send it another approved way.'));
      ui.sendBtn.lastChild.textContent = 'Try again';
      ui.dlBtn.classList.remove('btn-secondary'); ui.dlBtn.classList.add('btn-primary');
      say('Not sent. ' + e.message);
    }
  }
  async function downloadCopy() {
    if (!st.consent) { ui.sendBox.className = 'send-box bad'; ui.sendBox.textContent = 'Please tick the agreement first. The copy includes it.'; return; }
    ui.dlBtn.disabled = true;
    try {
      var pkg = await buildPackage();
      var entries = pkg.files.map(function (f) { return { path: pkg.id + '/' + f.name, data: f.blob }; });
      entries.push({ path: pkg.id + '/submission.json', data: JSON.stringify(pkg.manifest, null, 2) + '\n' });
      var zip = await K.Zip.createBlob(entries);
      var a = h('a', { href: objectUrl(zip), download: 'beyond-the-title-story-' + pkg.id + '.zip', style: { display: 'none' } });
      document.body.append(a); a.click(); setTimeout(function () { a.remove(); }, 1000);
      ui.sendBox.className = 'send-box ok'; ui.sendBox.textContent = 'Downloaded beyond-the-title-story-' + pkg.id + '.zip. Send it to the Beyond the Title team through an approved channel.' + (settings.contact ? ' ' + settings.contact : '');
    } catch (e) { ui.sendBox.className = 'send-box bad'; ui.sendBox.textContent = 'The copy couldn\'t be made: ' + e.message; }
    ui.dlBtn.disabled = false;
  }

  /* ---------------------------------------------------------------- done */
  function viewDone() {
    return [h('section', { class: 'panel done-panel', 'data-testid': 'done' },
      h('span', { class: 'done-ico', 'aria-hidden': 'true' }, icon('checkCircle')),
      h('h1', null, 'Thank you! Your story is on its way.'),
      h('p', null, 'The Beyond the Title team reviews every story before it appears on the site.' + (settings.contact ? ' ' + settings.contact : '')),
      h('p', { class: 'small muted' }, 'Reference: ', h('span', { 'data-testid': 'ref' }, st.subId)),
      h('div', { class: 'row', style: { justifyContent: 'center' } }, h('a', { class: 'btn btn-primary', href: 'index.html' }, 'Back to stories'), btn('Share another story', { onclick: function () { reset(); } })))];
  }

  /* ---------------------------------------------------------------- start */
  window.addEventListener('beforeunload', function (e) { if (st.video && st.step !== 'done') { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('pagehide', stopCamera);
  function boot() {
    B.data.load().then(function (raw) { return raw && raw.stories && raw.stories.settings ? raw.stories.settings.share : null; }).catch(function () { return null; }).then(function (s) {
      settings = normalize(s);
      if (!settings.enabled) {
        root.replaceChildren(head('Share your story', 'Sharing isn\'t open right now', 'Story submissions are switched off for this site. Please check back later.'), h('a', { class: 'btn btn-primary', href: 'index.html' }, 'Back to stories'));
        window.BTT_SHARE.ready = true; return;
      }
      render();
      window.BTT_SHARE.ready = true;
      T.status(settings.language).then(function (s2) { engine = s2; refreshEngineRow(); });
    });
  }
  window.BTT_SHARE = { ready: false, get state() { return st; }, get settings() { return settings; }, get engine() { return engine; }, toVtt: toVtt, uploadPlan: uploadPlan, normalize: normalize };
  boot();
})();
