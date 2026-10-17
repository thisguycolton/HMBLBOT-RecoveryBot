# Group Conscience organizer: plan

Steps 1 (Documents) and 2 (Decisions) are built; step 3 is not. Written 2026-10-17. The Find a meeting work (PR #13), which sits on Profiles/Group pages (#12), Events (#11) and Groups (#10), is now merged to `main` (#14); build on `main`.

## What it's for

A group's conscience (Tradition Two) lives in scattered places today: a secretary's Google
Doc of minutes, a binder, a treasurer's spreadsheet, someone's memory of "we voted on that
in 2023". The organizer gives each group one place for:

1. **Business meetings**: when the next one is, its agenda, and the minutes afterwards.
2. **Decisions**: every motion the group voted on, with the count, the outcome, and what it
   replaced. This is the part people actually go looking for ("are we still giving 60/30/10?").
3. **Documents**: the meeting format and readings script, group guidelines, treasurer's
   reports, service position descriptions, and anything else, written here or uploaded as a
   file, with history.

It sits inside a group, next to Meetings, Events, Readings, Literature and Members, and
shows up on the group's page through new HMBLBOT Editor blocks.

## Who can do what

Today a membership has `role` admin or member (`GroupMembership::ROLES`), and
`Group#manageable_by?` covers group admins and site admins.

| | Visitor / non-member | Member | Record keeper | Group admin / site admin |
|---|---|---|---|---|
| See documents marked **Public** (and the blocks showing them) | yes | yes | yes | yes |
| See **Members** documents, decisions, minutes, agendas | | yes | yes | yes |
| Suggest an agenda item for the next business meeting | | yes | yes | yes |
| See **Record keepers** documents and drafts | | | yes | yes |
| Write/upload documents, schedule business meetings, write minutes, record motions and votes | | | yes | yes |
| Delete documents, make someone a record keeper | | | | yes |

- **Record keeper** is new: a boolean `can_keep_records` on `group_memberships`, switched on
  by a group admin from the Members tab (the secretary, GSR, treasurer, whoever the group
  picks). It's not a third role, so every existing `admin?` check stays as it is.
  `Group#records_editable_by?(user) = manageable_by?(user) || membership_for(user)&.then { |m| m.active? && m.can_keep_records }`.
- Gating follows Groups: only people who can see the group at all (`Group#visible_to?`) get
  anything beyond Public documents.

## Data model

Four new tables, one new column. All `group_id` foreign keys cascade with the group.

### `group_memberships` (existing)
- `can_keep_records` boolean, default false.

### `business_meetings`
A group's business (group conscience) meeting.
- `group_id`, `created_by_id`
- `held_on` date, `starts_at` datetime (optional, in the group's `time_zone`)
- `status`: `planned` / `held` / `cancelled`
- `event_id` (optional): the group Event announcing it, so RSVPs, the flyer and a date poll
  come for free from Events and schedule polls
- `meeting_id` (optional): which of the group's meetings it follows ("after the Sunday meeting")
- `chair_name`, `secretary_name` (text, first name + last initial; see Anonymity)
- `attendance_count` integer
- `minutes` text (Markdown), `minutes_status`: `draft` / `posted` / `approved`
  (minutes are normally approved at the next business meeting; `minutes_approved_at`)
- `visibility`: `members` (default) / `keepers`

### `agenda_items`
- `business_meeting_id`, `submitted_by_id`, `position` integer
- `kind`: `report` (treasurer, GSR, intergroup...), `old_business`, `new_business`, `other`
- `title`, `details` (Markdown, short)
- `status`: `suggested` (by a member, waiting for a record keeper) / `on_agenda` / `tabled` / `done`
- Suggestions from members come in as `suggested` and notify the record keepers.

### `motions`
One thing the group voted on. The decisions log is just this table.
- `group_id`, `business_meeting_id` (optional, so past decisions can be typed in without a
  meeting), `agenda_item_id` (optional)
- `title` (short: "Send 7th Tradition 60/30/10"), `text` (Markdown, the motion as worded)
- `moved_by_name`, `seconded_by_name` (optional text)
- `status`: `proposed` / `passed` / `failed` / `tabled` / `withdrawn`
- `votes_for`, `votes_against`, `abstentions` (integers, as counted in the room)
- `minority_opinion` (Markdown, optional): the Concept V right of appeal, heard before a re-vote
- `decided_on` date
- `category`: `money`, `format`, `service`, `literature`, `meeting` (time/place/online), `other`
- `supersedes_id` (a previous motion it replaces); `superseded_by` derived. A passed motion
  with nothing superseding it is **standing**.
- `visibility`: `members` / `public` (a few decisions are fine to show visitors, like
  "this meeting is closed")

### `group_documents`
- `group_id`, `created_by_id`, `updated_by_id`
- `title`, `kind`: `format` (format and scripts), `guidelines` (guidelines, policies,
  bylaws), `treasury` (treasurer's reports, budgets), `service` (service position
  descriptions, rotation), `outreach` (flyers, letters, PI/CPC), `other`. The kinds are the
  folders; no free-form folders in v1.
- `body` text (Markdown, up to 100k), and/or an attached `file` (Active Storage, S3 in
  production like book covers): PDF, DOCX, XLSX, images, up to 20 MB
- `visibility`: `public` / `members` (default) / `keepers`
- `status`: `draft` / `current` / `archived`
- `approved_by_motion_id` (optional): "adopted by group conscience on Mar 3" with a link
- `pinned` boolean (pinned documents lead their folder and the Documents block)
- `position` integer within its folder

### `group_document_versions`
Every save of a written document keeps the old copy.
- `group_document_id`, `user_id`, `title`, `body`, `created_at`
- Uploading a new file over an old one also keeps the old blob (`file` on the version row).
- Kept forever in v1; they're small text. "Restore" makes a new version from an old one.

### Search
Plain `ILIKE` over titles, bodies, minutes and motion text, scoped to one group; that's what
`Book#search` does today and a group will have dozens of records, not thousands. Swap in
Postgres full text later only if it's needed.

## Screens

A new tab on the group, **Group conscience**, at `/groups/:slug/conscience`, members only
(`members: true` in `TABS` in `components/groups/GroupPage.jsx`). Inside it, four views
along a secondary bar, same look as the other tabs:

1. **Overview** (`/conscience`)
   - Next business meeting: date, time, where, link to the event, the agenda so far, and
     "Suggest an agenda item" for members.
   - Recent decisions (last 5 passed/failed motions).
   - Pinned documents.
   - For record keepers: drafts waiting (unposted minutes, draft documents, suggested agenda items).

2. **Business meetings** (`/conscience/meetings`, `/conscience/meetings/:id`)
   - List by date, upcoming first, then past with "minutes posted / approved" badges.
   - One meeting: agenda on one side (drag to reorder, mark done/tabled), minutes on the
     other. Motions are recorded right in the agenda item ("Record a motion" opens a small
     form: wording, moved/seconded, the three counts, outcome, minority opinion, what it
     replaces). Minutes are Markdown with live preview; "Start minutes from agenda" fills
     in the headings.
   - "Also create an event" when scheduling, which makes a draft group Event with a
     Group conscience agenda block already in it. "Pick a date with a poll" links to
     Schedule polls, like events do.
   - Print view (print CSS, no app chrome) so the secretary can hand out paper copies or
     send them to the district.

3. **Decisions** (`/conscience/decisions`)
   - The decisions log: standing decisions first, grouped by category, each with date,
     count and a link to the meeting. Filters: standing / all / failed / tabled; category;
     search box.
   - A superseded decision shows struck through with "Replaced by ... on ...".
   - Record keepers can add a past decision without a meeting, to backfill the history.

4. **Documents** (`/conscience/documents`, `/conscience/documents/:id`)
   - Folders (the kinds) as cards, like the library's card view; inside, pinned first, then
     by position. Drag a file onto the page to upload it into that folder.
   - A document: title, badges (visibility, "adopted Mar 3 by group conscience"), the body
     rendered (or the PDF shown inline / a download link for other files), "History" with
     each version's date and author.
   - Editing: Markdown with a preview, the same writing feel as `notes/NoteEditor.jsx`,
     full page. ⌘/Ctrl+S saves (a version per save).

Phone: the secondary bar becomes a select; meeting agenda and minutes stack.

## Group page (HMBLBOT Editor) blocks

Add to `EventBlocks::GROUP_TYPES` and `components/events/BlockView.jsx` / the editor's
block picker, the same way `meetings`, `literature` and `readings` were added:

| Block | Fields | Shows |
|---|---|---|
| `documents` | title, kind (all or one folder), limit, pinned_only | Documents the viewer may see; visitors see only Public ones, so "Our meeting format" and "Group guidelines" can live on the public page |
| `decisions` | title, limit, category | Standing decisions the viewer may see (Public ones for visitors) |
| `business_meeting` | title | Next business meeting: date, time, link to the event; members also see the agenda and "Suggest an item" |

When the block has nothing the viewer can see, it hides itself for visitors and shows a
gentle empty state for record keepers ("Mark a document Public to show it here"). The
default page template (`GroupPageTemplate::STARTER_BLOCKS`) doesn't change; groups add
these blocks themselves.

Events: add a `conscience_agenda` block type to plain `EventBlocks::TYPES` so a business
meeting's event can show the live agenda (linked by `business_meetings.event_id`).

## Notifications

Using `Notification.deliver`, as group joins and events already do:
- Record keepers: a member suggested an agenda item.
- Members: minutes posted; a business meeting scheduled (one notification, linking to it).
- No notification per motion or per document edit; that would be noisy.

## API (Rails)

Nested under `api/groups/:slug`, like `meetings`, `books` and `events`:

```
resources :business_meetings, only: %i[index show create update destroy] do
  resources :agenda_items, only: %i[create update destroy] { post :reorder, on: :collection }
end
resources :motions, only: %i[index create update destroy]
resources :documents, controller: "group_documents", only: %i[index show create update destroy] do
  get :versions, on: :member
  post "versions/:version_id/restore", action: :restore, on: :member
end
get :conscience_search   # member route on groups
```

Each controller loads the group with `Group.visible_to(current_user)` (Public documents
through a separate unauthenticated read for the blocks, as the group page does now), and
checks `records_editable_by?` for writes. JSON follows the existing `as_api_json(viewer:)`
pattern. Front end goes in `app/javascript/components/groups/conscience/`.

## Anonymity

Minutes and decisions are read by every member and sometimes printed. The editors show a
quiet reminder under name fields and the minutes box: "First names and last initials only".
Names are plain text, not links to profiles, so a record never exposes someone's account.
Public documents get a one-line check before saving ("This will be visible to anyone who
opens the group's page").

## Build order

1. **Documents** (built; see "As built" below): tables, upload + write, folders, visibility, history, search, Documents
   tab and `documents` block. Useful on day one (format, guidelines).
2. **Decisions log** (built; see "As built: step 2" below): `motions` without meetings first, backfill-able, Decisions view and
   `decisions` block.
3. **Business meetings**: meetings, agenda items (member suggestions), minutes, recording
   motions in place, Overview, notifications, `business_meeting` block, event tie-in, print view.
4. Later, only if wanted: service positions with terms and rotation reminders, structured
   treasurer's reports (income, expenses, prudent reserve, 7th Tradition splits), online
   voting.

Each step is one PR with migrations, model tests (`test/models`), controller tests for the
permission table above (`test/controllers`), and screenshots in
`/mnt/project-files/group-conscience/`.

## Open questions (with the defaults I'd go with)

1. **Online voting?** No, but a vote tally can be added by a secretary.
2. **Who keeps records?** Default: group admins plus members an admin marks as record
   keepers. Alternatives: admins only (simpler, but the secretary often isn't an admin),
   or tie it to holding a service position (needs the service positions feature first).
3. **Public documents?** Default: **allowed**, but every document starts Members-only.
   Lets a group show its format and guidelines on its public page.
4. **Tab name.** Default: "Group conscience". Alternative: "Business".
5. **Who sees it?** Default: same gating as Groups (site admins unless `GROUPS_FOR_EVERYONE=1`).
6. **Documents: Markdown or the book editor (Tiptap)?** Decided: Tiptap (see "As built: documents as pages"). The original default was Markdown, matching notes
   and event blocks, with GFM tables for treasurer's reports. Tiptap is heavier but would
   give a Word-like toolbar; say if the people writing minutes would rather have that.
7. **Uploads as-is?** Default: yes, files stay files (PDF/DOCX/XLSX shown or downloaded);
   no conversion of Word documents into Markdown in v1.

## As built: step 1 (Documents)

What differs from the plan above:

- `group_documents.approved_by_motion_id` waits for step 2 (there are no motions yet).
- The tab is `Group conscience` with the documents view only; the secondary bar (Overview,
  Business meetings, Decisions) arrives with those steps. `/conscience` shows the folders.
- Search is `GET /api/groups/:slug/documents?q=` (ILIKE over titles and text); the group-wide
  `conscience_search` comes when there is more than documents to search.
- Version rows hold the copy a save replaced (its author and date), so the History list is
  "what it was before each change"; restoring is a new save. A save that leaves title,
  text and file alone (visibility, pinning...) makes no version.
- Visitors read Public documents at `/groups/:slug/conscience/documents/:id` (in
  `GroupsController::PUBLIC_PATHS`); the History view is for members.
- Files are served by `GET .../documents/:id/file` (not a storage URL), so changing a
  document from Public to Members takes effect at once. PDFs and pictures show inline;
  Word and Excel files download.
- Drafts and archived documents are only seen by record keepers.
- `Markdown` (components/book/Markdown.jsx) now renders GFM tables, for treasurer's reports.
- Position within a folder is set on creation (last); there is no drag-to-reorder yet, and
  pinned documents lead.

## As built: step 2 (Decisions)

What differs from the plan above:

- `motions` has no `business_meeting_id` or `agenda_item_id` yet; step 3 adds them. Until then
  the Decisions view has no link to a meeting.
- `group_documents.approved_by_motion_id` is added now (it waited for this step). A document
  can only be adopted by a decision its group passed; the badge ("Adopted Mar 3 by group
  conscience") shows only to people who may see that decision, so a Public document never
  leaks the title of a Members-only one.
- Vote counts are nullable, so a past decision can be typed in without one.
- `status` defaults to `passed` and a passed, failed or tabled decision needs its date.
- A replacement only counts once it passed: a failed or merely proposed "replaces" leaves
  the old decision standing. A decision can't replace one of another group, itself, or
  anything that leads back to it.
- Visitors see Public decisions that passed. A Public decision replaced by a Members-only one
  shows as replaced, with the date but not the new decision's title.
- Deleting a decision (group admins) makes what it replaced standing again and un-adopts
  documents; the confirmation says so.
- `/conscience/decisions` is linked as `?open=<id>` from the block and from a document's
  badge, and scrolls to and opens that decision. The section bar (Documents, Decisions) is
  for members, and a select on phones.
- Search is `GET /api/groups/:slug/motions?q=`; the standing/failed/tabled and kind filters
  run in the browser over what the viewer may see.

## As built: documents as pages (Tiptap)

Open question 6 was answered with Tiptap, so documents are now written like a word processor's page.

- **The page**: a document at `/conscience/documents/:id` is a white page on a grey desk
  (`DocumentPage.jsx`). Record keepers type straight into it, with a ribbon above (undo, text
  style, bold/italic/underline/strike, alignment, lists, quote, divider, link, tables, import).
  Everyone else reads the same page without the ribbon. Ctrl/⌘+S or Save keeps it (one
  version per save). `/documents/new` is a blank page; `/documents/:id/edit` is the same page.
  Folder, who can see it, status, pin, adopted-by and the attached file are under Details.
- **Top bar**: Share link (copies the address, says who can open it, and lets record keepers
  change that on the spot; it isn't a new version) and Save as PDF (the browser's print, with a
  print stylesheet that shows only the page at Letter size and 0.75in margins). A document that
  is only a PDF shows Download PDF instead.
- **Storage**: `body_format` is `html` (Tiptap's output, run through `DocumentHtml.sanitize`
  on every save: only the editor's tags, `href` with http/https/mailto/relative, `colspan`,
  `rowspan` and `text-align`) or `markdown` (documents from before). A Markdown document is
  converted to HTML in the browser when it is opened, and saves as HTML; versions keep the
  format they were written in. Search ignores tags (`GroupDocument.search`).
- **Import**: in the browser. `.docx` goes through mammoth (headings, bold/italic/underline,
  lists, tables, links; Word's paragraph alignment and pictures aren't kept). `.rtf` goes
  through `lib/rtf.js` (headings from style names, inline styles, alignment, lists, tables,
  Unicode and Windows-1252 accents). Old `.doc` asks for a `.docx`. In the documents list,
  Import makes an editable document (dropping a .docx/.rtf does the same); Upload keeps a file
  as it is.
- **PDFs** are read in the page with pdf.js (`PdfViewer.jsx`): pages are drawn as they scroll
  into view, with zoom, a page count and a text layer for selecting and copying. Pictures show
  inline; Word and Excel uploads download.
- Not done: pictures inside a document, comments, real server-side PDF files (Save as PDF is
  the browser's print dialog), live multi-person editing.

## As built: steps 3 and 4

Built: business meetings (agenda, minutes, decisions made at them, event tie-in, print sheet,
notifications, page and event blocks, Overview), service positions with terms and rotation
reminders, and the treasurer's monthly report as numbers. Differences from the plan:

- **Tabs**: Overview, Meetings, Decisions, Documents, Service, Treasury. The Overview is the
  tab's home (`/conscience`); documents moved to `/conscience/documents`. Anyone who isn't a
  member still lands on the public documents at `/conscience`.
- **Minutes** are written in the same editor as documents (HTML, cleaned by `DocumentHtml`),
  not Markdown, so a secretary gets the same ribbon. "Start from the agenda" fills in the
  headings, each item's decisions, and who chaired and kept the minutes.
- **Agenda details** are plain text (short), not Markdown.
- **Visitors** never see business meetings. The `business_meeting` page block shows them the
  date only when a *published* event announces the meeting; the agenda is for members (also
  on the event page).
- **Events**: only group admins can have an event made (that's the existing rule for
  creating events); a record keeper who isn't an admin gets a clear message.
- **Notifications** are as planned: suggestions to record keepers; scheduled meetings and
  first-posted minutes to members. Plus one new kind, a service term nearly up
  (`service.rotation` to record keepers, `service.term_ending` to the person serving).
- **Service positions**: held by a name, optionally linked to a member. Past holders are kept
  as history. There is no scheduler in this app, so reminders go out when a member opens the
  Service tab or the Overview, and `bin/rails group_service:remind` covers every group from cron.
- **Treasury**: money is whole cents in US dollars. The split applies to what is above the
  prudent reserve; a month that ends under the reserve shares nothing and says how far short it
  is. A new report starts from the last one (what it ended with, the reserve, the split and
  the usual lines). Lines left without an amount aren't saved. Reports for members are
  "posted"; the older "treasury" document folder still exists for scans and spreadsheets.
- **Printing**: meetings and reports print as a clean sheet through the browser's print
  (Save as PDF), like documents.

### Online voting: decided, won't be built

The group votes in the room, so the app is only a record of it. There will be no online voting,
and nothing below needs answering. (These were the open questions: who may vote, secret or
open ballots, how long a vote stays open and what carries it, and whether an online result
replaces the vote in the room.)

## As built: Robert's Rules

The group uses all of Robert's Rules (the handout it follows is a short summary of them) and
the app records what happens in the room. It never blocks a record; it says where one doesn't
follow the rules.

- **Every kind of motion**: main, amend, postpone indefinitely, commit/refer, postpone to a
  certain time, limit/extend debate, previous question, lay on the table, fix the time to
  adjourn, adjourn, recess, question of privilege, orders of the day, point of order, appeal,
  suspend the rules, objection to consideration, divide the question, division of the
  assembly, parliamentary inquiry, withdraw a motion, take from the table, rescind or amend
  something adopted, reconsider, discharge a committee (`MotionKinds`). Each carries what the rules say:
  second, debatable, amendable, the vote that carries it, its rank, and what it does to the
  motion it applies to. "Robert's Rules at a glance" on the Meetings page shows the table.
- **Recorded per motion**: who moved and seconded it, how it was voted (voice, standing,
  show of hands, ballot, roll call, general consent), the count, the vote the rules (or your
  bylaws, set on the motion) ask for, previous notice for a rescind, the committee it went
  to, what it was postponed to, the motion as amended, and a note (a chair's ruling).
- **Warnings** (record keepers only): no second recorded; a count that doesn't carry it
  (a majority is more than half of the votes cast, a tie is lost, abstentions don't count;
  two thirds; appeals: a tie sustains the chair); a two-thirds vote taken by voice; a motion
  that ranks below the one pending (out of order); a motion that applies to nothing; business
  done without a quorum. They show as you type and on the record, and the record still saves.
- **Effects**: a passed "lay on the table", "refer", "postpone", "postpone indefinitely",
  "take from the table", "reconsider" or "amend" changes the motion it applies to (and
  carries its agenda item forward or crosses it off). Editing or deleting the later motion
  doesn't undo that; change the motion itself.
- **Decisions vs procedure**: only main motions and rescinds are decisions (the log, the
  Overview, the page block, "standing"). Everything else is under "Procedure" and inside the
  motion it applies to. A meeting lists its motions in the order they were made, with the ones
  made on a motion under it.
- **Unfinished business**: tabled, referred and postponed motions are offered on the next
  meeting's agenda ("Put on the agenda"), then stay off the list.
- **Quorum**: set from the bylaws as a number of people or a share of the members (group
  admins, on the Meetings page). A meeting with fewer people is flagged, and so are motions made
  without one (except to adjourn, recess, fix a time or a question of privilege).
- **Meetings** also keep the time called to order and adjourned; the minutes skeleton and the
  print sheet say who moved, seconded and how each motion came out.
- Not modelled: debate (who spoke, in what order), the chair's recognition, and the precedence
  stack as it happens; the chair runs those in the room.
