# Changelog

## [0.5.1] - 2026-11-10: fixes after testing v0.5.0

### Fixed
- **Copilot prompt kept as separate lines when pasted.**
  - The copy now puts both plain text (with CRLF line breaks) and HTML (with `<br>` line breaks) on the clipboard, so rich-text inputs such as Copilot's keep every line.
  - The prompt also asks for one label per line.
  - A reply that still comes back as one paragraph is split at its labels before it's read.
- **Video imported with its transcript attaches automatically again.**
  - Importing one person at a time pairs their video (and captions) with their story, even when the file names differ.
  - Name matching also tries the speaker label, the self-introduction and a unique first name, and file names that share most of their words.
  - Ties, and leftover files in multi-person imports, are still never guessed.
- **Website card headlines are no longer clipped.** They are 15.5px, with room for descenders and up to three lines. The builder's preview card matches.

### Changed
- **Team is optional.**
  - Ready for review and Approved need name, job title, headline and description.
  - Copilot is asked for a team only when the directory lists a specific named team (NOT FOUND is expected otherwise).
  - The website hides the Team row when there's none.
- The builder only embeds the website's own files (`index.html`, `css/`, `js/`, the font licence), even if `site/` has been used as a project folder.

## [0.5.0] - 2026-11-09: owner feedback (Copilot lookup, auto-filled fields, descriptions, site design)

### Added
- **Copilot directory lookup:**
  - The Copilot prompt now names the employee, using the name they say in the video, and asks Copilot to look them up in the company directory for their **job title, team and manager**, and the manager's job title.
  - Copilot is told to write NOT FOUND rather than guess, and to explain in a directory note.
  - The name can be corrected before copying.
- **Copilot review:**
  - The pasted reply is listed field by field next to the story's current values, with one **Apply selected** button.
  - Empty and auto-filled fields are pre-selected. Typed values never are. A very different name is flagged as a possible wrong lookup.
  - Headlines and descriptions offer a choice of Copilot's three. Quotes must be verbatim. New teams and managers are created as people records.
- **Fields filled from the transcript on import:**
  - Name (from "My name is …" and "Hi, I'm …" introductions or the speaker label), headline, description, quote (verbatim), tags and project.
  - Each field shows where its value came from: *From transcript · review*, *From Copilot · verify*, *Written by hand*.
  - The new `fieldSources` story field records this. It is never released.
- **Description suggestions:**
  - The employee's exact words (checked against the transcript), plus templates built from the transcript's themes and project, plus Copilot's options.
  - **Use as description** for highlighted transcript text.
- **Employee site matched to the reference design:**
  - Colours and sizes measured from the image.
  - The three-stroke line marks beside the heading, the photo stack and the featured story.
  - White play buttons with dark triangles, flush card images, the lavender arc and sidebar waves.
  - Icons redrawn (filled Home, two-person People, layered Teams).
  - Bundled **Manrope** font (SIL OFL), embedded as `data:` URIs so it also works from disk.
- Help renders tables.
- Tests: 5 new self-tests (names, descriptions, Copilot prompt and parsing, auto-fill, review rules), 14 new builder E2E checks, 6 new website E2E checks (font over http and from disk, line marks, play buttons, icons), and font and CSP static checks.

### Changed
- The Copilot card is now the second card on each story, as three numbered steps.
- **Apply top suggestions** is renamed **Fill empty fields from transcript**.
- The builder's live preview cards match the new site cards.
- The email check in `check-static.mjs` is now linear time, because embedded font data made the old pattern very slow.

## [0.4.0] - 2026-11-09: Milestones 4–5 (release and admin guide)

### Added
- **Release** page:
  - Checks every published story (required fields, media present, captions valid) and builds a clean copy of the website.
  - Copies only published stories, only the fields the site uses, and only the people and teams they mention. No drafts, transcripts, backups, internal fields or builder.
  - Writes to an empty folder or updates a previous release folder (removing files of stories that are no longer published), or downloads a zip. Videos are streamed.
  - Every written file is read back and checked; links in the data are verified.
  - Refuses to write into the project folder or any non-empty folder that isn't a previous release.
- **Admin guide** (`docs/admin-guide.md`), also built into the builder as **Help** with a contents list.
- Tests: release self-tests (plan, assembly, blocking), release E2E (zip opened in Chrome; folder refusals; update removes unpublished files), and Help rendering safety.

### Changed
- Parser tuning to real Socialive files is closed: the project owner confirmed the current parser handles them.
- Syndicate upload is handled by the project owner; the deployment doc now describes the release layout and server checklist.

## [0.3.0] - 2026-11-09: Milestone 3 (employee website)

### Added
- **`site/`**: the employee-facing website. Static HTML, CSS and vanilla JS with no build step, hash routing, and CSP limited to its own files.
  - Homepage modelled on the approved mockup: hero, Surprise me / Explore projects / Find my team, a featured story that rotates daily, People to discover with shuffle, recently added, and explore by team.
  - Universal search across names, managers, teams, projects, tags and story text. Accent-insensitive, with ⌘K / `/` and keyboard navigation.
  - Explore with team, manager, project and topic filters.
  - Story pages: video with captions, "Watch this moment" (jumps to the quote), related stories.
  - People, profiles, Teams, Projects and Managers pages.
  - Only published stories are shown. Opened from disk, a "Preview drafts" mode shows the rest with a clear banner.
  - Responsive, keyboard-accessible, respects reduced motion. Empty, error and loading states.
- **Builder:** writes `data/site-data.js` on every save and in export packages (lets the site open from disk, captions included). Content is deterministic, so unchanged saves write nothing.
- **Builder:** an Employee website card installs or updates the embedded site files into the project folder (never touching data/stories/backups), or downloads them as a zip.
- Synthetic sample-site data and gradient thumbnails; `tests/make-site-preview.mjs`; `tests/site-e2e.mjs` (42 checks); static checks for the site; a guard against raw U+2028/2029 characters.

## [0.2.0] - 2026-11-09: Milestone 2 (video & content)

### Added
- **Bulk import:** pick or drop a whole Socialive export folder. Transcripts become stories; videos, captions and images are matched by file name (story ID, transcript name, or full name). Ties are never guessed. Unmatched files go to an assign list.
- **Video & media card** in the editor: preview with captions, length and resolution read by the browser, jump to the quote's timestamp, replace or remove.
- **Thumbnails:** auto-captured from the video (Canvas → JPEG), recapture from any paused frame, or import an image. Shown on the story card.
- **Captions:** attach WebVTT and validate it against the video length, or create captions from caption-style transcripts.
- **Publishing:** allowed once video and thumbnail exist in the folder or are attached.
- **Save and export with media:** direct save writes video, thumbnail and captions (size and content verified). The update package can include videos (streamed, not loaded into memory) or list them to copy by hand.
- **Media page:** per-story asset status, missing files, unused files in the project folder, and Scan project folder to link hand-copied files.
- **People & Teams page:** rename (propagates to stories), job titles, team and manager assignment, merge duplicates, delete unused records.
- **Reopen last project folder:** stores a folder shortcut only.
- Diagnostics live test: read a video and capture a frame.

### Changed
- The update package's instructions now say to copy files into existing story folders rather than replace them.
- A status change refreshes the editor, so the Published switch enables as soon as a story is approved.

### Tests
- 54 self-tests (9 new), 79 E2E checks (27 new, using a synthetic test-pattern MP4), and static checks that isolate the folder-shortcut storage.

## [0.1.0-builder] - 2026-11-09: Milestone 1

### Added
- `builder/builder.html`: standalone Content Builder (single file, no dependencies, no network, no browser storage).
  - Diagnostics: capability probes; live tests for file pick, folder read, folder write, read-only folder import, download and clipboard; copyable report; built-in self-tests.
  - Transcript import: drag-and-drop or multi-select `.txt`; UTF-8, UTF-16 and Windows-1252 decoding; duplicate detection by SHA-256.
  - Pluggable parser: caption cues (SRT/VTT style, including voice tags), timestamped lines, speaker and timestamp blocks, speaker-labelled lines, plain text. Format override and masked format sample.
  - Keyword-based (not AI) suggestions: three candidate statements with context and timestamps, a verbatim quote headline, theme templates (flagged generic or weak), tags and project hints.
  - Word-for-word quote verification. Headline source tracking.
  - Optional Copy for Copilot prompt plus reply parsing (Copilot quotes are verified).
  - Structured metadata form, people and teams registries (managers are people), live story card and featured preview, tiered validation.
  - JSON import and export that keeps unknown fields and key order; legacy array import; one-click duplicate-ID fix.
  - Project folder: direct save (File System Access) with backups, conflict detection and read-back verification; read-only folder fallback; update-package zip export.
- Synthetic fixtures, self-tests (45), dev-machine E2E (52 checks) and static checks.
- Architecture, data model, roadmap, publishing workflow, browser capabilities, Syndicate questions.
