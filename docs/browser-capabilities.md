# Browser capabilities & troubleshooting

The Content Builder is a single HTML file opened straight from disk (`file://`) in Google Chrome. Corporate browser
policies can switch off features even when Chrome supports them, so the builder **tests real capabilities at runtime**
and falls back gracefully. Open **Diagnostics** to see the results, then use **Copy diagnostics report** to share them.
The report contains no file names, folder names or transcript text.

## What needs testing on the corporate Mac

| Capability | Used for | If unavailable or blocked |
|---|---|---|
| File selection (`<input type=file>`) | Importing transcripts and JSON | Drag and drop (also tested). This is very rarely blocked |
| Folder access: `showDirectoryPicker` (File System Access API) | Open Project Folder | Read-only folder import, then Export |
| Folder writing: `createWritable` | Save to Project (with backup and read-back check) | Export: a zip or individual JSON downloads |
| Read-only folder import (`webkitdirectory`) | Loading a project when writing is blocked | Import JSON files by hand |
| Downloads (`<a download>` + Blob URLs) | Export | Copy the JSON from the preview on Save & Export |
| Clipboard | Copy for Copilot, copying reports | A dialog with the text pre-selected for ⌘C |
| `crypto.subtle` | SHA-256 of transcripts | A built-in JavaScript SHA-256 (identical results) |

**Not used:** the network (the page's Content-Security-Policy blocks it), browser storage (localStorage and IndexedDB), extensions, servers.

## What happens when folder writing is blocked

1. **Open Project Folder** catches the error (for example `SecurityError` or `NotAllowedError`), explains it in plain language, and offers
   **Choose folder (read-only)**. Chrome may ask you to confirm that the page can list the folder's files.
2. Read-only mode loads `data/*.json` and the transcripts, and knows which asset files exist. Everything else works:
   import, review, quotes, previews and validation.
3. **Save & Export → Download update package (.zip)** produces the updated `data/*.json` plus new transcript files in
   project-folder layout, with `HOW-TO-APPLY.txt`. Copy them into the project folder in Finder.
4. The builder **never claims a file was saved** unless it wrote the file and read it back successfully.

## Troubleshooting

| Symptom | What to do |
|---|---|
| Chrome says "Can't open this folder because it contains system files" | Choose a dedicated folder, for example `Documents/Beyond the Title Project`. Don't use your home, Desktop or Downloads folder itself |
| Folder test shows `SecurityError` or `NotAllowedError` | Probably a browser policy. Use read-only mode and Export. **Don't change policies or settings to get around it.** Share the diagnostics report instead |
| Download test: the file never appears | Downloads may be redirected or blocked. Check Chrome › Settings › Downloads, or ask IT |
| The page is blank or won't open from disk | Your organization may block `file://` pages. The builder can also be opened from an approved internal web server (any `https://` address). Ask IT. Don't work around the block |
| "Leave site? Changes may not be saved" | You have unsaved or unexported work. Save or export first. The builder keeps nothing after the tab closes |
| Transcript format looks wrong | Change **Format** on the story's Transcript card, then use **Copy masked format sample** and share it so the parser can be tuned |
