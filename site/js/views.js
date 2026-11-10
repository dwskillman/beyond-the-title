/* Beyond the Title: pages and components. */
(function () {
  'use strict';
  var BTT = window.BTT_SITE, h = BTT.h, icon = BTT.icon, U = BTT.util;

  /* ---------- components ---------- */
  function headlineText(s) { return s.headline ? (s.isQuote ? '“' + s.headline.replace(/^["“]|["”.]$/g, '') + '”' : s.headline) : s.name; }
  function metaText(s) { return [s.name, s.team ? s.team.name : s.role].filter(Boolean).join(' · '); }
  function personThumb(p) { var s = p && p.stories && p.stories.find(function (x) { return x.thumbnail; }); return s ? s.thumbnail : null; }
  function avatar(p, cls) {
    var t = personThumb(p);
    return h('span', { class: 'avatar' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' }, t ? h('img', { src: t, alt: '' }) : U.initials(p ? p.name : '?'));
  }
  function storyCard(s) {
    var media = h('div', { class: 'card-media' },
      s.thumbnail ? h('img', { src: s.thumbnail, alt: '', loading: 'lazy' }) : h('span', { class: 'ini', 'aria-hidden': 'true' }, U.initials(s.name)),
      s.video ? h('span', { class: 'play', 'aria-hidden': 'true' }, icon('play')) : null,
      s.duration ? h('span', { class: 'dur' }, U.clock(s.duration)) : null,
      !s.published ? h('span', { class: 'card-flag draft' }, 'Draft (preview)') : s.featured ? h('span', { class: 'card-flag' }, '★ Featured') : null);
    return h('a', { class: 'card', href: '#/story/' + s.id, 'data-testid': 'story-card', 'aria-label': headlineText(s) + '. ' + metaText(s) },
      media, h('div', { class: 'card-body' }, h('div', { class: 'card-title' }, headlineText(s)), h('div', { class: 'card-meta' }, metaText(s))));
  }
  function grid(list, cls) { return h('div', { class: 'grid' + (cls ? ' ' + cls : ''), 'data-testid': 'story-grid' }, list.map(storyCard)); }
  function sectionHead(title, sub, link) {
    return h('div', { class: 'section-head' }, h('div', null, h('h2', null, title), sub ? h('p', null, sub) : null), link || null);
  }
  function more(label, href) { return h('a', { class: 'link-more', href: href }, label, icon('arrowRight')); }
  function pageHead(eyebrow, title, sub, extra) {
    return h('div', { class: 'page-head' }, h('div', null, eyebrow ? h('div', { class: 'eyebrow' }, eyebrow) : null, h('h1', null, title), sub ? h('p', null, sub) : null), extra || null);
  }
  function crumbs(parts) {
    var out = [];
    parts.forEach(function (p, i) { if (i) out.push(icon('chevronRight')); out.push(p[1] ? h('a', { href: p[1] }, p[0]) : h('span', { 'aria-current': 'page' }, p[0])); });
    return h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, out);
  }
  function empty(iconName, title, text, action) {
    return h('div', { class: 'empty' }, h('div', { class: 'empty-ico' }, icon(iconName)), h('h2', null, title), text ? h('p', null, text) : null, action || null);
  }
  function tagChip(t) { return h('a', { class: 'chip', href: '#/explore?tag=' + encodeURIComponent(t) }, icon('tag'), t); }
  function personLink(p, sub) {
    if (!p) return null;
    var href = p.stories && p.stories.length ? '#/person/' + encodeURIComponent(p.id) : '#/manager/' + encodeURIComponent(p.id);
    return h('a', { class: 'person', href: href }, avatar(p), h('div', null, h('b', null, p.name), sub ? h('span', null, sub) : null));
  }
  function related(d, s, n) {
    var scored = d.stories.filter(function (x) { return x !== s; }).map(function (x) {
      var sc = 0;
      if (s.project && x.project === s.project) sc += 5;
      if (s.team && x.team === s.team) sc += 3;
      if (s.manager && x.manager === s.manager) sc += 1;
      x.tags.forEach(function (t) { if (s.tags.indexOf(t) >= 0) sc += 1; });
      return { x: x, sc: sc + Math.random() * 0.5 };
    }).sort(function (a, b) { return b.sc - a.sc; });
    return scored.slice(0, n || 4).map(function (y) { return y.x; });
  }
  function pickFeatured(d) {
    var feats = d.stories.filter(function (s) { return s.featured; });
    if (feats.length) return feats[U.dayNumber() % feats.length]; // rotates daily
    return d.newestFirst.find(function (s) { return s.thumbnail; }) || d.newestFirst[0] || null;
  }

  /* ---------- home ---------- */
  function home(d) {
    if (!d.stories.length) return [heroBlock(d, []), empty('play', 'Stories are on their way', 'No stories have been published yet. Check back soon to meet your colleagues.')];
    var featured = pickFeatured(d);
    var others = d.stories.filter(function (s) { return s !== featured; });
    var discoverGrid = h('div', { class: 'grid grid-4', 'data-testid': 'discover' });
    function shuffleDiscover() { discoverGrid.replaceChildren.apply(discoverGrid, U.shuffle(others).slice(0, 4).map(storyCard)); }
    shuffleDiscover();
    var withPhotos = U.shuffle(d.stories.filter(function (s) { return s.thumbnail; })).concat(U.shuffle(d.stories.filter(function (s) { return !s.thumbnail; }))).slice(0, 3);
    var recent = d.newestFirst.filter(function (s) { return s !== featured; }).slice(0, 4);
    var teamsWithStories = Array.from(d.teams.values()).filter(function (t) { return t.stories.length; }).sort(function (a, b) { return b.stories.length - a.stories.length; }).slice(0, 6);
    return [
      heroBlock(d, withPhotos),
      h('div', { class: 'tiles' },
        h('a', { class: 'tile', href: '#/surprise', 'data-testid': 'surprise' }, h('span', { class: 'tile-ico' }, icon('shuffle')), h('span', null, h('b', null, 'Surprise me'), h('span', null, 'Meet someone new')), icon('arrowRight', 'go')),
        h('a', { class: 'tile', href: '#/projects' }, h('span', { class: 'tile-ico' }, icon('folder')), h('span', null, h('b', null, 'Explore projects'), h('span', null, 'See what we\'ve built')), icon('arrowRight', 'go')),
        h('a', { class: 'tile', href: '#/teams' }, h('span', { class: 'tile-ico' }, icon('users')), h('span', null, h('b', null, 'Find my team'), h('span', null, 'Browse by manager or team')), icon('arrowRight', 'go'))),
      featured ? featuredBlock(featured) : null,
      others.length ? h('section', { class: 'section', 'aria-labelledby': 'discover-h' },
        h('div', { class: 'section-head' }, h('div', null, h('h2', { id: 'discover-h' }, 'People to discover')),
          h('div', { class: 'row', style: { gap: '14px' } }, others.length > 4 ? h('button', { type: 'button', class: 'icon-btn', title: 'Show me others', 'aria-label': 'Show me other people', 'data-testid': 'shuffle-discover', onclick: shuffleDiscover }, icon('refresh')) : null, more('View all people', '#/people'))),
        discoverGrid) : null,
      recent.length ? h('section', { class: 'section' }, sectionHead('Recently added', 'The newest stories.', more('Explore all stories', '#/explore')), grid(recent, 'grid-4')) : null,
      teamsWithStories.length ? h('section', { class: 'section' }, sectionHead('Explore by team', null, more('All teams', '#/teams')), h('div', { class: 'entity-grid' }, teamsWithStories.map(teamTile))) : null
    ];
  }
  function heroBlock(d, photos) {
    return h('section', { class: 'hero', 'aria-label': 'Welcome' },
      h('div', { class: 'hero-copy' }, h('h1', null, 'You know their names.', h('span', { class: 'accent' }, 'Discover their stories.'), BTT.spark()),
        h('p', null, 'Get to know the people, projects, and proud moments that make our team unique.')),
      photos.length ? h('div', { class: 'hero-stack', 'aria-hidden': 'true' }, photos.map(function (s, i) {
        // As in the reference, the photo on top of the stack and the one to its left carry a play button.
        return h('a', { class: 'hero-photo', href: '#/story/' + s.id, tabindex: '-1' }, s.thumbnail ? h('img', { src: s.thumbnail, alt: '' }) : h('span', { class: 'ini' }, U.initials(s.name)), s.video && i < 2 ? h('span', { class: 'play' }, icon('play')) : null);
      }), photos.length > 2 ? BTT.spark() : null) : null);
  }
  function featuredBlock(s) {
    return h('section', { class: 'featured', 'aria-label': 'Featured story', 'data-testid': 'featured' },
      h('a', { class: 'feat-media', href: '#/story/' + s.id, 'aria-label': 'Watch: ' + headlineText(s) },
        s.thumbnail ? h('img', { src: s.thumbnail, alt: '' }) : h('span', { class: 'ini' }, U.initials(s.name)),
        h('span', { class: 'play' }, icon('play')), s.duration ? h('span', { class: 'dur' }, U.clock(s.duration)) : null),
      h('div', { class: 'feat-panel' }, BTT.spark(),
        h('span', { class: 'feat-badge' }, icon('star'), 'Featured Story'),
        h('h2', null, h('a', { href: '#/story/' + s.id }, headlineText(s))),
        s.description ? h('p', null, s.description) : null,
        h('div', { class: 'feat-row' }, personLink(s.person, s.role || (s.team && s.team.name)),
          s.project ? h('span', { class: 'feat-sep', 'aria-hidden': 'true' }) : null,
          s.project ? h('a', { class: 'proj', href: '#/project/' + s.projectSlug }, icon('folder'), 'Project: ' + s.project) : null,
          h('a', { class: 'btn btn-primary', href: '#/story/' + s.id }, icon('play'), 'Watch now'))));
  }
  function teamTile(t) {
    var faces = Array.from(t.people).slice(0, 5);
    return h('a', { class: 'entity', href: '#/team/' + encodeURIComponent(t.id) }, h('span', { class: 'ent-ico' }, icon('users')),
      h('div', null, h('b', null, t.name), h('span', null, U.plural(t.stories.length, 'story', 'stories')), faces.length ? h('div', { class: 'faces' }, faces.map(function (p) { return avatar(p); })) : null));
  }

  /* ---------- explore ---------- */
  function explore(d, params) {
    var state = { q: params.get('q') || '', team: params.get('team') || '', manager: params.get('manager') || '', project: params.get('project') || '', tag: params.get('tag') || '' };
    var q = h('input', { type: 'search', placeholder: 'Search stories…', value: state.q, 'aria-label': 'Search stories', 'data-testid': 'explore-q' });
    var sel = function (key, label, opts) {
      return h('select', { 'aria-label': label, 'data-testid': 'filter-' + key, onchange: function (e) { state[key] = e.target.value; apply(); } },
        h('option', { value: '' }, label), opts.map(function (o) { return h('option', { value: o[0], selected: o[0] === state[key] }, o[1]); }));
    };
    var teams = Array.from(d.teams.values()).filter(function (t) { return t.stories.length; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var tagCounts = new Map(); d.stories.forEach(function (s) { s.tags.forEach(function (t) { tagCounts.set(t, (tagCounts.get(t) || 0) + 1); }); });
    var tags = Array.from(tagCounts.entries()).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); }).slice(0, 14).map(function (x) { return x[0]; });
    if (state.tag && tags.indexOf(state.tag) < 0) tags.unshift(state.tag);
    var tagRow = h('div', { class: 'tags', role: 'group', 'aria-label': 'Filter by topic' });
    function renderTags() { tagRow.replaceChildren.apply(tagRow, tags.map(function (t) { return h('button', { type: 'button', class: 'chip chip-outline', 'aria-pressed': String(state.tag === t), onclick: function () { state.tag = state.tag === t ? '' : t; apply(); } }, t); })); }
    var count = h('p', { class: 'result-count', 'aria-live': 'polite', 'data-testid': 'result-count' });
    var results = h('div');
    function apply() {
      var list = state.q.trim() ? BTT.search.storyMatches(state.q) : d.newestFirst.slice();
      list = list.filter(function (s) {
        return (!state.team || (s.team && s.team.id === state.team)) && (!state.manager || (s.manager && s.manager.id === state.manager)) &&
          (!state.project || s.projectSlug === state.project) && (!state.tag || s.tags.indexOf(state.tag) >= 0);
      });
      count.textContent = U.plural(list.length, 'story', 'stories') + (state.q ? ' matching “' + state.q.trim() + '”' : '');
      results.replaceChildren(list.length ? grid(list) : empty('search', 'No stories match', 'Try fewer words, or clear a filter.', h('a', { class: 'btn btn-secondary', href: '#/explore' }, 'Clear search and filters')));
      renderTags();
      var qs = Object.keys(state).filter(function (k) { return state[k]; }).map(function (k) { return k + '=' + encodeURIComponent(state[k]); }).join('&');
      history.replaceState(null, '', '#/explore' + (qs ? '?' + qs : ''));
    }
    q.addEventListener('input', U.debounce(function () { state.q = q.value; apply(); }, 150));
    apply();
    return [
      pageHead('Explore', 'All stories', 'Search by name, manager, team, project or topic, or narrow things down with the filters.'),
      h('div', { class: 'filters' },
        h('label', { class: 'field grow' }, icon('search'), q),
        sel('team', 'All teams', teams.map(function (t) { return [t.id, t.name]; })),
        sel('manager', 'All managers', d.managers.map(function (m) { return [m.person.id, m.person.name]; }).sort(function (a, b) { return a[1].localeCompare(b[1]); })),
        d.projects.size ? sel('project', 'All projects', Array.from(d.projects.values()).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (p) { return [p.slug, p.name]; })) : null),
      tags.length ? h('div', { style: { marginBottom: '20px' } }, tagRow) : null,
      count, results
    ];
  }

  /* ---------- story ---------- */
  function story(d, id) {
    var s = d.byId.get(id);
    if (!s) return notFound('That story isn\'t available. It may have been unpublished.');
    var player = BTT.player.create(s, d);
    var rel = related(d, s, 4);
    var quote = s.quote ? h('figure', { class: 'quote' }, h('blockquote', null, '“' + s.quote.replace(/^["“]|["”]$/g, '') + '”'),
      h('figcaption', { class: 'row' }, h('span', { class: 'muted small' }, '— ' + s.name),
        typeof s.quoteStart === 'number' && s.video ? h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: function () { player.seek(s.quoteStart); } }, icon('play'), 'Watch this moment · ' + U.clock(s.quoteStart)) : null)) : null;
    var dl = h('dl', { class: 'kv' },
      h('dt', null, 'Role'), h('dd', null, s.role || '—'),
      h('dt', null, 'Team'), h('dd', null, s.team ? h('a', { href: '#/team/' + encodeURIComponent(s.team.id) }, s.team.name) : '—'),
      h('dt', null, 'Manager'), h('dd', null, s.manager ? h('a', { href: '#/manager/' + encodeURIComponent(s.manager.id) }, s.manager.name) : '—'),
      s.project ? [h('dt', null, 'Project'), h('dd', null, h('a', { href: '#/project/' + s.projectSlug }, s.project))] : null,
      s.duration ? [h('dt', null, 'Length'), h('dd', null, U.clock(s.duration))] : null);
    return [
      crumbs([['Home', '#/'], ['Stories', '#/explore'], [s.name]]),
      !s.published ? h('p', null, h('span', { class: 'chip chip-draft' }, 'Draft: only visible in local preview')) : null,
      h('article', { class: 'story', 'data-testid': 'story-page' },
        h('div', null, player.el,
          h('h1', null, headlineText(s)),
          h('div', { class: 'row', style: { gap: '16px' } }, personLink(s.person, [s.role, s.team && s.team.name].filter(Boolean).join(' · '))),
          s.description ? h('p', { class: 'desc', style: { marginTop: '16px' } }, s.description) : null,
          quote,
          s.tags.length ? h('div', { class: 'tags' }, s.tags.map(tagChip)) : null),
        h('aside', { class: 'side' },
          h('section', { class: 'side-card' }, h('h2', null, 'About ' + s.name.split(' ')[0]), dl,
            s.person && s.person.stories.length > 1 ? more('All ' + s.person.stories.length + ' stories from ' + s.name.split(' ')[0], '#/person/' + encodeURIComponent(s.person.id)) : null),
          h('a', { class: 'btn btn-primary', href: '#/surprise' }, icon('shuffle'), 'Surprise me with another story'))),
      rel.length ? h('section', { class: 'section', style: { marginTop: '40px' } }, sectionHead('Related stories', s.project ? 'More from the same project, team and topics.' : 'More from the same team and topics.'), grid(rel, 'grid-4')) : null
    ];
  }

  /* ---------- people ---------- */
  function personCard(p) {
    var s0 = p.stories[0];
    return h('a', { class: 'entity', href: '#/person/' + encodeURIComponent(p.id), 'data-testid': 'person-card' }, h('span', { class: 'ent-ico' }, personThumb(p) ? h('img', { src: personThumb(p), alt: '' }) : U.initials(p.name)),
      h('div', null, h('b', null, p.name), h('span', null, [p.title || (s0 && s0.role), s0 && s0.team && s0.team.name].filter(Boolean).join(' · '))));
  }
  function people(d) {
    var input = h('input', { type: 'search', placeholder: 'Filter by name…', 'aria-label': 'Filter people by name' });
    var list = h('div', { class: 'entity-grid' });
    function apply() {
      var q = U.norm(input.value.trim());
      var ppl = d.storytellers.filter(function (p) { return !q || U.norm(p.name).indexOf(q) >= 0 || U.norm(p.title).indexOf(q) >= 0; });
      list.replaceChildren.apply(list, ppl.length ? ppl.map(personCard) : [empty('user', 'Nobody matches that name', null)]);
    }
    input.addEventListener('input', U.debounce(apply, 100));
    apply();
    return [pageHead('People', 'People', U.plural(d.storytellers.length, 'colleague has', 'colleagues have') + ' shared their story so far.'),
      h('div', { class: 'filters' }, h('label', { class: 'field grow' }, icon('search'), input)), list];
  }
  function person(d, id) {
    var p = d.people.get(id);
    if (!p || !p.stories.length) return d.managers.some(function (m) { return m.person.id === id; }) ? manager(d, id) : notFound('That person doesn\'t have a published story yet.');
    var s0 = p.stories[0];
    var teamIds = new Set(p.stories.map(function (s) { return s.team && s.team.id; }));
    var more2 = d.stories.filter(function (s) { return s.person !== p && s.team && teamIds.has(s.team.id); }).slice(0, 4);
    return [crumbs([['Home', '#/'], ['People', '#/people'], [p.name]]),
      h('section', { class: 'profile', 'data-testid': 'profile' }, avatar(p, 'lg'), h('div', null, h('h1', null, p.name), h('p', null, p.title || s0.role),
        h('div', { class: 'row', style: { marginTop: '10px' } },
          s0.team ? h('a', { class: 'chip', href: '#/team/' + encodeURIComponent(s0.team.id) }, icon('users'), s0.team.name) : null,
          s0.manager ? h('a', { class: 'chip chip-outline', href: '#/manager/' + encodeURIComponent(s0.manager.id) }, icon('org'), 'Manager: ' + s0.manager.name) : null))),
      h('section', { class: 'section' }, sectionHead(p.stories.length > 1 ? 'Stories' : 'Story'), grid(p.stories)),
      more2.length ? h('section', { class: 'section' }, sectionHead('More from ' + (s0.team ? s0.team.name : 'the team')), grid(more2, 'grid-4')) : null];
  }

  /* ---------- teams ---------- */
  function teams(d) {
    var list = Array.from(d.teams.values()).filter(function (t) { return t.stories.length; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    return [pageHead('Teams', 'Find my team', 'Browse stories by team, or by manager.', more('Browse by manager', '#/managers')),
      list.length ? h('div', { class: 'entity-grid', 'data-testid': 'teams' }, list.map(function (t) {
        var m = t.managerId ? d.people.get(t.managerId) : null;
        var faces = Array.from(t.people).slice(0, 5);
        return h('a', { class: 'entity', href: '#/team/' + encodeURIComponent(t.id) }, h('span', { class: 'ent-ico' }, icon('users')),
          h('div', null, h('b', null, t.name), h('span', null, [m ? 'Led by ' + m.name : null, U.plural(t.stories.length, 'story', 'stories')].filter(Boolean).join(' · ')), faces.length ? h('div', { class: 'faces' }, faces.map(function (p) { return avatar(p); })) : null));
      })) : empty('users', 'No teams yet', 'Teams appear here once their stories are published.')];
  }
  function team(d, id) {
    var t = d.teams.get(id);
    if (!t || !t.stories.length) return notFound('That team doesn\'t have any published stories yet.');
    var m = t.managerId ? d.people.get(t.managerId) : null;
    return [crumbs([['Home', '#/'], ['Teams', '#/teams'], [t.name]]),
      pageHead('Team', t.name, U.plural(t.stories.length, 'story', 'stories') + ' from ' + U.plural(t.people.size, 'person', 'people') + '.', m ? personLink(m, 'Team manager') : null),
      grid(t.stories)];
  }

  /* ---------- projects ---------- */
  function projects(d) {
    var list = Array.from(d.projects.values()).sort(function (a, b) { return b.stories.length - a.stories.length || a.name.localeCompare(b.name); });
    return [pageHead('Projects', 'Explore projects', 'See what colleagues have built, and who built it.'),
      list.length ? h('div', { class: 'entity-grid', 'data-testid': 'projects' }, list.map(function (p) {
        var s = p.stories.find(function (x) { return x.thumbnail; });
        return h('a', { class: 'entity', href: '#/project/' + p.slug }, h('span', { class: 'ent-ico' }, s ? h('img', { src: s.thumbnail, alt: '' }) : icon('folder')),
          h('div', null, h('b', null, p.name), h('span', null, [Array.from(p.teams).map(function (t) { return t.name; }).join(', '), U.plural(p.stories.length, 'story', 'stories')].filter(Boolean).join(' · '))));
      })) : empty('folder', 'No projects yet', 'Projects appear here when published stories name one.')];
  }
  function project(d, slug) {
    var p = d.projects.get(slug);
    if (!p) return notFound('That project doesn\'t have any published stories.');
    return [crumbs([['Home', '#/'], ['Projects', '#/projects'], [p.name]]),
      pageHead('Project', p.name, 'With ' + Array.from(p.people).map(function (x) { return x.name; }).join(', ') + '.'), grid(p.stories)];
  }

  /* ---------- managers ---------- */
  function managers(d) {
    var list = d.managers.slice().sort(function (a, b) { return a.person.name.localeCompare(b.person.name); });
    return [pageHead('Managers', 'Browse by manager', 'Stories from each manager\'s team. Managers share their own stories too.', more('Browse by team', '#/teams')),
      list.length ? h('div', { class: 'entity-grid', 'data-testid': 'managers' }, list.map(function (m) {
        return h('a', { class: 'entity', href: '#/manager/' + encodeURIComponent(m.person.id) }, h('span', { class: 'ent-ico' }, personThumb(m.person) ? h('img', { src: personThumb(m.person), alt: '' }) : U.initials(m.person.name)),
          h('div', null, h('b', null, m.person.name), h('span', null, [m.person.title, m.teams.map(function (t) { return t.name; }).join(', '), U.plural(m.stories.length, 'team story', 'team stories')].filter(Boolean).join(' · '))));
      })) : empty('org', 'No managers yet', null)];
  }
  function manager(d, id) {
    var m = d.managers.find(function (x) { return x.person.id === id; });
    if (!m) return notFound('That manager doesn\'t have any published stories from their team yet.');
    var own = m.person.stories;
    return [crumbs([['Home', '#/'], ['Managers', '#/managers'], [m.person.name]]),
      h('section', { class: 'profile' }, avatar(m.person, 'lg'), h('div', null, h('div', { class: 'eyebrow' }, 'Manager'), h('h1', null, m.person.name), h('p', null, m.person.title),
        m.teams.length ? h('div', { class: 'row', style: { marginTop: '10px' } }, m.teams.map(function (t) { return h('a', { class: 'chip', href: '#/team/' + encodeURIComponent(t.id) }, icon('users'), t.name); })) : null)),
      own.length ? h('section', { class: 'section' }, sectionHead('Their own story'), grid(own)) : null,
      m.stories.length ? h('section', { class: 'section' }, sectionHead('Stories from their team', U.plural(m.stories.length, 'story', 'stories') + ' from people who report to ' + m.person.name.split(' ')[0] + '.'), grid(m.stories)) : null];
  }

  /* ---------- states ---------- */
  function notFound(text) { return [empty('search', 'Not found', text || 'That page doesn\'t exist.', h('a', { class: 'btn btn-primary', href: '#/' }, 'Go to the homepage'))]; }
  function loading() {
    var sk = function (hgt) { return h('div', { class: 'skeleton', style: { height: hgt } }); };
    return [h('div', { class: 'hero', 'aria-busy': 'true' }, h('div', null, sk('110px'), h('div', { style: { height: '16px' } }), sk('48px')), sk('240px')),
      h('div', { class: 'tiles' }, sk('104px'), sk('104px'), sk('104px')), h('div', { class: 'grid grid-4' }, sk('220px'), sk('220px'), sk('220px'), sk('220px'))];
  }
  function error(msg) { return [empty('alert', 'The stories couldn\'t be loaded', msg, h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { location.reload(); } }, icon('refresh'), 'Try again'))]; }

  BTT.views = { home: home, explore: explore, story: story, people: people, person: person, teams: teams, team: team, projects: projects, project: project, managers: managers, manager: manager, notFound: notFound, loading: loading, error: error, storyCard: storyCard, related: related };
})();
