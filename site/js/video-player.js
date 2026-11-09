/* Beyond the Title: video player. The browser's own controls (keyboard and screen-reader friendly),
   with a poster cover, captions on by default, and jump-to-quote. */
(function () {
  'use strict';
  var BTT = window.BTT_SITE, h = BTT.h, icon = BTT.icon, U = BTT.util;
  var blobUrls = new Map();

  /** Opened from disk, browsers refuse <track> files from file:// URLs, so the builder includes the
      caption text in site-data.js and it is played from an in-memory URL instead. */
  function captionsSrc(story, data) {
    if (!story.captions) return null;
    if (location.protocol === 'file:' && data.captions && typeof data.captions[story.captions] === 'string') {
      if (!blobUrls.has(story.captions)) blobUrls.set(story.captions, URL.createObjectURL(new Blob([data.captions[story.captions]], { type: 'text/vtt' })));
      return blobUrls.get(story.captions);
    }
    return location.protocol === 'file:' ? null : story.captions;
  }

  function create(story, data) {
    var wrap = h('div', { class: 'player', 'data-testid': 'player' });
    if (!story.video) {
      wrap.append(h('div', { class: 'player-empty' }, h('div', null, h('b', null, 'Video coming soon'), h('div', { class: 'small' }, 'This story doesn\'t have a video yet.'))));
      return { el: wrap, seek: function () {} };
    }
    var video = h('video', { controls: true, preload: 'metadata', playsInline: true, 'aria-label': 'Video: ' + (story.headline || story.name) });
    if (story.thumbnail) video.setAttribute('poster', story.thumbnail);
    video.append(h('source', { src: story.video, type: /\.mov$/i.test(story.video) ? 'video/quicktime' : 'video/mp4' }));
    var cap = captionsSrc(story, data);
    if (cap) video.append(h('track', { kind: 'captions', src: cap, srclang: 'en', label: 'English', default: true }));
    var cover = h('button', { type: 'button', class: 'player-cover', 'aria-label': 'Play video: ' + (story.headline || story.name) },
      story.thumbnail ? h('img', { src: story.thumbnail, alt: '' }) : null, h('span', { class: 'big-play' }, icon('play')));
    function start() { cover.remove(); var p = video.play(); if (p && p.catch) p.catch(function () {}); video.focus(); }
    cover.addEventListener('click', start);
    video.addEventListener('play', function () { if (cover.isConnected) cover.remove(); });
    wrap.append(video, cover);
    return {
      el: wrap, video: video,
      seek: function (t) { if (typeof t !== 'number') return; if (cover.isConnected) cover.remove(); video.currentTime = t; var p = video.play(); if (p && p.catch) p.catch(function () {}); wrap.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    };
  }
  BTT.player = { create: create, captionsSrc: captionsSrc, clock: U.clock };
})();
