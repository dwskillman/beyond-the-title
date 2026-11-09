/* Beyond the Title: data loading and indexes.
   On a web server (Syndicate) it reads data/*.json. Opened from disk (file://), browsers block
   fetch(), so it falls back to data/site-data.js, a script-tag copy the Content Builder writes.
   Only stories with "published": true are shown, unless local preview mode is switched on. */
(function () {
  'use strict';
  var BTT = window.BTT_SITE, U = BTT.util;

  function getJson(path) {
    return fetch(path, { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(path + ': HTTP ' + r.status);
      return r.json();
    });
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  /** → raw { stories, people, teams, captions, source } */
  function load() {
    var viaFetch = location.protocol === 'file:' ? Promise.reject(new Error('file')) :
      Promise.all([getJson('data/stories.json'), getJson('data/people.json'), getJson('data/teams.json')]).then(function (r) {
        if (!r[0]) throw new Error('data/stories.json was not found');
        return { stories: r[0], people: r[1], teams: r[2], captions: null, source: 'json' };
      });
    return viaFetch.catch(function (err) {
      return loadScript('data/site-data.js').then(function () {
        var d = window.BTT_SITE_DATA;
        if (!d || !d.stories) throw new Error('data/site-data.js is empty');
        return { stories: d.stories, people: d.people, teams: d.teams, captions: d.captions || null, source: 'script' };
      }).catch(function () {
        throw new Error(location.protocol === 'file:'
          ? 'This copy of the site has no data/site-data.js. Save the project from the Content Builder, then reopen this page.'
          : 'The story data could not be loaded (' + err.message + ').');
      });
    });
  }

  function listOf(doc, key) {
    if (Array.isArray(doc)) return key === 'stories' ? doc : [];
    return doc && Array.isArray(doc[key]) ? doc[key].filter(function (x) { return x && typeof x === 'object'; }) : [];
  }

  /** Build normalized, linked collections. `preview` includes unpublished stories (local preview only). */
  function build(raw, preview) {
    var peopleRaw = listOf(raw.people, 'people'), teamsRaw = listOf(raw.teams, 'teams');
    var people = new Map(), teams = new Map();
    peopleRaw.forEach(function (p) { if (typeof p.id === 'string') people.set(p.id, { id: p.id, name: String(p.name || p.id), title: p.title ? String(p.title) : '', teamId: p.teamId || null, managerId: p.managerId || null, isManager: !!p.isManager, stories: [] }); });
    teamsRaw.forEach(function (t) { if (typeof t.id === 'string') teams.set(t.id, { id: t.id, name: String(t.name || t.id), managerId: t.managerId || null, stories: [], people: new Set() }); });
    var allStories = listOf(raw.stories, 'stories');
    var unpublished = allStories.filter(function (s) { return s.published !== true; }).length;
    var stories = allStories
      .filter(function (s) { return typeof s.id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(s.id); })
      .filter(function (s) { return preview || s.published === true; })
      .map(function (s) {
        var person = people.get(s.personId);
        if (!person && typeof s.personId === 'string') { person = { id: s.personId, name: String(s.name || 'Unnamed'), title: s.role ? String(s.role) : '', teamId: s.teamId || null, managerId: s.managerId || null, isManager: false, stories: [] }; people.set(person.id, person); }
        var team = s.teamId ? teams.get(s.teamId) : null;
        if (!team && typeof s.teamId === 'string') { team = { id: s.teamId, name: s.teamId, managerId: null, stories: [], people: new Set() }; teams.set(team.id, team); }
        var mgr = s.managerId ? people.get(s.managerId) : null;
        if (!mgr && typeof s.managerId === 'string') { mgr = { id: s.managerId, name: s.managerId, title: '', teamId: null, managerId: null, isManager: true, stories: [] }; people.set(mgr.id, mgr); }
        if (mgr) mgr.isManager = true;
        var quoteStart = typeof s.quoteStart === 'number' ? s.quoteStart : U.parseTs(s.quoteTimestamp);
        var st = {
          id: s.id, person: person || null, name: String(s.name || (person && person.name) || 'Unnamed'), role: String(s.role || (person && person.title) || ''),
          team: team || null, manager: mgr || null,
          project: typeof s.project === 'string' && s.project.trim() ? s.project.trim() : null,
          headline: String(s.headline || ''), isQuote: s.headlineSource === 'quote', description: String(s.description || ''),
          quote: String(s.quote || ''), quoteStart: quoteStart,
          tags: Array.isArray(s.tags) ? s.tags.filter(function (t) { return typeof t === 'string' && t.trim(); }) : [],
          video: U.safePath(s.video), thumbnail: U.safePath(s.thumbnail), captions: U.safePath(s.captions),
          duration: typeof s.duration === 'number' ? s.duration : null,
          featured: s.featured === true, published: s.published === true, createdAt: s.createdAt || s.updatedAt || ''
        };
        st.projectSlug = st.project ? U.slug(st.project) : null;
        return st;
      });
    var projects = new Map();
    stories.forEach(function (st) {
      if (st.person) st.person.stories.push(st);
      if (st.team) { st.team.stories.push(st); if (st.person) st.team.people.add(st.person); }
      if (st.project) { var p = projects.get(st.projectSlug) || { slug: st.projectSlug, name: st.project, stories: [], people: new Set(), teams: new Set() }; p.stories.push(st); if (st.person) p.people.add(st.person); if (st.team) p.teams.add(st.team); projects.set(p.slug, p); }
    });
    var byId = new Map(stories.map(function (s) { return [s.id, s]; }));
    var newestFirst = stories.slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    var managers = Array.from(people.values()).filter(function (p) { return p.isManager; }).map(function (m) {
      var direct = stories.filter(function (s) { return s.manager === m; });
      var teamsLed = Array.from(teams.values()).filter(function (t) { return t.managerId === m.id; });
      return { person: m, stories: direct, teams: teamsLed };
    }).filter(function (m) { return m.stories.length || m.person.stories.length || m.teams.some(function (t) { return t.stories.length; }); });
    return {
      stories: stories, byId: byId, newestFirst: newestFirst, people: people, teams: teams, projects: projects, managers: managers,
      storytellers: Array.from(people.values()).filter(function (p) { return p.stories.length; }).sort(function (a, b) { return a.name.localeCompare(b.name); }),
      captions: raw.captions || null, preview: !!preview, unpublished: unpublished, source: raw.source
    };
  }

  BTT.data = { load: load, build: build };
})();
