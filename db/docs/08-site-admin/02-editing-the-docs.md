---
title: Editing these docs
summary: How to write and organize docs pages in the Notion-style editor.
icon: pen-line
audience: admins
---
Every page of these docs, including [About](/about) and [History](/history), is written in Markdown and edited right here.

## Edit a page

![Editing a docs page](/docs-images/site-admin/docs-editor.webp)

1. Open the page and choose **Edit** at the top right.
2. Change the title and the one-line summary at the top.
3. Write in the big area below. It saves by itself about a second after you stop typing ("Saved" in the top bar).
4. Choose **View page** when you're done.

## Writing, Notion-style

- **Type Markdown** and it turns into what it means: `# ` heading, `- ` list, `1. ` numbered list, `[ ] ` checklist, `> ` quote, ` ``` ` code, `---` divider, `**bold**`, `_italic_`.
- **Type `/`** for the insert menu (pictured below): headings, lists, checklists, Tip / Note / Heads up / Privacy callouts, quotes, dividers, code, tables and pictures. Keep typing to filter, ↑↓ and Enter to pick.
![The / insert menu](/docs-images/site-admin/docs-slash-menu.webp)

- **Select text** for the bubble: bold, italic, strikethrough, code and link.
- **Paste or drop a picture** to upload it. Screenshots make tutorials much easier to follow.
- **Markdown** (top bar) shows the raw Markdown. Both views edit the same text.

> [!TIP] Callouts are quotes that start with `[!TIP]`, `[!NOTE]`, `[!WARNING]` or `[!PRIVACY]`. Only `##` and `###` headings show in **On this page**.

## Page settings

The side panel (the panel button on a phone) has:

- **Reviewed**: tick it once you've read a draft through. Unreviewed pages show a dot in the docs list and a badge on the page, for site admins only.
- **Status**: Published, or Draft (only site admins see it).
- **Who can read it**: everyone, members (signed in), or site admins.
- **Section**, **Address** and **Order**.
- **Icon**.
- **History**: earlier copies of the page. Each editing session keeps the text it replaced. Open one to read it, and **Put back** to restore it.
- **Delete page**.

## New pages and sections

![The Docs home for a site admin, with the pages still to review](/docs-images/site-admin/docs-home.webp)

- In a section, choose **New page**. It starts as a draft with a simple outline.
- On the Docs home, **New section** adds one. In a section, **Rename section** changes its name, summary, icon, address and order.

## Videos with chapters

Type `/` and pick **Video**. It adds a block like this, which shows as a video player on the page:

```
{
  "src": "/docs-videos/group-tour.mp4",
  "poster": "/docs-videos/group-tour.webp",
  "title": "A quick tour of your group",
  "chapters": [
    { "start": "0:00", "title": "Open your group's home page" },
    { "start": "0:12", "title": "Find the next meeting" },
    { "start": "1:10", "title": "Wrap up" }
  ]
}
```

- The block starts with three backticks and the word `video` (` ```video `), and ends with three backticks.
- **src** is the video file. It has to be on this site (an address starting with `/`, like the files in `public/docs-videos/`). `poster` (a still shown before it plays) and `title` are optional.
- **chapters** cut the timeline into pieces with a small gap between them. Point at a piece (or drag along it with a finger) to see its title and time. A start can be seconds (`42`) or a clock (`0:42`, `1:02:03`), and each chapter runs until the next one starts.
- Instead of the list, `chapters` can be the address of a JSON file on this site, like `"/docs-videos/group-tour.json"`. The file can be the same list, `{ "chapters": [...] }`, or `{ "0:00": "Intro", "0:42": "Next part" }`.
- Under the video, the chapter list opens with one tap and jumps to any chapter.
- Keys while the player is focused: Space or K plays and pauses, ← → skip 5 seconds, J L skip 10, `[` `]` go to the chapter before or after, M mutes, F goes full screen.

## Screenshots

The pictures in these pages live in the code, in `public/docs-images/`, and the Markdown points at them like `![Group chat](/docs-images/group-tools/chat.webp)`. You can keep them, delete them, or replace one by pasting your own picture (which uploads it to the page). Files whose name ends in `-phone` show phone-sized.

They were taken from a made-up demo group (the Lantern Street Group). To take them again after the app changes, a developer runs `script/docs_demo/seed.rb` on a throwaway development database, then `node script/docs_demo/shoot.js`.

## Drafts for new tools

Draft pages also live in the code (`db/docs/`). `bin/rails docs:import` adds any that aren't on the site yet and never changes a page that's already there. `bin/rails docs:refresh` also brings newer draft text to pages nobody has touched yet (not reviewed, never edited, no History).
