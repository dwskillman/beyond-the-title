# Syndicate deployment (Milestone 4: open questions)

The employee site will be plain static files. Syndicate only needs to serve them; no server code runs.
The **release folder** (built in Milestone 4) is what gets uploaded. It contains published stories only, and no builder, backups or drafts.

## Questions for the Syndicate administrators

| # | Question | Why it matters |
|---|---|---|
| 1 | How are files uploaded (web form, network share, sync tool)? Can a whole folder be uploaded at once? | Determines the release step and how big each update is |
| 2 | Are `.json`, `.vtt` and `.mp4` served with correct MIME types (`application/json`, `text/vtt`, `video/mp4`)? | Captions often fail silently with the wrong `.vtt` type |
| 3 | Does the server support HTTP byte-range requests for video? | Needed for seeking and fast start of MP4 playback |
| 4 | What are the file size and total storage limits? | Short videos at 1080p are roughly 20–80 MB each |
| 5 | Is the site behind single sign-on? Do relative URLs and `fetch()` of JSON work behind it? | The site loads `data/*.json` with relative URLs |
| 6 | What URL prefix will the site live under? | All paths are relative, so any prefix works. Confirming avoids surprises |
| 7 | Caching rules for `.json` (how quickly updates appear)? | May need cache-busting on `data/*.json` |
| 8 | Is directory listing disabled? | Prevents browsing unpublished folders if any were uploaded by mistake |
| 9 | Are there content scanning or approval steps on upload? | Affects publishing time |

## Known requirements of the release

- Relative paths only (`data/stories.json`, `stories/<id>/video.mp4`).
- No external resources: no CDNs, fonts, analytics or third-party scripts.
- `index.html` at the release root.
