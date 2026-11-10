/* Beyond the Title: core helpers (DOM, icons, utilities).
   All text is rendered with DOM APIs, never as HTML. */
(function () {
  'use strict';
  var BTT = (window.BTT_SITE = window.BTT_SITE || {});
  BTT.VERSION = '0.5.0';
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

  // Outline icons on a 24px grid (2px strokes), shaped like the reference design.
  var ICONS = {
    home: '<path d="M3 10.2 12 3l9 7.2"/><path d="M5 8.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V8.8"/>',
    homeFill: '<path d="M11.3 2.6a1.1 1.1 0 0 1 1.4 0l8.6 7.2c.7.6.3 1.7-.6 1.7H19.5V20a1.4 1.4 0 0 1-1.4 1.4h-3.7v-6.1H9.6v6.1H5.9A1.4 1.4 0 0 1 4.5 20v-8.5H3.3c-.9 0-1.3-1.1-.6-1.7l8.6-7.2z" fill="currentColor" stroke="none"/>',
    compass: '<circle cx="12" cy="12" r="9.5"/><path d="m16.2 7.8-1.9 5.4a1.8 1.8 0 0 1-1.1 1.1l-5.4 1.9 1.9-5.4a1.8 1.8 0 0 1 1.1-1.1z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    layers: '<path d="M12.8 2.2a2 2 0 0 0-1.6 0L2.6 6.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9a1 1 0 0 0 0-1.8z"/><path d="m2 12.6 9.2 4.2a2 2 0 0 0 1.6 0l9.2-4.2"/><path d="m2 17.6 9.2 4.2a2 2 0 0 0 1.6 0l9.2-4.2"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
    org: '<rect x="9" y="2.5" width="6" height="5.5" rx="1"/><rect x="2.5" y="16" width="5.5" height="5.5" rx="1"/><rect x="9.25" y="16" width="5.5" height="5.5" rx="1"/><rect x="16" y="16" width="5.5" height="5.5" rx="1"/><path d="M12 8v8M5.25 16v-2.5a1 1 0 0 1 1-1h11.5a1 1 0 0 1 1 1V16"/>',
    shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h2a4 4 0 0 0 3.3-1.7l5.4-7.6A4 4 0 0 1 16 7h6"/><path d="M2 6h2a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6a4 4 0 0 1-3.3-1.8l-.4-.5"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/>',
    arrowRight: '<path d="M4.5 12h15"/><path d="m13 5.5 6.5 6.5-6.5 6.5"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    play: '<path d="M6 4.9c0-1.3 1.4-2.1 2.5-1.4l11.3 7.1c1 .6 1 2.2 0 2.8L8.5 20.5C7.4 21.2 6 20.4 6 19.1z" fill="currentColor" stroke="none"/>',
    star: '<path d="M11.5 2.3a.55.55 0 0 1 1 0l2.3 4.7a2.1 2.1 0 0 0 1.6 1.2l5.2.7a.55.55 0 0 1 .3.9l-3.7 3.7a2.1 2.1 0 0 0-.6 1.9l.9 5.1a.55.55 0 0 1-.8.6l-4.6-2.4a2.1 2.1 0 0 0-2 0L6.4 21a.55.55 0 0 1-.8-.6l.9-5.1a2.1 2.1 0 0 0-.6-1.9L2.2 9.8a.55.55 0 0 1 .3-.9l5.2-.7a2.1 2.1 0 0 0 1.6-1.2z"/>',
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
    svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.setAttribute('class', 'i' + (cls ? ' ' + cls : ''));
    svg.innerHTML = ICONS[name] || ''; // static-icon: constant markup only
    return svg;
  }
  /* The three little emphasis strokes from the reference design: a near-vertical stroke, a diagonal one and a
     short, lighter, almost horizontal one. Each stroke fades from deep violet to a lighter violet. Built with DOM
     APIs so every copy gets its own gradient IDs. */
  var SPARK_STROKES = [
    { d: [16, 9, 8, 37], w: 6.2, from: '#5A0EEA', to: '#8D57F6' },
    { d: [42.5, 21.5, 25, 43.5], w: 7, from: '#560BE8', to: '#9566F6' },
    { d: [33, 56.5, 53.5, 51], w: 5.4, from: '#7F44F4', to: '#A07CF7' }
  ];
  var sparkSeq = 0;
  function svgEl(tag, attrs) { var el = document.createElementNS(SVG_NS, tag); Object.keys(attrs).forEach(function (k) { el.setAttribute(k, String(attrs[k])); }); return el; }
  function spark(cls) {
    var svg = svgEl('svg', { viewBox: '0 0 60 60', 'class': cls || 'spark', 'aria-hidden': 'true', focusable: 'false', 'data-spark': '' });
    var defs = svgEl('defs', {});
    svg.appendChild(defs);
    SPARK_STROKES.forEach(function (st) {
      var id = 'btt-spark-' + (++sparkSeq);
      var g = svgEl('linearGradient', { id: id, gradientUnits: 'userSpaceOnUse', x1: st.d[0], y1: st.d[1], x2: st.d[2], y2: st.d[3] });
      g.appendChild(svgEl('stop', { offset: 0, 'stop-color': st.from }));
      g.appendChild(svgEl('stop', { offset: 1, 'stop-color': st.to }));
      defs.appendChild(g);
      svg.appendChild(svgEl('line', { x1: st.d[0], y1: st.d[1], x2: st.d[2], y2: st.d[3], stroke: 'url(#' + id + ')', 'stroke-width': st.w, 'stroke-linecap': 'round' }));
    });
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
