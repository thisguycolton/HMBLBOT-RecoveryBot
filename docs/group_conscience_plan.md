# Group Conscience organizer: plan

Planning only, nothing built yet. Written 2026-10-17. The Find a meeting work (PR #13), which sits on Profiles/Group pages (#12), Events (#11) and Groups (#10), is now merged to `main` (#14); build on `main`.

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

1. **Documents**: tables, upload + write, folders, visibility, history, search, Documents
   tab and `documents` block. Useful on day one (format, guidelines).
2. **Decisions log**: `motions` without meetings first, backfill-able, Decisions view and
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
6. **Documents: Markdown or the book editor (Tiptap)?** Default: Markdown, matching notes
   and event blocks, with GFM tables for treasurer's reports. Tiptap is heavier but would
   give a Word-like toolbar; say if the people writing minutes would rather have that.
7. **Uploads as-is?** Default: yes, files stay files (PDF/DOCX/XLSX shown or downloaded);
   no conversion of Word documents into Markdown in v1.
