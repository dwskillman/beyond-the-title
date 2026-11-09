# Roadmap

Development runs milestone by milestone. Each milestone ends with a commit, a push to the approved
private repository, a summary, the known limitations, and a **pause for feedback** before the next one starts.

## M1: Standalone Content Builder (current)

**Goal:** prove the content workflow on a locked-down corporate Mac with Chrome and nothing installed.

- [ ] Private repository, `.gitignore` that keeps real content out, docs skeleton
- [ ] `builder/builder.html`: one self-contained file, no dependencies, no network
- [ ] Browser capability diagnostics, with live tests for file pick, folder pick, folder write, download and clipboard
- [ ] TXT transcript import (drag-and-drop and multi-select), encoding detection, duplicate detection
- [ ] Pluggable transcript parser (cue/SRT/VTT-style, timestamped lines, speaker blocks, speaker lines, plain text)
- [ ] Keyword-based candidate statements (3) with context, timestamps and exact-quote checks
- [ ] Headline suggestions (exact quote plus theme templates) with source labels and review flags
- [ ] Optional "Copy for Copilot" prompt and paste-back parsing with quote checks
- [ ] Structured metadata form, live story card and featured preview
- [ ] Multiple stories; `stories.json` import and export with no data loss; validation
- [ ] Project folder: direct save (File System Access) → read-only folder fallback → export or zip fallback
- [ ] Built-in self-tests; optional headless E2E on the dev machine

**Exit criteria:** the user runs the builder on the corporate Mac with the four real Socialive transcripts
and reports back: the diagnostics report, the detected format, candidate quality, and whether save or export worked.

## M2: Content management improvements

- Tune the parser and analyzer against the four real Socialive transcripts, using the masked format samples
- Bulk and folder transcript import
- People & Teams management view (rename, merge, assign managers)
- Video support: match MP4s to stories, read duration, preview, capture a poster frame (Canvas), save or export the thumbnail
- VTT caption attachment and validation
- Missing-asset and mismatch report; reopen the last project folder
- Allow Published status once required assets are verified

## M3: Employee-facing website (`site/`)

Homepage, sidebar navigation, universal search (name, manager, team, project, keyword), featured story,
story cards, people directory, manager and team exploration, profiles, video player with captions,
Surprise Me, People to Discover, recently added, related stories, responsive layout, accessibility.
Everything loads from static JSON. No popularity metrics.

## M4: Publishing and deployment

A builder "Prepare release" step will:

- validate assets
- copy only **published** stories and their assets, leaving out drafts, transcripts if not needed, backups and the builder
- check links, JSON paths and missing media
- confirm there are no external resources
- produce a release folder or zip for Syndicate

If the browser can't do the packaging automatically, it falls back to a documented manual process.

## M5: Final testing and documentation

Admin guides: adding Socialive videos, importing transcripts, editing headlines, managers and teams,
featuring stories, updating JSON, previewing the site, preparing Syndicate releases, troubleshooting browser permissions.
