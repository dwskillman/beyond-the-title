# Architecture

## Goals and constraints

| Constraint | Consequence |
|---|---|
| Deployed to Syndicate, a conventional static web server | Only HTML, CSS, vanilla JS, JSON, images, captions and video. No server runtime or database |
| Locked-down corporate MacBook: Chrome, no admin rights, no installs | The admin tool is **one HTML file** that opens from disk (`file://`). No npm, no build step |
| No third-party network calls, CDNs or external AI | Everything is inline. A Content-Security-Policy blocks all network access in the builder |
| Browser features may be restricted by policy | Every capability is **feature-tested at runtime**, with graceful fallbacks |
| Employee content is sensitive | Real content stays outside git. Synthetic fixtures only. No transcripts in browser storage |

## The three folders

```
REPOSITORY (git, public)             PROJECT FOLDER (real content, NOT in git)     RELEASE (M4, uploaded to Syndicate)
beyond-the-title/                    e.g. ~/Documents/Beyond the Title Project/    a filtered copy:
├── builder/builder.html  ──opens──▶ ├── data/stories.json   (working DB, drafts)  ├── index.html, css/, js/  (from site/)
├── site/   (M3 website source)      ├── data/people.json                          ├── data/stories.json  (published only)
├── fixtures/ (synthetic only)       ├── data/teams.json                           └── stories/<id>/…     (published assets only)
├── tests/                           ├── stories/<story-id>/transcript.txt
└── docs/                            │                     video.mp4, captions.vtt, thumbnail.jpg (M2)
                                     └── backups/stories-<timestamp>.json
```

- **The project folder is the website root.** All asset paths in JSON are relative to it, for example
  `stories/story-0001/transcript.txt`, with no leading slash. That means the same JSON works at any URL prefix on Syndicate.
- **Working data and release data are separate.** The working `stories.json` contains drafts and links to raw
  transcripts. The M4 release step copies only published stories and their assets, and leaves out backups and the builder.
  Drafts never reach employees through a raw JSON request.
- **Assets are grouped per story** (`stories/<story-id>/`), not per employee, because one person can have several stories over time.

## Content Builder (`builder/builder.html`)

A single file with inline CSS and JS. It has no dependencies and works from `file://` in Chrome.

### Internal modules (namespaces in one script)

| Module | Responsibility |
|---|---|
| `Util` | DOM helper `h()` (text-only rendering), hashing (SHA-256), slugs, dates, downloads, clipboard |
| `Diagnostics` | Passive capability probes and click-to-run tests (file pick, folder pick, folder write, download, clipboard); report |
| `Decode` | Bytes → text: UTF-8 (with or without BOM), UTF-16 LE/BE, windows-1252 fallback |
| `Parser` | Pluggable `FORMATS` registry → segments `{start, startLabel, speaker, text, lineFrom, lineTo}` |
| `Analyzer` | Sentence units with offsets → theme scoring → top-3 diverse candidates, tags, project hints, confidence |
| `Headlines` | Exact-quote headline plus theme templates grounded in evidence; generic and weak flags |
| `Quote` | Verbatim checks against the transcript (whitespace and apostrophe tolerant only) |
| `Copilot` | Prompt builder; parser for the pasted response; quote checks |
| `Store` | In-memory project state, IDs, merge, validation, dirty tracking. Unknown fields preserved |
| `ProjectIO` | Direct (File System Access) / read-only folder (`webkitdirectory`) / standalone; save, backup, verify; export |
| `Zip` | Store-only ZIP writer and reader (CRC32) for the update package. Videos are streamed for the CRC, never copied into memory |
| `Media` | File-name matching, video probing (`<video>` metadata), frame capture (`<canvas>` → JPEG), VTT validation and generation. Attached files are kept in memory (as `File` references) until saved or exported |
| `Release` | Plans and assembles the published-only release (allow-listed fields, trimmed people and teams, link check), writes it to an empty or previous-release folder, or zips it |
| `FolderMemory` | The single use of browser storage: one `FileSystemDirectoryHandle` in IndexedDB for "Reopen last project". No content |
| `UI` | Hash router and views: Dashboard, Import, Stories, Story editor, Save & Export, Diagnostics |
| `SelfTest` | Built-in test suite (`#selftest`, or the button on the Diagnostics page) |

Pure functions are exposed on `window.BTT` for tests.

### Storage modes (picked automatically)

1. **Direct folder.** `showDirectoryPicker({mode: 'readwrite'})`. Saving works like this:
   1. A conflict check compares the file on disk with the hash taken at load.
   2. A confirmation modal lists every file that will be created or updated.
   3. The builder writes a backup of `stories.json`, then creates transcripts (it never overwrites silently), then writes the JSON files.
   4. It **reads everything back and verifies it** before reporting success.
2. **Read-only folder.** Used when the File System Access API is missing, blocked or denied.
   `<input webkitdirectory>` loads the JSON and an index of the assets present. Saving falls back to export.
3. **Standalone.** Import `stories.json` by hand, then export.

Export always works with no folder access. You can download `stories.json`, `people.json` and `teams.json`
one at a time, or as an **update package `.zip`** that also contains the new transcripts, laid out in project-folder structure.

### Security model

- CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src blob:; connect-src 'none'; form-action 'none'; base-uri 'none'`.
  Inline script is required for a single file. All network access is blocked.
- All transcript and JSON text is rendered with `textContent` and DOM APIs. `innerHTML` is used only for constant
  SVG icons, and `tests/check-static.mjs` enforces this.
- No browser storage of content. The only stored item is a folder shortcut (a directory handle) for "Reopen last project", in a module that `tests/check-static.mjs` isolates and checks. Unsaved work lives only in memory, and closing the tab warns you first.
- Folder access is only requested from explicit button clicks. Every write stays inside the folder you chose.
  IDs used in paths are restricted to `[a-z0-9-]`.
- Imported JSON is validated. Unknown fields are kept as data and never executed or rendered as HTML.

### Content integrity

- **The original transcript is the source of truth.** It is stored byte-for-byte as `stories/<id>/transcript.txt`, and its
  SHA-256 is recorded in `story.source.transcriptSha256`, so it can be checked with `shasum -a 256`.
- **Quotes must be exact substrings** of the transcript. Matching ignores only whitespace and straight versus curly apostrophes.
  The editor shows a live "Verbatim / Not found" badge, and Copilot quotes are checked the same way.
- **Headlines record where they came from** (`quote | template | copilot | manual`). Template headlines link to the sentence that supports them,
  and are flagged *Generic* or *Weak evidence* when the support is thin.
- Suggestions are labeled **keyword-based**. Nothing in the builder is described as AI.

## Employee website (`site/`)

Classic scripts, no build step or framework, hash routing, the same design tokens as the builder. See [site/README.md](../site/README.md).

- **Data:** over http(s) it reads `data/*.json` with relative `fetch()`. Opened from disk it loads `data/site-data.js` instead,
  a script-tag copy the builder writes on every save, including caption text, because browsers block `fetch()` and `<track>` on `file://`.
- **Visibility:** only `published === true`. Local preview can show drafts (the button appears only on `file://` when drafts exist).
- **Security:** CSP limits everything to the site's own files. All text is rendered with DOM APIs, and asset paths must be safe relative paths.
- **Distribution:** the builder embeds the site files (base64, kept in sync by `tests/embed-fixtures.mjs`) and installs or updates them in the
  project folder, never touching `data/`, `stories/` or `backups/`.

## Decision log

| # | Decision | Why |
|---|---|---|
| 1 | Builder is one HTML file | Opens directly from disk on a locked-down Mac; easy to move to another machine |
| 2 | One `people.json` with `isManager`, plus `teams.json` (instead of `managers.json`) | Managers record stories too; one identity per person |
| 3 | Assets grouped by story ID | One person can have several stories |
| 4 | `status` workflow plus a `published` boolean | `published` is the site's single switch; `status` drives the editorial flow. Invariant: `published === (status === "published")` |
| 5 | Working JSON and release JSON are separate (M4) | Drafts and transcripts never reach employees |
| 6 | No browser storage | Data-handling policy; in-memory state with an unsaved-changes guard |
| 7 | CSP enforced in the builder | Makes "no network" provable, not just promised |
| 8 | Media matched by file name, never guessed on ties | Socialive exports share a base name across .txt/.mp4/.vtt; wrong guesses would attach someone else's video |
| 9 | Thumbnails captured in the browser (Canvas → JPEG) | No FFmpeg or installs. Auto-captured, then the admin can pick a better frame |
| 11 | Hash routing (`#/story/…`) | Works on any static host with no rewrite rules, and from disk |
| 12 | `data/site-data.js` alongside the JSON | Lets the site open from disk on a locked-down Mac with no local server |
| 13 | Builder carries the website files | One file to move to the corporate Mac; installs or updates the site with one click |
| 14 | Release copies allow-listed fields only | Internal notes, transcript names, status and future fields can never leak by accident |
| 15 | Releases only go into empty or previous-release folders | Prevents uploading the working project by mistake; updating a release removes files only the previous release created (`.btt-release.json`) |
| 16 | Admin guide embedded as Help | The corporate Mac only has `builder.html` |
| 10 | Folder shortcut stored in IndexedDB | Saves re-navigating each session. It stores only a handle, Chrome still asks for permission, and it's easy to forget |
