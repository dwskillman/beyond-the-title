/* Beyond the Title: video player. The browser's own controls (keyboard and screen-reader friendly),
   with a poster cover, captions on by default, and jump-to-quote. */
(function () {
  'use strict';
  var BTT = window.BTT_SITE, h = BTT.h, icon = BTT.icon, U = BTT.util;
  var blobUrls = new Map();

  /** Browsers refuse <track> files from file:// URLs and from other servers (Syndicate sends files from its
      file server), so the builder includes the caption text in site-data.js (or in a single-file page) and
      it is played from an in-memory URL instead whenever that copy is there. */
  function captionsSrc(story, data) {
    if (!story.captions) return null;
    if (data.captions && typeof data.captions[story.captions] === 'string') {
      if (!blobUrls.has(story.captions)) blobUrls.set(story.captions, URL.createObjectURL(new Blob([data.captions[story.captions]], { type: 'text/vtt' })));
      return blobUrls.get(story.captions);
    }
    return location.protocol === 'file:' || data.source === 'bundled' ? null : story.captions;
  }

  function create(story, data) {
    var wrap = h('div', { class: 'player', 'data-testid': 'player' });
    if (!story.video) {
      wrap.append(h('div', { class: 'player-empty' }, h('div', null, h('b', null, 'Video coming soon'), h('div', { class: 'small' }, 'This story doesn\'t have a video yet.'))));
      return { el: wrap, seek: function () {} };
    }
    var video = h('video', { controls: true, preload: 'metadata', playsInline: true, 'aria-label': 'Video: ' + (story.headline || story.name) });
    if (story.thumbnail) video.setAttribute('poster', story.thumbnail);
    video.src = story.video; // set directly (not <source>) so a failure is reported on the video, with Chrome's reason

    var cap = captionsSrc(story, data);
    if (cap) video.append(h('track', { kind: 'captions', src: cap, srclang: 'en', label: 'English', default: true }));
    var cover = h('button', { type: 'button', class: 'player-cover', 'aria-label': 'Play video: ' + (story.headline || story.name) },
      story.thumbnail ? h('img', { src: story.thumbnail, alt: '' }) : null, h('span', { class: 'big-play' }, icon('play')));
    function start() { cover.remove(); var p = video.play(); if (p && p.catch) p.catch(function () {}); video.focus(); }
    cover.addEventListener('click', start);
    video.addEventListener('play', function () { if (cover.isConnected) cover.remove(); });
    // If the video can't be played, say so on the page, with the browser's own reason (helps diagnose hosting problems).
    video.addEventListener('error', function () {
      var e = video.error, codes = { 1: 'stopped', 2: 'network problem', 3: 'the file couldn\'t be decoded', 4: 'the file isn\'t a playable video, or wasn\'t found' };
      if (cover.isConnected) cover.remove();
      var old = wrap.querySelector('.player-error'); if (old) old.remove();
      wrap.append(h('div', { class: 'player-error', role: 'alert', 'data-testid': 'player-error' }, h('b', null, 'This video couldn\'t be played here.'),
        h('div', { class: 'small' }, (e ? (codes[e.code] || 'error ' + e.code) + (e.message ? ' (' + e.message + ')' : '') : 'unknown error'))));
    });
    wrap.append(video, cover);
    return {
      el: wrap, video: video,
      seek: function (t) { if (typeof t !== 'number') return; if (cover.isConnected) cover.remove(); video.currentTime = t; var p = video.play(); if (p && p.catch) p.catch(function () {}); wrap.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    };
  }
  BTT.player = { create: create, captionsSrc: captionsSrc, clock: U.clock };
})();
