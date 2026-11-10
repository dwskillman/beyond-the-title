/* Beyond the Title: router and startup.
   Hash URLs (#/story/…) work on any static server without rewrite rules, and from disk. */
(function () {
  'use strict';
  var BTT = window.BTT_SITE, h = BTT.h, icon = BTT.icon, U = BTT.util, V = BTT.views;
  var raw = null, data = null, lastSurprise = [];
  var view = document.getElementById('view');

  var NAV = [['', 'Home', 'home'], ['explore', 'Explore', 'compass'], ['people', 'People', 'users'], ['teams', 'Teams', 'layers'], ['projects', 'Projects', 'folder'], ['managers', 'Managers', 'org']];
  function renderNav(section) {
    var nav = document.getElementById('nav');
    nav.replaceChildren.apply(nav, NAV.map(function (n) {
      var active = section === n[0] || (n[0] === 'explore' && section === 'story') || (n[0] === 'people' && section === 'person') || (n[0] === 'teams' && section === 'team') || (n[0] === 'projects' && section === 'project') || (n[0] === 'managers' && section === 'manager');
      return h('a', { href: '#/' + n[0], 'aria-current': active ? 'page' : null, 'data-icon': active && n[2] === 'home' ? 'homeFill' : n[2] }, icon(active && n[2] === 'home' ? 'homeFill' : n[2]), h('span', null, n[1]));
    }).concat([h('div', { class: 'nav-sep', role: 'separator' }), h('a', { href: '#/surprise' }, icon('shuffle'), h('span', null, 'Surprise me'))]));
    document.getElementById('sidebar-foot').replaceChildren(h('p', null, 'Short videos from colleagues about their work, their projects and what they\'re proud of.'));
  }
  function renderFooter() {
    var f = document.getElementById('footer');
    var kids = [h('span', null, 'Beyond the Title · for internal use')];
    // Local preview only: drafts exist in the data file. Released copies contain published stories only.
    if (location.protocol === 'file:' && data && (data.unpublished || data.preview)) {
      kids.push(h('button', { type: 'button', class: 'btn btn-secondary btn-sm', 'data-testid': 'preview-toggle', onclick: function () { setPreview(!data.preview); } }, data.preview ? 'Hide drafts' : 'Preview drafts (' + data.unpublished + ')'));
    }
    f.replaceChildren.apply(f, kids);
  }
  function setPreview(on) {
    data = BTT.data.build(raw, on);
    BTT.search.index(data);
    var bar = document.getElementById('preview-bar');
    if (on && !bar) document.querySelector('.main').prepend(h('div', { class: 'preview-bar', id: 'preview-bar', role: 'status' }, icon('alert'), 'Preview: unpublished drafts are shown. Released copies of the site never include them.', h('button', { type: 'button', onclick: function () { setPreview(false); } }, 'Hide drafts')));
    if (!on && bar) bar.remove();
    route();
  }

  function parse() {
    var hash = (location.hash || '#/').slice(1) || '/';
    var qi = hash.indexOf('?');
    var path = (qi >= 0 ? hash.slice(0, qi) : hash).replace(/^\/+|\/+$/g, '');
    var params = new URLSearchParams(qi >= 0 ? hash.slice(qi + 1) : '');
    var parts = path.split('/').map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
    return { section: parts[0] || '', id: parts[1] || '', params: params };
  }
  function go(href) { if (location.hash === href) route(); else location.hash = href; }
  function surprise() {
    var pool = data.stories.filter(function (s) { return lastSurprise.indexOf(s.id) < 0; });
    if (!pool.length) { lastSurprise = []; pool = data.stories; }
    var s = pool[Math.floor(Math.random() * pool.length)];
    lastSurprise.push(s.id); if (lastSurprise.length > Math.max(1, Math.floor(data.stories.length / 2))) lastSurprise.shift();
    location.replace('#/story/' + s.id);
  }
  var TITLES = { '': 'Home', explore: 'Explore', people: 'People', teams: 'Teams', projects: 'Projects', managers: 'Managers' };
  function route() {
    if (!data) return;
    var r = parse(), nodes, title = TITLES[r.section];
    switch (r.section) {
      case '': nodes = V.home(data); break;
      case 'explore': nodes = V.explore(data, r.params); break;
      case 'story': nodes = V.story(data, r.id); var s = data.byId.get(r.id); title = s ? (s.headline || s.name) : 'Story'; break;
      case 'people': nodes = V.people(data); break;
      case 'person': nodes = V.person(data, r.id); var p = data.people.get(r.id); title = p ? p.name : 'Person'; break;
      case 'teams': nodes = V.teams(data); break;
      case 'team': nodes = V.team(data, r.id); var t = data.teams.get(r.id); title = t ? t.name : 'Team'; break;
      case 'projects': nodes = V.projects(data); break;
      case 'project': nodes = V.project(data, r.id); var pr = data.projects.get(r.id); title = pr ? pr.name : 'Project'; break;
      case 'managers': nodes = V.managers(data); break;
      case 'manager': nodes = V.manager(data, r.id); var m = data.people.get(r.id); title = m ? m.name : 'Manager'; break;
      case 'surprise': if (data.stories.length) { surprise(); return; } nodes = V.home(data); break;
      default: nodes = V.notFound(); title = 'Not found';
    }
    view.replaceChildren.apply(view, [].concat(nodes).filter(Boolean));
    document.title = (title ? title + ' · ' : '') + 'Beyond the Title';
    renderNav(r.section); renderFooter();
    window.scrollTo(0, 0);
    if (route.count++) view.focus({ preventScroll: true });
  }
  route.count = 0;

  function boot() {
    renderNav(parse().section);
    view.replaceChildren.apply(view, V.loading());
    BTT.data.load().then(function (r) {
      raw = r; data = BTT.data.build(raw, false);
      BTT.search.index(data);
      BTT.search.mount(document.getElementById('search'), data, go);
      window.addEventListener('hashchange', route);
      route();
      BTT.ready = true;
    }).catch(function (err) {
      view.replaceChildren.apply(view, V.error(err.message));
      BTT.ready = true; BTT.loadError = err.message;
    });
  }
  BTT.debug = { get data() { return data; }, setPreview: setPreview };
  boot();
})();
