# Beyond the Title: admin guide

Everything you need to run Beyond the Title with the **Content Builder**, a single file you open in Google Chrome.
Nothing is installed, nothing goes to the internet, and nothing is stored in the browser except a shortcut to your last project folder.

## The big picture

1. **Import** Socialive files. Each transcript becomes a draft story with its **name, headline, description, quote and tags already filled in** from the transcript. Videos and captions are matched to stories by file name.
2. **Copilot (optional)** looks the person up in the company directory and returns their **job title and manager** (and their team, if the directory lists a named one), plus more headline and description ideas.
3. **Review** each story: check or change what was filled in, then check the video and thumbnail.
4. **Save** to your project folder.
5. **Release**: build a clean, published-only copy of the website, then upload it to Syndicate.

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
   - Videos and captions are attached to the story whose transcript has the same name. A file containing the story ID (for example `story-0007`) or the employee's name also matches.
   - When you import **one person at a time** (their transcript plus their video, and captions if any), the video is attached to that story even if the file names don't match. With several people in one import, files are matched by name only, so nobody gets someone else's video.
   - The video's length is read automatically and a **thumbnail is captured** from it.
3. Anything that couldn't be matched for certain appears on the **Media** page. Pick a story for it and click **Assign**.
4. To add a video to an existing story later, open the story and use **Video & media › Attach video**, or drop the file on the Media page.

The same file imported twice is detected and skipped.

## Importing transcripts

- **Import** accepts `.txt` transcripts, one or many at once. Videos are optional; a transcript on its own is enough to start a story.
- On the story's **Transcript** card, check the detected **Format** and the **Employee speaker** (the person the story is about). Change them if they're wrong; suggestions update straight away.
- **Original** shows the file exactly as imported. **Structured** shows tidied segments with timestamps. Words are never changed.

### What's filled in for you

When a transcript is imported, empty fields are filled from it straight away:

| Field | Where it comes from |
|---|---|
| **Employee name** | Where they introduce themselves ("My name is …", "Hi, I'm …"), or the speaker label. The hint under the field shows the exact line. Check the spelling. |
| **Quote** | The top suggested statement, word for word |
| **Headline** | The top headline suggestion |
| **Short description** | The top description suggestion (see below) |
| **Tags** and **Project** | Suggested tags and the most likely project name |

**Job title and manager** usually aren't in the transcript, so they come from Copilot's directory lookup, or you type them. **Team is optional**: fill it in only for people on a named team (for example the specialty team).

- Each filled field shows a label: **From transcript · review**, **From Copilot · verify** or **Written by hand**.
- Anything you type is never overwritten.
- For stories imported before this version, click **Fill empty fields from transcript** at the top of the story.

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
- Copilot can suggest three more headlines. See **Using Copilot** below.

## Choosing a description

The **Description suggestions** card offers:

- **Exact words:** the person's own words in quotation marks, for example *Avery on teamwork: “We met every Tuesday for twelve weeks.”* The quoted part is checked against the transcript.
- **Templates:** short invitations built from the transcript's themes and project, for example *Meet Avery from Learning Design and hear the story behind Team Hub.* They are paraphrases, so check them. *Generic* means a template could fit anyone; personalise it.
- **From Copilot:** up to three descriptions written by Copilot, once you've pasted its reply. Check every fact.

Click **Use** on the one you want, then edit it in the form if you like. To use a different passage, highlight words in the **Structured** transcript and click **Use as description**. Aim for about 240 characters or fewer.

## Using Copilot: job title, team and manager

The **Copilot** card at the top of each story has three steps:

1. **Copy the prompt.**
   - It includes the person's name, as they said it in the video. You can correct the name before copying.
   - It asks Copilot to look them up in the company directory for their **job title and manager**, and a **team** only if the directory lists a specific named team. Most people won't have one, and Copilot writes NOT FOUND for Team. That's fine.
   - It also asks for headlines, descriptions, a quote and tags from the transcript.
   - The prompt is copied with its line breaks, so it pastes into Copilot as separate lines. If a reply still comes back as one long paragraph, paste it anyway: the builder splits it at the labels.
   - Paste it into your organization's approved Copilot. Only paste transcripts where company policy allows.
2. **Paste Copilot's whole reply** and click **Read reply**.
3. **Review and apply.** Each field is listed next to what the story has now:
   - Fields that are empty, or were filled automatically, are ticked.
   - Anything you typed yourself is left unticked.
   - Pick one of Copilot's headlines and descriptions, untick anything you don't want, then click **Apply selected**.
   - A new team or manager is added to People & Teams. A manager's job title is saved too, if Copilot gave one.

Copilot is told not to guess. If it can't reach the directory, can't find the person, or finds more than one match, it writes **NOT FOUND** and explains in a directory note. Type those fields yourself.

If Copilot's name is very different from the transcript's, it isn't ticked and you're warned, because Copilot may have looked up the wrong person.

## Assigning managers and teams

- On the story: type a **Manager**, and a **Team** if they're on a named team (Team is optional), or pick existing ones from the list. New names create new records.
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

1. Fill in the starred fields: headline, description, name and job title. Team is optional.
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
- **Copilot says NOT FOUND for Team:** that's expected for anyone who isn't on a named team. Leave Team empty.
- **Copilot says NOT FOUND for job title or manager:** your Copilot may not have access to the company directory, or the name may be spelled differently there. Check the directory yourself and type the fields.
- **The detected name is wrong:** type the correct name. Typed values are never replaced automatically.
- **The site opened from disk says it has no data:** **Save to Project** first, so `data/site-data.js` exists.
- **Captions missing in a disk preview:** save again. Caption text for previews is stored in `data/site-data.js`.
