# Data model (schema version 1)

All files are UTF-8 JSON, written with two-space indentation. All asset paths are **relative to the website root**
(the project folder), with no leading `/`. The builder never removes or rewrites fields it doesn't know about.
Records are edited in place, so unknown fields and key order survive a round-trip. This is covered by a self-test and an E2E test.

## `data/stories.json`

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-09T18:20:00.000Z",
  "generator": "Beyond the Title Content Builder 0.1.0",
  "stories": [ { "…": "story records" } ]
}
```

The builder also imports the older plain-list form (`[ {…}, {…} ]`) and saves it in the object form above. The records themselves are unchanged.

### Story record

| Field | Type | Notes |
|---|---|---|
| `id` | string | `story-0001`. Lowercase letters, digits and hyphens. Unique. IDs are the highest existing number + 1 |
| `personId` | string | `person-0001`. Links to `people.json`. Never the name alone |
| `name`, `role` | string | A snapshot at recording time. `role` is the job title |
| `managerId` | string \| null | A **person** ID (managers are people) |
| `teamId` | string \| null | Links to `teams.json` (slug, e.g. `learning-design`) |
| `project` | string \| null | Free text |
| `headline` | string | The card headline |
| `headlineSource` | `"quote"` \| `"template"` \| `"copilot"` \| `"manual"` \| null | Where the headline came from. `quote` means exact transcript words; the card shows it in quotation marks |
| `description` | string | 1–2 sentences, third person |
| `quote` | string | **Must be the employee's exact words.** Checked word-for-word against the transcript |
| `quoteTimestamp` | `"HH:MM:SS"` \| null | Start of the transcript segment that contains the quote |
| `quoteStart` | number \| null | The same moment, in seconds (for seeking the video later) |
| `tags` | string[] | Up to 12, each 32 characters or fewer |
| `transcript` | string | `stories/<id>/transcript.txt`, stored byte-for-byte as imported |
| `video` | string \| null | `stories/<id>/video.mp4` (the original extension is kept: `.mp4`, `.m4v` or `.mov`; MP4 with H.264 is recommended) |
| `thumbnail` | string \| null | `stories/<id>/thumbnail.jpg` (captured frames are JPEG, at most 1280 px wide; imported images keep their type) |
| `captions` | string \| null | `stories/<id>/captions.vtt` (WebVTT) |
| `duration` | number \| null | Video length in seconds, read from the video by the browser |
| `featured` | boolean | Candidate for the homepage featured slot |
| `status` | `"draft"` \| `"review"` \| `"approved"` \| `"published"` | Editorial workflow. A missing `status` is read as `draft` (or `published` if `published` is true) |
| `published` | boolean | **The website's only visibility switch.** Invariant: `published === (status === "published")` |
| `source` | object | `{ transcriptFile, transcriptSha256, importedAt, speaker }`. The original file name, its SHA-256 (check with `shasum -a 256`), the import time, and the speaker treated as the employee |
| `fieldSources` | object | Where each field's value came from, by field: `name`, `role`, `team`, `manager`, `headline`, `description`, `quote`, `tags`, `project`. Each value is `"auto"` (filled from the transcript on import), `"chosen"` (a suggestion the admin picked), `"copilot"` (applied from a Copilot reply) or `"manual"` (typed). A later Copilot reply may replace only empty, `auto` or `copilot` values. Missing for older stories, which are treated as typed. **Never released** |
| `createdAt`, `updatedAt` | ISO string | Set by the builder |

### Validation

| Status | Requirements |
|---|---|
| Draft | `id`, `personId` and a safe `transcript` path. Everything else may be blank (shown as to-dos) |
| Ready for review / Approved | Also `name`, `role`, `headline`, `description` (`teamId` is optional).  Quote must be verbatim if present. Missing quote, manager or tags is a warning |
| Published | Also `video` and `thumbnail`, each **either verified in the project folder or attached in this session** (they are then written on save or included in the export). Missing captions is a warning. Captions that run past the end of the video are a warning |

Other checks:

- Duplicate or invalid IDs are errors, fixed with one click on the Stories page.
- Unsafe paths (`/…`, `..`, `scheme:`) are refused.
- Team or manager IDs that aren't in the registries produce a warning.
- Headlines over 90 characters and descriptions over 280 characters produce a warning.

## `data/people.json`

```json
{ "schemaVersion": 1, "updatedAt": "…", "people": [
  { "id": "person-0001", "name": "Avery Example", "title": "Learning Designer", "teamId": "learning-design", "managerId": "person-0003", "isManager": false }
] }
```

Managers are people with `"isManager": true`, so a manager can also have stories. The builder creates and updates the
record for a story's person when you edit that story. People or teams created during a session and later left unused
(for example a mistyped team) are not saved.

## `data/teams.json`

```json
{ "schemaVersion": 1, "updatedAt": "…", "teams": [ { "id": "learning-design", "name": "Learning Design", "managerId": "person-0003" } ] }
```

## Project folder layout

```
data/stories.json  data/people.json  data/teams.json
stories/<story-id>/transcript.txt  video.mp4  thumbnail.jpg  captions.vtt
backups/stories-<timestamp>.json    (written before each overwrite; never deployed)
```

## Versioning

`schemaVersion` changes only for incompatible changes. A file with a newer version still loads, keeps its unknown fields, and shows a warning.
