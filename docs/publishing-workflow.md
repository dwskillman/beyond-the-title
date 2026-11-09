# Publishing workflow

**Import Socialive files → review story cards → save the project → (later) upload the finished website to Syndicate.**

## Today (Milestone 1)

1. **Open** `builder/builder.html` in Chrome (drag it onto a Chrome window, or use ⌘O).
2. **Open Project Folder** and choose your Beyond the Title project folder, or a new empty folder. The builder offers to set one up.
   If Chrome blocks folder access, choose the folder read-only (see [browser-capabilities.md](browser-capabilities.md)).
3. **Import** one or more Socialive `.txt` transcripts (drag and drop, or Choose files). Each becomes a **draft story**.
   Duplicates are detected by content and skipped.
4. For each story:
   1. Check the **Transcript** card. Is the detected format right? Is the employee speaker right?
   2. Review the **Suggested statements**, which are keyword-based. Use one as the quote or headline, or highlight words in the transcript and click **Use selection as quote**.
   3. Pick or write a **headline**. Exact-quote headlines are labelled. Template headlines are paraphrases and are flagged when generic.
   4. *(Optional)* **Copy for Copilot**. Paste the reply back in, then apply fields one by one. Copilot quotes are checked word-for-word.
   5. Fill in **name, job title, team, manager, project, description and tags**. Watch the live card.
   6. Set the status to **Ready for review** or **Approved** when the checks pass.
5. **Save to Project**. You see the list of files first. Old JSON is backed up to `backups/`, and every file is verified after writing.
   Or use **Save & Export → Download update package (.zip)** and copy the files in.

## Later milestones

| Step | Milestone |
|---|---|
| Match MP4s to stories, capture thumbnails, attach VTT captions, mark stories Published | M2 |
| Preview the employee website from the project folder | M3 |
| **Prepare release**: copy only published stories and their assets (no drafts, backups or builder) into a release folder or zip | M4 |
| Upload the release folder's contents to Syndicate | M4 (see [syndicate-deployment.md](syndicate-deployment.md)) |

## Rules that always apply

- Quotes are the employee's exact words. Headlines record their source. Nothing is invented.
- The original transcript is kept byte-for-byte, with its SHA-256 recorded for traceability.
- Real content stays out of git. The repository holds only code, docs and synthetic fixtures.
