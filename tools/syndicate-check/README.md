# Syndicate check

A tiny synthetic test package for finding out how Syndicate serves a multi-file HTML document
(stylesheets, scripts, JSON, captions and video in subfolders). Built for diagnosing the
"MIME type ('text/html') is not a supported stylesheet MIME type" errors.

Use `syndicate-check.zip` from the folder above (made by `node tests/make-syndicate-check.mjs`):

1. In the Syndicate Admin Portal, add it as a new document (or a new version of a test document), exactly as it is.
2. Open it, both in the admin preview and through the document's own URL.
3. Photograph the whole page in each case.

It contains no employee content and sends nothing anywhere: it only reads its own files.
