# Beyond the Title

> You know their names. Discover their stories.

An internal employee storytelling and video-discovery experience. Short videos of
employees and managers talking about themselves, their projects and their proud
moments, presented as a bright, modern SaaS-style app.

The finished site is **pure static files** (HTML, CSS, vanilla JavaScript, JSON, media)
for an internal static web server (Syndicate). There is no server runtime, no database,
no build step, no framework and no third-party network requests.

## Status

| Milestone | Scope | State |
|---|---|---|
| **M1** | Repository, architecture, **standalone Content Builder** | ✅ Delivered and tested on the corporate Mac |
| **M2** | Video, thumbnails, captions, bulk import and matching, publishing, people & teams | ✅ Delivered (v0.2.0). Parser tuning waits for a masked Socialive sample |
| **M3** | Employee-facing website (`site/`), installed by the builder, previewable from disk | ✅ Delivered (v0.3.0) |
| **M4** | Release step: clean, published-only copy for upload (folder or zip) | ✅ Delivered (v0.4.0) |
| **M5** | Admin guide (also built into the builder as Help) and final testing | ✅ Delivered (v0.4.0) |

See [docs/roadmap.md](docs/roadmap.md).

**New here? Read the [admin guide](docs/admin-guide.md).** The same guide is built into the builder under **Help**.

## Quick start: Content Builder

1. Open `builder/builder.html` in Google Chrome. Drag the file onto a Chrome window, or use **File → Open File… (⌘O)**.
   Nothing needs to be installed and nothing is downloaded from the internet.
2. Open **Diagnostics** and run the checks to see what this browser allows.
3. Click **Try with sample data** to explore using synthetic transcripts, or go to **Import** and drop your Socialive files: `.txt` transcripts, plus `.mp4` videos and `.vtt` captions if you have them. A whole export folder works too.
4. Review the suggested statements, pick a headline, fill in the story details, and watch the live card preview.
5. Click **Open Project Folder** → **Save to Project**, or use **Save & Export** to download the JSON or an update package.
6. **Save & Export → Install website files**, then open the project folder's `index.html` to preview the site.
7. **Release** builds the clean, published-only copy that you upload to Syndicate.

The builder is a single self-contained file. Copy it to another machine using any method
your organization approves; it needs no other files.

## Repository layout

```
builder/builder.html   Standalone Content Builder (admin tool, never deployed)
site/                  Employee-facing website (static HTML/CSS/JS), installed into the project folder by the builder
fixtures/              Synthetic test data only: transcripts, JSON, a sample project folder
tests/                 Self-test runner, optional dev-machine E2E, static checks
docs/                  Architecture, data model, roadmap, workflow, deployment, browser notes
```

## Data-handling rules

- **Real employee content never goes in this repository.** That includes videos, transcripts, captions, thumbnails and working JSON.
  Keep the real project folder outside the repo (for example `~/Documents/Beyond the Title Project/`).
  `.gitignore` is a safety net, not the plan.
- All committed examples and tests use **synthetic** people and text.
- The builder makes **no network requests**. Its Content-Security-Policy blocks them, and it does not store
  transcripts in browser storage.
- The optional **Copy for Copilot** action only copies text to the clipboard when you click it.
  You are responsible for following company information-handling policy for anything you paste elsewhere.

## Documentation

- [Admin guide](docs/admin-guide.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Roadmap](docs/roadmap.md)
- [Publishing workflow](docs/publishing-workflow.md)
- [Browser capabilities & troubleshooting](docs/browser-capabilities.md)
- [Syndicate deployment (open questions)](docs/syndicate-deployment.md)
- [Testing](tests/README.md)
