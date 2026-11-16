/* Beyond the Title: on-device transcription for the share page.
   Uses Chrome's built-in speech recognition ONLY in on-device mode (processLocally). Chrome's ordinary speech
   recognition sends audio to Google's servers, so if on-device mode isn't supported this module reports
   "unsupported" and never starts recognition. No network requests are made by this file. The one exception is
   install(): Chrome downloads its own speech pack, and only after the person clicks "Set up transcription". */
(function () {
  'use strict';
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  // The guard. Every path into recognition goes through localOk().
  function localOk() { return !!(SR && typeof SR.available === 'function' && 'processLocally' in SR.prototype); }
  var FATAL = { 'not-allowed': 1, 'service-not-allowed': 1, 'language-not-supported': 1, 'audio-capture': 1, 'bad-grammar': 1 };
  var LATENCY = 0.35; // seconds between a word being spoken and Chrome reporting it (approximate)

  /** → 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported' */
  function status(lang) {
    if (!localOk()) return Promise.resolve('unsupported');
    return Promise.race([
      SR.available({ langs: [lang], processLocally: true }).then(function (s) { return String(s); }),
      new Promise(function (r) { setTimeout(function () { r('unavailable'); }, 8000); })
    ]).catch(function () { return 'unavailable'; });
  }
  /** Asks Chrome to download its speech pack for `lang`. Call only from a click. */
  function install(lang) {
    if (!localOk() || typeof SR.install !== 'function') return Promise.resolve(false);
    return SR.install({ langs: [lang], processLocally: true }).then(function (ok) { return !!ok; }).catch(function () { return false; });
  }

  function tidy(words, last) {
    var t = words.join(' ').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return last && !/[.!?…]$/.test(t) ? t + '.' : t;
  }
  /**
   * Turns phrases ([{ words: [{ w, t }] }], t = seconds from the start) into short timed segments for the
   * transcript and captions: one phrase per pause, split into chunks of at most `maxWords` words.
   * Light clean-up only: a capital letter at the start of each phrase and a full stop at its end.
   */
  function segmentsFrom(phrases, maxWords) {
    maxWords = maxWords || 12;
    var out = [];
    phrases.forEach(function (p) {
      var ws = p.words.filter(function (x) { return x.w; });
      if (!ws.length) return;
      ws[0] = { w: ws[0].w.charAt(0).toUpperCase() + ws[0].w.slice(1), t: ws[0].t };
      var n = Math.ceil(ws.length / maxWords), size = Math.ceil(ws.length / n);
      for (var i = 0; i < ws.length; i += size) {
        var chunk = ws.slice(i, i + size), next = ws[i + size];
        var start = Math.max(0, chunk[0].t - LATENCY);
        var end = next ? Math.max(start + 0.5, next.t - LATENCY) : Math.max(start + 0.8, chunk[chunk.length - 1].t + 0.6 - LATENCY);
        out.push({ start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10, text: tidy(chunk.map(function (x) { return x.w; }), !next) });
      }
    });
    for (var k = 1; k < out.length; k++) if (out[k].start < out[k - 1].end) out[k - 1].end = Math.max(out[k - 1].start + 0.3, out[k].start);
    return out.filter(function (s) { return s.text; });
  }

  /**
   * Starts on-device recognition. opts: { lang, track (optional audio MediaStreamTrack), onUpdate(segments, interimText), onError(code) }.
   * → session { stop(): Promise<segments>, abort() }. Throws if on-device recognition isn't supported.
   */
  function start(opts) {
    if (!localOk()) throw new Error('On-device speech recognition is not supported in this browser.');
    var lang = opts.lang || 'en-US', t0 = performance.now(), phrases = [], live = {}, running = true, rec = null, ended = null, useTrack = !!opts.track;
    var now = function () { return (performance.now() - t0) / 1000; };
    function snapshot() {
      var interim = Object.keys(live).map(function (k) { return live[k].words.map(function (x) { return x.w; }).join(' '); }).join(' ');
      if (opts.onUpdate) opts.onUpdate(segmentsFrom(phrases), interim);
    }
    function commitLive() { Object.keys(live).sort(function (a, b) { return a - b; }).forEach(function (k) { if (live[k].words.length) phrases.push(live[k]); }); live = {}; }
    function begin() {
      rec = new SR();
      rec.lang = lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.processLocally = true;
      if (rec.processLocally !== true) { running = false; throw new Error('On-device mode could not be switched on.'); }
      rec.onresult = function (e) {
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var r = e.results[i], words = String(r[0].transcript || '').trim().split(/\s+/).filter(Boolean);
          var p = live[i] || (live[i] = { words: [] });
          for (var k = 0; k < words.length; k++) {
            if (!p.words[k]) p.words[k] = { w: words[k], t: now() };
            else p.words[k].w = words[k];
          }
          p.words.length = words.length;
          if (r.isFinal) { phrases.push(p); delete live[i]; }
        }
        snapshot();
      };
      rec.onerror = function (e) { if (FATAL[e.error]) { running = false; if (opts.onError) opts.onError(e.error); } };
      rec.onend = function () {
        commitLive(); snapshot();
        if (running) { try { begin(); } catch (err) { running = false; if (opts.onError) opts.onError('restart-failed'); } }
        else if (ended) ended();
      };
      if (useTrack) { try { rec.start(opts.track); return; } catch (err) { if (!(err instanceof TypeError)) throw err; useTrack = false; } }
      rec.start();
    }
    begin();
    return {
      stop: function () {
        running = false;
        return new Promise(function (resolve) {
          var done = false, finish = function () { if (done) return; done = true; commitLive(); resolve(segmentsFrom(phrases)); };
          ended = finish;
          try { rec.stop(); } catch (e) { finish(); }
          setTimeout(finish, 3000);
        });
      },
      abort: function () { running = false; try { rec.abort(); } catch (e) { /* already stopped */ } },
      usesTrack: function () { return useTrack; }
    };
  }

  /**
   * Transcribes a recorded file by playing its sound (silently) into the recogniser, in real time.
   * opts: { lang, onProgress(fraction), onUpdate }. → { promise: Promise<segments>, cancel() }
   */
  function transcribeMedia(blob, opts) {
    var cancelled = false, ctx = null, src = null, session = null;
    var promise = (async function () {
      ctx = new AudioContext();
      await ctx.resume();
      var buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      if (cancelled) throw new Error('cancelled');
      var dest = ctx.createMediaStreamDestination();
      src = ctx.createBufferSource(); src.buffer = buf; src.connect(dest);
      var track = dest.stream.getAudioTracks()[0];
      session = start({ lang: opts.lang, track: track, onUpdate: opts.onUpdate, onError: opts.onError });
      if (!session.usesTrack()) { session.abort(); throw new Error('This version of Chrome can only transcribe live from the microphone.'); }
      var began = ctx.currentTime;
      src.start();
      var timer = setInterval(function () { if (opts.onProgress) opts.onProgress(Math.min(1, (ctx.currentTime - began) / buf.duration)); }, 250);
      await new Promise(function (r) { src.onended = r; });
      clearInterval(timer);
      if (cancelled) throw new Error('cancelled');
      await new Promise(function (r) { setTimeout(r, 1200); });
      return session.stop();
    })();
    promise.finally(function () { if (ctx) ctx.close().catch(function () {}); }).catch(function () {});
    return { promise: promise, cancel: function () { cancelled = true; try { src && src.stop(); } catch (e) { /* not started */ } if (session) session.abort(); } };
  }

  window.BTT_TRANSCRIBE = { status: status, install: install, start: start, transcribeMedia: transcribeMedia, segmentsFrom: segmentsFrom, localOk: localOk };
})();
