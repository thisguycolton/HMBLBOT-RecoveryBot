---
title: Editing these docs
summary: How to write and organize docs pages in the Notion-style editor.
icon: pen-line
audience: admins
---
Every page of these docs, including [About](/about) and [History](/history), is written in Markdown and edited right here.

## Edit a page

1. Open the page and choose **Edit** at the top right.
2. Change the title and the one-line summary at the top.
3. Write in the big area below. It saves by itself about a second after you stop typing ("Saved" in the top bar).
4. Choose **View page** when you're done.

## Writing, Notion-style

- **Type Markdown** and it turns into what it means: `# ` heading, `- ` list, `1. ` numbered list, `[ ] ` checklist, `> ` quote, ` ``` ` code, `---` divider, `**bold**`, `_italic_`.
- **Type `/`** for the insert menu: headings, lists, checklists, Tip / Note / Heads up / Privacy callouts, quotes, dividers, code, tables and pictures. Keep typing to filter, ↑↓ and Enter to pick.
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

- In a section, choose **New page**. It starts as a draft with a simple outline.
- On the Docs home, **New section** adds one. In a section, **Rename section** changes its name, summary, icon, address and order.

## Drafts for new tools

Draft pages also live in the code (`db/docs/`). `bin/rails docs:import` adds any that aren't on the site yet and never changes a page that's already there.
