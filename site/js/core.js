/* Beyond the Title: core helpers (DOM, icons, utilities).
   All text is rendered with DOM APIs, never as HTML. */
(function () {
  'use strict';
  var BTT = (window.BTT_SITE = window.BTT_SITE || {});
  BTT.VERSION = '0.3.0';
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var PROPS = { value: 1, checked: 1, disabled: 1, selected: 1, hidden: 1, type: 1, tabIndex: 1, controls: 1, muted: 1, playsInline: 1 };

  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = String(v);
        else if (k === 'style') Object.assign(el.style, v); // CSSOM only: CSP allows it
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (PROPS[k]) el[k] = v;
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  }
  function append(el, kids) {
    kids.forEach(function (c) {
      if (c === null || c === undefined || c === false || c === true) return;
      if (Array.isArray(c)) append(el, c);
      else el.append(c instanceof Node ? c : String(c));
    });
    return el;
  }

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 4 6"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
    org: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-2h12v2"/>',
    shuffle: '<path d="M3 7h3.5a5 5 0 0 1 4 2l3 4a5 5 0 0 0 4 2H21"/><path d="m18 12 3 3-3 3"/><path d="M3 17h3.5a5 5 0 0 0 3-1M14.5 9a5 5 0 0 1 3-1H21"/><path d="m18 5 3 3-3 3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    play: '<path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12-7.4a1 1 0 0 0 0-1.72l-12-7.4A1 1 0 0 0 7 4.6z" fill="currentColor" stroke="none"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z"/>',
    quote: '<path d="M10 7H6a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v1c0 1.7-1 3-3 3"/><path d="M19 7h-4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v1c0 1.7-1 3-3 3"/>',
    tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    alert: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.9-4L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 4L21 15"/><path d="M21 20v-5h-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>'
  };
  function icon(name, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    svg.innerHTML = ICONS[name] || ''; // static-icon: constant markup only
    return svg;
  }
  function spark(cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 44 44'); svg.setAttribute('class', cls || 'spark'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path d="M14 6l4 12M26 4l-3 13M36 14l-10 7" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" fill="none"/>'; // static-icon
    return svg;
  }

  var util = {
    /** Relative asset paths only: no scheme, no leading slash, no "..". */
    safePath: function (p) {
      if (typeof p !== 'string' || !p || p.charAt(0) === '/' || p.indexOf('\\') >= 0 || /^[a-z][a-z0-9+.-]*:/i.test(p)) return null;
      return p.split('/').every(function (x) { return x && x !== '.' && x !== '..' && /^[A-Za-z0-9._ -]+$/.test(x); }) ? p : null;
    },
    slug: function (s) { return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); },
    norm: function (s) { return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘]/g, "'"); },
    initials: function (name) { var p = String(name || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '?'; return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); },
    clock: function (sec) { if (typeof sec !== 'number' || !isFinite(sec)) return ''; var s = Math.floor(sec), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60, p = function (n) { return String(n).padStart(2, '0'); }; return hh ? hh + ':' + p(mm) + ':' + p(ss) : mm + ':' + p(ss); },
    parseTs: function (t) { var m = String(t || '').match(/^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})/); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) : null; },
    shuffle: function (arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
    plural: function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); },
    debounce: function (fn, ms) { var t; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); }; },
    dateLabel: function (iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); },
    dayNumber: function () { return Math.floor(Date.now() / 86400000); }
  };

  BTT.h = h; BTT.icon = icon; BTT.spark = spark; BTT.util = util;
})();
