# Testing

There are three layers. Only the first is needed on the corporate Mac. The others are optional dev-machine tools.
They use Node and Chrome where those are already installed, and are never part of using or publishing.

| Layer | How to run | Covers |
|---|---|---|
| **Built-in self-tests** (67) | In the builder: **Diagnostics → Built-in self-tests → Run self-tests**. On a dev machine: `./tests/run-selftest.sh` | Parsing of every fixture format, encodings, word preservation, candidate extraction, quote checks, name detection, description suggestions, the Copilot prompt and reply parsing (including NOT FOUND), auto-fill and Copilot review rules, IDs, JSON round-trip, validation, rendering safety, zip, read-only folder loading, media matching, VTT checks and generation, publish rules, people and teams merges |
| **Builder end-to-end** (113 checks) | `node tests/e2e.mjs` (Node 22+, Google Chrome) | The real UI in headless Chrome: multi-file import, fields filled from the transcript, description choices, the Copilot prompt and applying a reply (job title, team, manager), editing, live preview, multiple stories, real downloads (`unzip -t`), JSON re-import with no data loss, the blocked and missing folder-access fallbacks, **direct save** with backup, read-back and conflict detection (using a stand-in folder, because OS pickers can't be automated), diagnostics, CSP, **releases** (zip unzipped and opened in Chrome; folder release refuses the project folder and non-empty folders, removes unpublished files on update), **Milestone 2:** folder import with name matching, video length, auto and manual thumbnail capture on `file://`, captions, manual assignment, publishing, zip with video (byte-identical), direct save of media, Scan project folder, reopen last folder, People & Teams |
| **Website end-to-end** (49 checks) | `node tests/site-e2e.mjs` | The employee site with synthetic data, over http and from disk: published-only filtering, search by every field, filters, ⌘K, story player with captions and jump-to-quote, Surprise me, all directory pages, phone width, preview drafts, empty and error states, no foreign requests, the embedded font (http and disk), line marks, play buttons and icons |
| **Static checks** | `node tests/check-static.mjs` | No external URLs or network APIs, fonts embedded as `data:` URIs only, font licence present, no data rendered as HTML, no browser storage, embedded fixtures in sync, no company names or emails, no media outside `fixtures/` |

`node tests/embed-fixtures.mjs` copies `fixtures/` and `site/` into `builder.html` after you edit either. `node tests/make-site-preview.mjs` builds a browsable sample site in `test-output/`. `node tests/make-font-css.mjs` regenerates `site/css/fonts.css` from the Manrope TTF files (default folder `/Library/Fonts`).

## Corporate Mac checklist

The user confirmed on 2026-11-09 that the Milestone 1 checks pass on the corporate Mac (diagnostics passed and direct saving worked), and later the same day reported that everything in v0.4.0 works. Section G (v0.5.0) has not been run there yet. Re-run A after any Chrome or policy update.

**A. Open and diagnose (about 5 minutes)**

1. Copy `builder/builder.html` to the Mac using an approved method. It's one self-contained file.
2. Open it in Chrome (drag it onto a Chrome window, or ⌘O).
3. Go to **Diagnostics**. Run all seven live tests. For **Write to a folder**, use an empty test folder.
4. Click **Run self-tests**. Expect "67 of 67 passed".
5. Click **Copy diagnostics report** and paste it back to the project thread.

**B. Your four Socialive transcripts**

1. **Import** all four `.txt` files at once.
2. For each story, check the following and note anything wrong:
   - **Transcript card:** detected format, speakers, timestamps, encoding. Does the **Structured** view read correctly against **Original**?
   - Is the **Employee speaker** right?
   - **Suggested statements:** are the three useful? Is "Manual selection recommended" shown when it should be?
   - **Headline suggestions:** is the exact quote sensible? Are the templates sensible?
   - Highlight a sentence in the transcript, then click **Use selection as quote**. The badge should say *Verbatim · time*.
3. On one story, click **Copy masked format sample** and paste it back. It shows the layout with every letter replaced by x, so the parser can be tuned to Socialive's real format without sharing content.

**C. Save**

1. Create an empty folder such as `Documents/Beyond the Title Project`.
2. Click **Open Project Folder**, choose it, and accept the setup prompt.
3. Click **Save to Project**, review the file list, then confirm. In Finder, check that `data/stories.json` and `stories/story-000N/transcript.txt` exist.
4. If folder access is blocked: use the read-only option, then **Save & Export → Download update package (.zip)**. Follow HOW-TO-APPLY.txt.
5. Close the tab, reopen the builder, and open the same folder. Your stories should load with their transcripts.

**D. Milestone 2: video (when you have the MP4s)**

1. On **Diagnostics**, run **Read a video and capture a frame** with a real Socialive MP4.
2. Drop the whole Socialive export folder (transcripts, videos, captions) on **Import**. Check the **Media** page: is every video on the right story? Assign anything left over.
3. In a story's **Video & media** card, play the video, try **Jump to quote**, and capture a better thumbnail.
4. Approve one story, turn on **Published**, then **Save to Project**. In Finder, check `stories/story-000N/` has `video.mp4`, `thumbnail.jpg` and `captions.vtt`.
5. Close the tab, reopen the builder, and click **Reopen “your folder”**.

**E. Milestone 3: the website**

1. **Save & Export → Employee website → Install website files**, then **Save to Project**.
2. In Finder, drag the project folder's `index.html` onto Chrome. Check that stories, search (try a manager's or team's name), Surprise me and a video with captions all work.
3. Click **Preview drafts** at the bottom to see unpublished stories, then **Hide drafts**.

**F. Milestone 4: release**

1. Publish at least one story (approved, with video and thumbnail), then **Save to Project**.
2. Open **Release**. Check the list, click **Write release to a folder**, and choose a new empty folder.
3. Open the release's `index.html` in Chrome. Only published stories should appear, and there should be no **Preview drafts** button.
4. Unpublish a story, release to the same folder again, and confirm its files are gone.

**G. v0.5: Copilot lookup and filled-in fields**

1. **Import** a Socialive transcript. Check that the name, headline, description, quote and tags are filled in, and that the hint under **Employee name** shows the line where the person says their name.
2. On the **Copilot** card, click **Copy for Copilot…**. Check the name, copy, and paste it into your approved Copilot. The prompt should arrive as separate lines, not one paragraph.
3. Does Copilot return a **job title, team and manager** from the directory, or NOT FOUND? Note which, because this depends on what your Copilot can see.
4. Paste the whole reply into step 2, click **Read reply**, review the ticks, and click **Apply selected**. Check the job title, team and manager against the directory.
5. Try **Description suggestions → Use**, and highlight words in the transcript, then click **Use as description**.
6. Install the website files again (**Save & Export → Employee website**), save, and open `index.html`. The lettering, line marks and play buttons should match the reference design.
