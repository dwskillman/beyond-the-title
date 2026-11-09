# Roadmap

Development runs milestone by milestone. Each milestone ends with a commit, a push to the approved
repository, a summary, the known limitations, and a **pause for feedback** before the next one starts.

## M1: Standalone Content Builder (current)

**Goal:** prove the content workflow on a locked-down corporate Mac with Chrome and nothing installed.

- [x] Public repository (code, docs and synthetic fixtures only), `.gitignore` that keeps real content out, docs skeleton
- [x] `builder/builder.html`: one self-contained file, no dependencies, no network
- [x] Browser capability diagnostics, with live tests for file pick, folder pick, folder write, download and clipboard
- [x] TXT transcript import (drag-and-drop and multi-select), encoding detection, duplicate detection
- [x] Pluggable transcript parser (cue/SRT/VTT-style, timestamped lines, speaker blocks, speaker lines, plain text)
- [x] Keyword-based candidate statements (3) with context, timestamps and exact-quote checks
- [x] Headline suggestions (exact quote plus theme templates) with source labels and review flags
- [x] Optional "Copy for Copilot" prompt and paste-back parsing with quote checks
- [x] Structured metadata form, live story card and featured preview
- [x] Multiple stories; `stories.json` import and export with no data loss; validation
- [x] Project folder: direct save (File System Access) → read-only folder fallback → export or zip fallback
- [x] Built-in self-tests; optional headless E2E on the dev machine

**Exit criteria:** the user runs the builder on the corporate Mac with the four real Socialive transcripts
and reports back: the diagnostics report, the detected format, candidate quality, and whether save or export worked.

## M2: Content management improvements (v0.2.0)

- [x] ~~Tune the parser against the real Socialive transcripts~~. Not needed: the project owner confirmed the current parser handles their files. The Format override and masked sample tools remain if that ever changes.
- [x] Bulk import: whole Socialive export folders (picked or dropped), transcripts and media together
- [x] Match videos, captions and images to stories by file name (story ID, transcript name, full name). Ties are never guessed; unmatched files go to an assign list
- [x] Video: read duration and resolution, preview with captions, jump to the quote's timestamp
- [x] Thumbnails: auto-captured from the video, recapture any frame (Canvas), or import an image
- [x] VTT captions: attach and validate against the video length, or create from caption-style transcripts
- [x] Publishing: allowed once video and thumbnail exist in the folder or are attached; save and export include media
- [x] Media report: per-story asset status, missing files, unused files in the project folder, scan to link hand-copied files
- [x] People & Teams page: rename (propagates to stories), assign managers, merge duplicates, delete unused
- [x] Reopen the last project folder in one click (stores a folder shortcut only)

## M3: Employee-facing website (`site/`, v0.3.0)

- [x] Homepage modelled on the approved mockup: hero, Surprise me / Explore projects / Find my team, featured story (rotates daily among featured), People to discover (with shuffle), recently added, explore by team
- [x] Universal search (names, managers, teams, projects, tags, story text; accent-insensitive) with ⌘K / `/` and keyboard navigation
- [x] Explore page with team, manager, project and topic filters (shareable URLs)
- [x] Story pages: video player with captions and "Watch this moment" (jump to the quote), related stories
- [x] People directory, profiles, Teams, Projects, Managers (managers' own stories plus their team's stories)
- [x] Only `published` stories are shown. Drafts are visible only in local preview, with a clear banner
- [x] Works on any static server (hash routing) and from disk (via `data/site-data.js`); responsive; reduced motion; no popularity metrics
- [x] The builder installs and updates the site files and writes `data/site-data.js` on save

## M4: Release (v0.4.0)

- [x] **Release** page in the builder: checks, then a clean copy written to an empty folder (or a previous release folder) or downloaded as a zip
- [x] Only published stories; only the fields the site uses; only the people and teams they mention
- [x] No drafts, transcripts, backups, internal fields or builder; files of unpublished stories are removed when a release folder is updated
- [x] Checks: required fields, media present, captions valid, every data path included, website files complete
- [x] Release includes `data/site-data.js` so it can be previewed from disk before upload
- [x] Uploading to Syndicate is handled by the project owner

## M5: Documentation and final testing (v0.4.0)

- [x] [Admin guide](admin-guide.md): setup, Socialive videos, transcripts, quotes, headlines, managers and teams, featuring, publishing, saving, previewing, releases, backups, troubleshooting
- [x] The guide is built into the builder as **Help**, for the corporate Mac where only `builder.html` is available
- [x] Full test suite: built-in self-tests, builder E2E, website E2E, static checks
