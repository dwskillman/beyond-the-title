# site/: the employee-facing website

Plain static files: `index.html`, `css/styles.css` and `js/*.js` (classic scripts, no build step, no frameworks, no CDNs).
It reads `data/stories.json`, `data/people.json` and `data/teams.json`, and shows **only stories with `"published": true`**.

| File | Purpose |
|---|---|
| `js/core.js` | DOM helper (text-only rendering), icons, utilities |
| `js/data.js` | Loads the JSON (or `data/site-data.js` when opened from disk) and builds people, team, project and manager indexes |
| `js/search.js` | Universal search (names, managers, teams, projects, tags, story text) and the ⌘K results panel |
| `js/video-player.js` | Native `<video>` player with poster, captions and jump-to-quote |
| `js/views.js` | Pages: home, Explore, story, People, person, Teams, team, Projects, project, Managers, manager |
| `js/app.js` | Hash router (`#/story/story-0001`). Works on any static server with no rewrite rules, and from disk |

**How it gets into a project folder:** the Content Builder carries these files and installs them
(Save & Export → Employee website → Install website files), or offers them as a zip.

**Opening from disk:** browsers block `fetch()` on `file://` pages, so the builder also writes `data/site-data.js`,
a script-tag copy of the data that includes caption text. On a web server the JSON files are used and that copy is ignored.
When opened from disk with drafts present, a **Preview drafts** button appears at the bottom of the page.

**Preview locally (dev machine):** `node tests/make-site-preview.mjs`, then open `test-output/site-preview/index.html`.
