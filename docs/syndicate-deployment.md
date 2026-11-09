# Syndicate deployment

The employee site is plain static files. Syndicate only needs to serve them; no server code runs.
Upload the **contents of the release folder** that the builder's **Release** page creates. It contains published stories only, and no builder, backups, transcripts or drafts.
The upload itself is handled by the project owner. The questions below are kept as a checklist.

## Release folder layout

```
index.html  css/styles.css  js/*.js
data/stories.json  data/people.json  data/teams.json  data/site-data.js
stories/<story-id>/video.mp4  thumbnail.jpg  captions.vtt
.btt-release.json   (list of released files, used to update the release later; harmless if uploaded)
```

## Checklist for the server

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

## What the site needs from the server

- Serve static files with correct types: `.html`, `.css`, `.js`, `.json`, `.jpg`, `.mp4` (`video/mp4`), `.vtt` (`text/vtt`).
- **Byte-range requests for `.mp4`** (for seeking).
- No rewrite rules: the site uses hash URLs (`index.html#/story/story-0001`).
- It requests only its own files: `index.html`, `css/`, `js/`, `data/`, `stories/`.

## Known requirements of the release

- Relative paths only (`data/stories.json`, `stories/<id>/video.mp4`).
- No external resources: no CDNs, fonts, analytics or third-party scripts.
- `index.html` at the release root.
