# Changelog

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
