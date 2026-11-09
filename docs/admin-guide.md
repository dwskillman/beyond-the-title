# Beyond the Title: admin guide

Everything you need to run Beyond the Title with the **Content Builder**, a single file you open in Google Chrome.
Nothing is installed, nothing goes to the internet, and nothing is stored in the browser except a shortcut to your last project folder.

## The big picture

1. **Import** Socialive files. Each transcript becomes a draft story; videos and captions are matched to stories by file name.
2. **Review** each story: pick a quote, write the headline, fill in the details, check the video and thumbnail.
3. **Save** to your project folder.
4. **Release**: build a clean, published-only copy of the website, then upload it to Syndicate.

Your **project folder** is your working copy. It holds everything, including drafts, transcripts and backups. **Never upload it.**
The **release folder** is a clean copy made from it. **That's what you upload.**

## First-time setup

1. Create an empty folder, for example **Documents › Beyond the Title Project**.
2. Open `builder.html` in Chrome: drag it onto a Chrome window, or use **File › Open File (⌘O)**.
3. Click **Open Project Folder**, choose the new folder, and accept **Set up project**. This creates `data/`, `stories/` and `backups/`.
4. Go to **Save & Export › Employee website › Install website files**.
5. Optional: open **Diagnostics** and run the live tests once to confirm what your browser allows.

Next time, click **Reopen “your folder”** at the top. Chrome asks once for permission.

## Adding new Socialive videos

1. Export from Socialive: the `.mp4` video, the `.txt` transcript, and the `.vtt` captions if available. Keep the same base name for all three (Socialive normally does this).
2. In the builder, go to **Import** and drop the **whole export folder**, or choose the files.
   - Each transcript becomes a **draft story**.
   - Videos and captions are attached to the story whose transcript has the same name. A file containing the story ID (for example `story-0007`) or the employee's full name also matches.
   - The video's length is read automatically and a **thumbnail is captured** from it.
3. Anything that couldn't be matched for certain appears on the **Media** page. Pick a story for it and click **Assign**.
4. To add a video to an existing story later, open the story and use **Video & media › Attach video**, or drop the file on the Media page.

The same file imported twice is detected and skipped.

## Importing transcripts

- **Import** accepts `.txt` transcripts, one or many at once. Videos are optional; a transcript on its own is enough to start a story.
- On the story's **Transcript** card, check the detected **Format** and the **Employee speaker** (the person the story is about). Change them if they're wrong; suggestions update straight away.
- **Original** shows the file exactly as imported. **Structured** shows tidied segments with timestamps. Words are never changed.

## Choosing a quote

- **Suggested statements** come from simple keyword rules, not AI. They are a starting point.
- **Use as quote** takes a suggestion. You can also **highlight words in the Structured transcript** and click **Use selection as quote**.
- A quote must be the employee's **exact words**. The badge under the quote shows **Verbatim · time** when it matches the transcript. If you edit a quote so it no longer matches, it's flagged and the story can't be approved.
- **Jump to quote** in the Video & media card plays the video at that moment, so you can confirm the timing.

## Editing headlines

- Use a **headline suggestion**, or type your own. The label next to the field shows where the headline came from:
  - **Exact quote:** the employee's words. The card shows it in quotation marks.
  - **Template:** a paraphrase. It's flagged *Generic* until you personalise it.
  - **From Copilot:** AI-assisted. Check every fact.
  - **Written by hand:** your own words.
- Aim for **70 characters or fewer**. Cards show about two lines.
- **Copilot (optional):** **Copy for Copilot** puts an instruction prompt and the transcript on your clipboard for your approved Copilot. Paste Copilot's reply into **Copilot assist › Read reply** and apply fields one at a time. Only paste transcripts where company policy allows.

## Assigning managers and teams

- On the story: type a **Team** and a **Manager**, or pick existing ones from the list. New names create new records.
- **People & Teams** lets you:
  - Rename someone: their stories update too.
  - Set a team's manager.
  - Mark a person as a manager.
  - **Merge** duplicates (for example the same team typed two ways).
  - Delete records nobody uses.
- Managers are people, so a manager can have their own story as well.

## Featuring stories

- Turn on **Featured story** in the story's **Publishing** section.
- The homepage shows one featured story at a time and **rotates daily** between all featured stories.
- If none are featured, the newest story with a thumbnail is shown.

## Approving and publishing

1. Fill in the starred fields: headline, description, name, job title, team.
2. Set **Status** to **Ready for review**, then **Approved**. The builder won't let a story move on while required fields are missing.
3. Make sure it has a **video** and a **thumbnail**. Captions are strongly recommended.
4. Turn on **Published**. Only published stories ever appear on the website.

To take a story down, set its status back to **Approved** (or Draft) and make a new release.

## Saving and updating the data

- **Save to Project** shows exactly which files will be written, keeps a **backup** of the previous data in `backups/`, and **checks every file after writing**.
- You never need to edit JSON by hand. The data lives in `data/stories.json`, `data/people.json` and `data/teams.json`.
- If someone else changed those files since you opened the folder, you're warned before anything is overwritten. Their version is kept in `backups/`.
- If Chrome doesn't allow saving to the folder, use **Save & Export › Download update package (.zip)** and follow `HOW-TO-APPLY.txt`.
- The builder keeps nothing after you close the tab. Save before closing; Chrome warns you if you forget.

## Previewing the website

1. **Save to Project**. This also writes `data/site-data.js`, which lets the site open straight from disk.
2. In Finder, drag the project folder's **index.html** onto Chrome.
3. Only published stories are shown. Click **Preview drafts** at the bottom of the page to see the rest. A banner makes clear you're previewing.

## Preparing a Syndicate release

1. Open **Release**. The checks list anything that would block a release (for example a published story missing its video) and a few warnings worth a look.
2. Click **Write release to a folder** and choose an **empty folder** (for example **Documents › Beyond the Title Release**). Choose the same folder next time: the release is updated and files of stories that are no longer published are removed. Or click **Download release (.zip)**.
3. **Preview it:** open `index.html` in the release folder.
4. **Upload the contents** of the release folder to Syndicate, so `index.html` sits at the top level.

A release contains only published stories with their video, thumbnail and captions, the people and teams those stories mention, and the website files. It never contains drafts, transcripts, backups, internal fields or the builder.

## Backups and recovery

- Every save copies the previous JSON files into `backups/` with a timestamp. To roll back, copy a backup over the file in `data/` (rename it to `stories.json` and so on) and reopen the folder.
- Videos are not backed up automatically. Keep your Socialive exports.
- Moving to another computer: copy the whole project folder, plus `builder.html`.

## Troubleshooting browser permissions

Open **Diagnostics**, run the live tests, and use **Copy diagnostics report** if you need help. The report contains no names or content.

- **"Direct folder access isn't available" or SecurityError / NotAllowedError:** a browser setting or policy blocks writing. Choose **Choose folder (read-only)**, keep working, and save with **Download update package (.zip)**. Don't change browser policies to get around it.
- **"Can't open this folder because it contains system files":** choose a dedicated folder inside Documents, not your home, Desktop or Downloads folder itself.
- **Video won't attach:** export from Socialive as MP4 (H.264). Some `.mov` files don't play in Chrome.
- **Thumbnail capture fails:** use **Import image** instead.
- **Downloads don't appear:** check Chrome › Settings › Downloads, or ask IT where downloads go.
- **Reopen button doesn't appear:** use **Open Project Folder**. The shortcut can be forgotten after browser updates.
- **The site opened from disk says it has no data:** **Save to Project** first, so `data/site-data.js` exists.
- **Captions missing in a disk preview:** save again. Caption text for previews is stored in `data/site-data.js`.
