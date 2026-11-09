# Testing

There are three layers. Only the first is needed on the corporate Mac. The others are optional dev-machine tools.
They use Node and Chrome where those are already installed, and are never part of using or publishing.

| Layer | How to run | Covers |
|---|---|---|
| **Built-in self-tests** (45) | In the builder: **Diagnostics → Built-in self-tests → Run self-tests**. On a dev machine: `./tests/run-selftest.sh` | Parsing of every fixture format, encodings, word preservation, candidate extraction, quote checks, Copilot reply parsing, IDs, JSON round-trip, validation, rendering safety, zip, read-only folder loading |
| **End-to-end** (52 checks) | `node tests/e2e.mjs` (Node 22+, Google Chrome) | The real UI in headless Chrome: multi-file import, editing, live preview, multiple stories, real downloads (`unzip -t`), JSON re-import with no data loss, the blocked and missing folder-access fallbacks, **direct save** with backup, read-back and conflict detection (using a stand-in folder, because OS pickers can't be automated), diagnostics, CSP |
| **Static checks** | `node tests/check-static.mjs` | No external URLs or network APIs, no data rendered as HTML, no browser storage, embedded fixtures in sync, no company names or emails, no media outside `fixtures/` |

`node tests/embed-fixtures.mjs` copies `fixtures/` into `builder.html` after you edit a fixture.

## Corporate Mac checklist (Milestone 1)

Results on the corporate Mac have **not** been verified yet. They depend on your organization's Chrome policies.

**A. Open and diagnose (about 5 minutes)**

1. Copy `builder/builder.html` to the Mac using an approved method. It's one self-contained file.
2. Open it in Chrome (drag it onto a Chrome window, or ⌘O).
3. Go to **Diagnostics**. Run all six live tests. For **Write to a folder**, use an empty test folder.
4. Click **Run self-tests**. Expect "45 of 45 passed".
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
