# Changelog

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
