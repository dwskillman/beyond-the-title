/* Beyond the Title: universal search (people, managers, teams, projects, tags, story text).
   Every word typed must match something; accents and capitals are ignored; word starts rank highest. */
(function () {
  'use strict';
  var BTT = window.BTT_SITE, h = BTT.h, icon = BTT.icon, U = BTT.util;
  var entries = [];

  function field(text, weight) { var n = U.norm(text); return { n: n, words: n.split(/[^a-z0-9']+/).filter(Boolean), w: weight }; }
  function index(d) {
    entries = [];
    d.stories.forEach(function (s) {
      entries.push({ kind: 'story', item: s, href: '#/story/' + s.id, fields: [
        field(s.name, 3), field(s.headline, 2.2), field(s.project, 2), field(s.team ? s.team.name : '', 1.8), field(s.manager ? s.manager.name : '', 1.6),
        field(s.tags.join(' '), 2), field(s.role, 1.4), field(s.description, 1), field(s.quote, 0.9)] });
    });
    d.storytellers.forEach(function (p) { entries.push({ kind: 'person', item: p, href: '#/person/' + encodeURIComponent(p.id), fields: [field(p.name, 3), field(p.title, 1.4)] }); });
    d.managers.forEach(function (m) { if (!m.person.stories.length) entries.push({ kind: 'person', item: m.person, href: '#/manager/' + encodeURIComponent(m.person.id), fields: [field(m.person.name, 3), field(m.person.title + ' manager', 1.2)] }); });
    d.teams.forEach(function (t) { if (t.stories.length) entries.push({ kind: 'team', item: t, href: '#/team/' + encodeURIComponent(t.id), fields: [field(t.name, 3)] }); });
    d.projects.forEach(function (p) { entries.push({ kind: 'project', item: p, href: '#/project/' + p.slug, fields: [field(p.name, 3)] }); });
  }
  function scoreToken(tok, f) {
    if (!f.n) return 0;
    var best = 0;
    for (var i = 0; i < f.words.length; i++) { var w = f.words[i]; if (w === tok) { best = 3; break; } if (w.indexOf(tok) === 0) best = Math.max(best, 2); }
    if (!best && tok.length >= 3 && f.n.indexOf(tok) >= 0) best = 1;
    return best * f.w;
  }
  /** Returns ranked entries; every token must match at least one field. */
  function query(q, kinds) {
    var toks = U.norm(q).split(/[^a-z0-9']+/).filter(Boolean);
    if (!toks.length) return [];
    var out = [];
    entries.forEach(function (e) {
      if (kinds && kinds.indexOf(e.kind) < 0) return;
      var total = 0;
      for (var i = 0; i < toks.length; i++) {
        var best = 0;
        for (var j = 0; j < e.fields.length; j++) best = Math.max(best, scoreToken(toks[i], e.fields[j]));
        if (!best) return;
        total += best;
      }
      out.push({ e: e, score: total });
    });
    return out.sort(function (a, b) { return b.score - a.score; }).map(function (x) { return x.e; });
  }
  function storyMatches(q) { return query(q, ['story']).map(function (e) { return e.item; }); }

  /* ---------- search box + results panel ---------- */
  function mount(root, data, go) {
    var input = h('input', { type: 'search', id: 'site-search', placeholder: 'Search people, teams, projects, or topics…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Search Beyond the Title', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'search-panel', 'aria-autocomplete': 'list' });
    var panel = h('div', { class: 'search-panel', id: 'search-panel', role: 'listbox', hidden: true, 'aria-label': 'Search results' });
    var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    root.replaceChildren(h('label', { class: 'search-box', for: 'site-search' }, icon('search'), input, h('span', { class: 'kbd', 'aria-hidden': 'true' }, isMac ? '⌘ K' : 'Ctrl K')), panel);
    var items = [], active = -1;
    function close() { panel.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
    function setActive(i) {
      items.forEach(function (el, k) { el.setAttribute('aria-selected', String(k === i)); });
      active = i; if (items[i]) { items[i].scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', items[i].id); }
    }
    function thumb(e) {
      var s = e.kind === 'story' ? e.item : (e.kind === 'person' && e.item.stories && e.item.stories[0]) || null;
      if (s && s.thumbnail) return h('span', { class: 'sp-ico' }, h('img', { src: s.thumbnail, alt: '' }));
      if (e.kind === 'person') return h('span', { class: 'sp-ico' }, U.initials(e.item.name));
      return h('span', { class: 'sp-ico' }, icon(e.kind === 'team' ? 'users' : e.kind === 'project' ? 'folder' : 'play'));
    }
    function label(e) {
      if (e.kind === 'story') return [e.item.headline || e.item.name, [e.item.name, e.item.team && e.item.team.name].filter(Boolean).join(' · ')];
      if (e.kind === 'person') return [e.item.name, [e.item.title, e.item.stories && e.item.stories.length ? U.plural(e.item.stories.length, 'story', 'stories') : 'Manager'].filter(Boolean).join(' · ')];
      if (e.kind === 'team') return [e.item.name, U.plural(e.item.stories.length, 'story', 'stories')];
      return [e.item.name, 'Project · ' + U.plural(e.item.stories.length, 'story', 'stories')];
    }
    function render() {
      var q = input.value.trim();
      if (!q) { close(); return; }
      var res = query(q), groups = [['person', 'People'], ['story', 'Stories'], ['team', 'Teams'], ['project', 'Projects']];
      items = []; var n = 0;
      var kids = groups.map(function (g) {
        var list = res.filter(function (e) { return e.kind === g[0]; }).slice(0, g[0] === 'story' ? 5 : 4);
        if (!list.length) return null;
        return h('div', { class: 'sp-group', role: 'group', 'aria-label': g[1] }, h('div', { class: 'sp-title' }, g[1]), list.map(function (e) {
          var l = label(e);
          var el = h('a', { class: 'sp-item', href: e.href, id: 'sp-' + (n++), role: 'option', 'aria-selected': 'false', onclick: function () { close(); input.value = ''; } },
            thumb(e), h('span', { class: 'sp-main' }, h('span', { class: 'sp-label' }, l[0]), h('span', { class: 'sp-sub' }, l[1])));
          items.push(el); return el;
        }));
      }).filter(Boolean);
      var all = h('a', { class: 'sp-all', href: '#/explore?q=' + encodeURIComponent(q), onclick: function () { close(); } }, 'See all results for “' + q + '”', icon('arrowRight'));
      panel.replaceChildren.apply(panel, kids.length ? kids.concat([all]) : [h('div', { class: 'sp-empty' }, 'No matches for “' + q + '”. Try a first name, a team or a topic.')]);
      panel.hidden = false; input.setAttribute('aria-expanded', 'true'); active = -1;
    }
    input.addEventListener('input', U.debounce(render, 90));
    input.addEventListener('focus', function () { if (input.value.trim()) render(); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (panel.hidden) render(); setActive(Math.min(items.length - 1, active + 1)); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(Math.max(0, active - 1)); }
      else if (ev.key === 'Enter') {
        ev.preventDefault();
        var q = input.value.trim();
        if (active >= 0 && items[active]) { go(items[active].getAttribute('href')); }
        else if (q) go('#/explore?q=' + encodeURIComponent(q));
        close(); input.blur();
      } else if (ev.key === 'Escape') { close(); input.blur(); }
    });
    document.addEventListener('click', function (ev) { if (!root.contains(ev.target)) close(); });
    document.addEventListener('keydown', function (ev) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
      if ((ev.key === 'k' || ev.key === 'K') && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); input.focus(); input.select(); }
      else if (ev.key === '/' && !typing) { ev.preventDefault(); input.focus(); }
    });
    return { input: input, close: close };
  }

  BTT.search = { index: index, query: query, storyMatches: storyMatches, mount: mount };
})();
