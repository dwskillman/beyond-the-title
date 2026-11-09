# Publishing workflow

**Import Socialive files → review story cards → save the project → (later) upload the finished website to Syndicate.**

## Today (Milestones 1–3)

1. **Open** `builder/builder.html` in Chrome (drag it onto a Chrome window, or use ⌘O).
2. **Open Project Folder** and choose your Beyond the Title project folder, or a new empty folder. The builder offers to set one up.
   If Chrome blocks folder access, choose the folder read-only (see [browser-capabilities.md](browser-capabilities.md)).
3. **Import** Socialive files: drag and drop, Choose files, or **Import a folder** (a whole export folder). Each `.txt` transcript
   becomes a **draft story**, and duplicates are skipped. Videos (`.mp4`), captions (`.vtt`) and images are matched to stories by file name.
   Anything that can't be matched for certain appears on the **Media** page for you to assign.
4. For each story:
   1. Check the **Transcript** card. Is the detected format right? Is the employee speaker right?
   2. Review the **Suggested statements**, which are keyword-based. Use one as the quote or headline, or highlight words in the transcript and click **Use selection as quote**.
   3. Pick or write a **headline**. Exact-quote headlines are labelled. Template headlines are paraphrases and are flagged when generic.
   4. *(Optional)* **Copy for Copilot**. Paste the reply back in, then apply fields one by one. Copilot quotes are checked word-for-word.
   5. Fill in **name, job title, team, manager, project, description and tags**. Watch the live card.
   6. In **Video & media**: check the video and its auto-captured thumbnail. Pause on a better frame and click **Use this frame as thumbnail** if needed.
      Attach or create captions, and use **Jump to quote** to confirm the quote's timing.
   7. Set the status to **Ready for review** or **Approved** when the checks pass, then turn on **Published** once video and thumbnail are in place.
5. **Save to Project**. You see the list of files first. Old JSON is backed up to `backups/`, and every file is verified after writing.
   Or use **Save & Export → Download update package (.zip)** and copy the files in.
6. **Preview the website.** Once, use **Save & Export → Employee website → Install website files**. After that, open `index.html`
   in the project folder in Chrome. Only published stories show. **Preview drafts** at the bottom of the page shows the rest.
   **Don't upload the project folder to Syndicate as it is.** It contains drafts, transcripts and backups. Wait for the release step (M4).

## Later milestones

| Step | Milestone |
|---|---|
| **Prepare release**: copy only published stories and their assets (no drafts, backups or builder) into a release folder or zip | M4 |
| Upload the release folder's contents to Syndicate | M4 (see [syndicate-deployment.md](syndicate-deployment.md)) |

## Rules that always apply

- Quotes are the employee's exact words. Headlines record their source. Nothing is invented.
- The original transcript is kept byte-for-byte, with its SHA-256 recorded for traceability.
- Real content stays out of git. The repository holds only code, docs and synthetic fixtures.
