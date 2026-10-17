# AI Agents Guide - RecoveryBot

This guide provides essential architectural and operational knowledge for AI agents working on the RecoveryBot codebase.

## 🏗 Architecture Overview
RecoveryBot is a Ruby on Rails 7 application designed to support recovery and 12-step programs.

### Tech Stack
- **Backend**: Ruby on Rails 7, PostgreSQL
- **Frontend**: React components (JSX) integrated with Stimulus.js and Vite for bundling.
- **Deployment**: CapRover / Docker

## 📂 Key Components & Logic

### 📚 Literature Library
Manages recovery literature (Books, Chapters, Readings).
- **Models**: `Book`, `Chapter`, `Reading`
- **Logic**: Literature is structured hierarchically. Imports and exports are handled via JSON payloads in `Api::BooksController` and supported by services like `LiteratureImporter`.
- **Frontend**: Uses rich text editors (Tiptap/Lexical) for content management (`ChapterEditor.jsx`, `ReadingEditor.jsx`).

### 🗣 Topicificator & Hostificator
- **Topicificator**: A randomized topic generator for group discussions. Uses `TopicSet`, `TopicCategory`, and `Topic` models.
- **Hostificator**: A voting system for proposing and selecting hosts/proposals (`Hostificator`, `HostProp`, `HostVote` models).

### 🎮 Quest System (Game Logic)
An API-driven system for tracking game state, inventories, and player progress.
- **Models**: `QuestPlayer`, `QuestSession`, `QuestInventory`
- **API Endpoints**: Located in `app/controllers/api/v1`. Handles player creation, session joining (via `join_code`), and game state persistence (grid position, points, inventory).

### 🤝 Groups & Meetings
- **Models**: `Group`, `GroupMembership` (roles `admin`/`member`, status `active`/`requested`), `Meeting` (weekly: one row per weekday, or once), `GroupBook` (approved literature), `OiaaMeeting` (cached OIAA directory).
- **AA Intergroup**: called "AA Intergroup" everywhere people see it (internally still `Oiaa*`). `OiaaFeed` reads its Meeting Guide JSON feed (https://data.aa-intergroup.org/, or `AA_INTERGROUP_FEED_URL`) into `oiaa_meetings`, in the background at boot and when a week old. Meetings linked by `oiaa_slug` refresh from it; `bin/rails aa_intergroup:sync` fetches it by hand.
- **Access**: admin-only while it's tried out (`Group.feature_open_to?`); `GROUPS_FOR_EVERYONE=1` opens it to every account. People already in a group always see it.
- **Frontend**: React app at `/groups` (`entrypoints/groups.jsx`, `components/groups/`), JSON under `/api/groups`. The profile page (`/users/edit`) is `entrypoints/profile.jsx`.
- **Court verifications**: `/court_verifications/new?group=<slug>` is a group's own form (unlinked, like the plain one).
- **Group pages**: a group's Home tab is laid out in the HMBLBOT Editor (`/groups/:slug/page/edit`, group admins), the same editor events use (`components/events/editor/EditorFrame.jsx`). Blocks live in `groups.page_blocks` (nil = the default page, `GroupPageTemplate`, which site admins edit at `/groups/default-page/edit`); `EventBlocks::GROUP_TYPES` adds the group's own blocks, and every block has a palette `color`. AA Intergroup groups not here yet show the default page at `/groups/find/:oiaa_slug`. `GroupPage` (app/services) builds the JSON.
- **Group conscience** (`/groups/:slug/conscience`, members' tab; plan in `docs/group_conscience_plan.md`): steps 1 (Documents) and 2 (Decisions) are built. `GroupDocument` (kinds are the folders; `visibility` public/members/keepers; `status` draft/current/archived; `body` and/or an Active Storage `file`: PDF, DOCX, XLSX, pictures, 20 MB; `body_format` `html` (written in the Tiptap editor, cleaned on save by `DocumentHtml`) or an older `markdown`, converted when first opened in the editor) with `GroupDocumentVersion` keeping the copy each save replaced (`GroupDocument#revise` / `#restore`). **Record keepers** are members with `group_memberships.can_keep_records` (switched on in the Members tab); `Group#records_editable_by?` = admins, site admins and keepers. `GroupDocument.visible_to(group, user)` is the one place that decides who sees what: visitors get current Public documents, members also Members ones, keepers everything. JSON under `/api/groups/:slug/documents` (`Api::GroupDocumentsController`, files served through it so visibility is enforced); UI in `components/groups/conscience/`: a document is a page (`DocumentPage.jsx`, `DocumentToolbar.jsx`, `editorKit.js`, `documents.css`) that record keepers edit in place, with Share link (`ShareMenu.jsx`) and Save as PDF (the browser's print, styled in `documents.css`) in the top bar; Word (.docx via mammoth) and RTF (`lib/rtf.js`) files import into it (`lib/documentImport.js`, in the browser), and PDFs are read in the page with pdf.js (`PdfViewer.jsx`). The `documents` HMBLBOT Editor block lists what the viewer may see, so a group can put its format on its public page. **Decisions**: `Motion` (table `motions`; status proposed/passed/failed/tabled/withdrawn, counts as counted in the room (nil for backfilled ones), `supersedes_id` for what it replaces, `minority_opinion`, category, `visibility` members/public). A passed motion no later passed motion replaces is **standing** (`Motion.standing`). `Motion.visible_to(group, user)`: visitors get Public decisions that passed, members Members and Public, keepers everything. `/api/groups/:slug/motions` (`Api::GroupMotionsController`; keepers write, group admins delete), UI `components/groups/conscience/DecisionsView.jsx` / `DecisionForm.jsx` at `/conscience/decisions`. A document can name the decision that adopted it (`group_documents.approved_by_motion_id`). The `decisions` HMBLBOT Editor block lists standing decisions the viewer may see. Next: Business meetings.
- **Timeline notes**: `TimelineNote` (Markdown like highlight notes, up to 6 pictures) on a member's timeline, which is the Timeline block of their profile; shared to their groups (`TimelineNoteShare`), members see them in a group page's Timeline block. UI in `components/notes/` (NoteEditor, FeedItem, VisibilityPicker).

### 👤 Profiles & follows
- `/people/:username` (`/people/me` is yours), React app `entrypoints/people.jsx`, JSON from `ProfilePage` (app/services) via `Api::PeopleController`. Same access as Groups (`User.profiles_open_to?`), signed-in only, never public on the web.
- Every user has a `username` (made from their name, changeable in settings). Their page is laid out in the HMBLBOT Editor at `/people/me/edit` (`users.page_blocks`, nil = `ProfilePage::DEFAULT_BLOCKS`; `EventBlocks::PROFILE_TYPES`: feed, about, groups, people plus heading/notes/photo/gallery).
- `Follow` (no approval; the followed person gets a notification). `/people` is the home page people land on after signing in (`after_sign_in_path_for`): Notes (yours and what people you follow share) in two thirds, and a third (folded on phones) with next meetings, sobriety birthdays and events from their groups (`PeopleHome`).
- `Visibility` concern on notes and highlights: `private` (default) / `followers` / `public` (shown as "Members": anyone signed in who can see profiles). New ones take `users.default_highlight_visibility` / `default_note_visibility` from settings. Highlight share links work whatever this says.

### 🛠 Services
Business logic for complex operations (e.g., importing literature) is encapsulated in `app/services`.

## 🚀 Development Workflow

### Local Setup
- **Server**: Run `./bin/dev` to start the Rails server and Vite.
- **Database**: Use `rails db:setup` for initial configuration.

### API Structure
- `/api/...`: General resource APIs (e.g., `Api::BooksController`). Some endpoints require administrative privileges (`require_admin!`).
- `/api/v1/...`: Specialized API for the Quest game system.

## ⚠️ Important Notes
- **Admin Access**: Many critical endpoints in the API and administrative panel require `admin` status on the `User` model.
- **Data Integrity**: When importing literature, ensure slugs are unique and formatted correctly to avoid collisions.
- **React Integration**: Frontend components are located in `app/javascript/components` and are rendered within Rails views.
