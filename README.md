# RecoveryBot

A home for 12-step recovery: a literature library you can read, highlight and share from, personal recovery tools (chips, step work, gratitude, a nightly 10th step, sponsorship), and everything a group needs to run itself, from its public page and meeting list to chat, hosting, business meetings and the treasury.

**Live:** https://recoverybot.hmblbot.com · **Help & docs:** https://recoverybot.hmblbot.com/docs

## Screenshots

| Group home page | Group conscience |
| --- | --- |
| ![A group's home page](docs/screenshots/group-home.png) | ![Group conscience overview](docs/screenshots/group-conscience.png) |
| **Host scheduling** | **Public meeting finder** |
| ![Host scheduling with open places](docs/screenshots/host-scheduling.png) | ![Find a meeting](docs/screenshots/meeting-finder.png) |

The screenshots show the app running locally with made-up demo data.

## Features

### Home, people and navigation
- A home feed (`/people`) of notes and highlights from you and the people you follow, with Today cards: next meetings, sobriety birthdays, events and anything waiting on you
- Profile pages laid out in the page editor, follows, and per-item visibility (private, followers, members)
- A sidebar grouped into Home, Recovery, Read, Meetings and your groups, with sliding sub menus, a collapsible icon rail on desktop, and a bottom bar on phones
- Site-wide search (press `/`), including hashtags, people, groups, readings and help pages
- Notifications with Web Push, an installable home-screen app (`/install`), pull to refresh, and skeleton placeholders while pages load
- Sign up with email (confirmed by link) or Google, behind a built-in "I'm not a robot" check

### Library and readings
- Recovery books with a chapter reader and search across all of them; books can be members-only
- Highlights with Markdown notes that support hashtags and @ mentions, reposts, comments and share links (`?hl=`) with rich link previews
- Share a highlight, a note or a whole Daily Reflection as a picture, a paged GIF or an MP4 video, with highlighter sweeps, fade-ins and speed controls
- Readings that members write and publish, a reading screen-share view for Zoom, and problem reports on text
- Topicificator (random discussion topics) and Service Readings
- Admin book, chapter and reading editors

### Personal recovery tools (`/recovery`)
- Sobriety day count with milestone celebrations
- Chips: 3D chips you can design, give to others, receive with an arrival pop-up, and share as a picture, GIF or video
- A step-work wizard for all twelve steps, one page at a time, with reading checklists, printing and versioned worksheets (site admins edit templates)
- Gratitude lists and a nightly 10th step inventory, with optional reminders, both shareable
- Sponsorship: sponsor profiles and invites, sharing step work with a sponsor; step answers and shares are encrypted at rest

### Groups
- Group home pages and events built in the page editor (blocks, live drag on desktop, arrows on phones)
- Memberships with roles: admin, record keeper, host coordinator, treasurer and host, each with its own section of the group dashboard
- Meetings linked to the AA Intergroup directory, a public meeting finder, and in-person meeting lists imported from local intergroups (feed, JSON, CSV or a saved file) with a weekly refresh
- Server-drawn maps (OpenStreetMap) with "Open in Maps"
- Group chat: channels you can reorder, replies, pins, reactions, pictures and files, group documents, link previews, @ mentions, blocking and reporting, and a blocked-words filter site admins manage
- Approved literature per group, polls (`/p/:code`) with live results on readings and motions, and schedule polls with a vote heat map
- HostDeck: host scheduling for every weekly meeting, open-spot flags, "Need a sub" requests, one-day covers, permanent swaps, and reminders
- Court-verification forms and emails

### Group conscience
- Bylaws and policies as live documents, with versions, PDF export, Word/RTF import and optional live co-editing
- A decision log with standing and superseded decisions
- Business meetings with agendas, member-suggested items, minutes, quorum and unfinished business
- Robert's Rules checks on records (the app records what the room decided; it never blocks)
- Elected officials with terms and rotation reminders
- Treasurer's reports with the prudent reserve and the split

### Help and site pages
- A help center at `/docs` with its own Notion-style Markdown editor, screenshots and worked examples on every page, plus `/about` and `/history`
- A privacy policy (`/privacy`) that lists every cookie, storage key and outside service, terms of use and a contact form

### Site Admin (`/admin_panel`)
- Overview, analytics (Ahoy, cookieless), users, readings, tags, contact requests and reports
- Meeting lists, blocked words, step worksheet templates and Docs editing
- Daily story: posts the day's Daily Reflection as a Facebook Page story
- Task board: a kanban board for site admins with tags, reorderable checklists, due reminders and cards in Today

## Tech stack

- **Backend:** Ruby 3.2.3, Ruby on Rails 8, PostgreSQL, Devise (with Google sign-in through OmniAuth), Action Cable, Active Storage, Active Record encryption, Ahoy for analytics, Sentry for error reporting
- **Frontend:** React 19 with Stimulus and Turbo, bundled by Vite (`vite_rails`), styled with Tailwind CSS 4
- **Editors:** Tiptap (with Yjs for live co-editing) and Lexical
- **Media:** ImageMagick for share cards, maps and quote pictures; ffmpeg for videos; gifenc and mp4-muxer for GIFs and videos drawn in the browser; three.js for the 3D chips
- **Documents:** pdf.js and mammoth (browser-side PDF reading and Word import)
- **Tests:** Rails' built-in Minitest, with Capybara system tests
- **Deployment:** Docker on CapRover

## Local setup

You need:

- Ruby 3.2.3
- Node.js 20 (the version the Dockerfile uses) and npm
- PostgreSQL (with `libpq-dev` on Linux)
- ImageMagick and ffmpeg, for share pictures, maps and videos

```sh
bundle install
npm install
bin/rails db:create db:schema:load
```

Then run the Rails server and the Vite dev server (two terminals; `Procfile.dev` lists both):

```sh
bin/rails s
bin/vite dev
```

The app is at http://localhost:3000. `bin/rails db:seed` is not meant for a fresh database (and should never be run in production, where it overwrites curated topics), so create content through the app or the importers in `lib/tasks/`. `bin/rails docs:import` loads the help center pages from `db/docs/`.

### Environment variables

Everything works locally without these; each one switches on a feature or points it somewhere else. Set them in CapRover under App Configs → Environmental Variables. Never commit their values.

| Variable | Effect |
| --- | --- |
| `ADMIN_EMAILS` | Comma-separated emails of site admins (Site Admin, Groups while it's admin-only) |
| `COURT_VERIFICATION_ADMIN_EMAILS` | Older name, still read when `ADMIN_EMAILS` isn't set |
| `GROUPS_FOR_EVERYONE=1` | Opens Groups and profiles to every account |
| `APP_HOST` | Host used in emailed links (defaults to recoverybot.hmblbot.com) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Shows "Sign in with Google". Redirect URI: `https://<host>/users/auth/google_oauth2/callback` |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Lets Site Admin → Daily story connect a Facebook Page. Redirect URI: `https://<host>/admin_panel/facebook/callback` |
| `FACEBOOK_LOGIN_CONFIG_ID` | Needed only when the Meta app uses Facebook Login for Business |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push. Make a pair with `bin/rails web_push:keys`; without them push is hidden |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Use Cloudflare Turnstile instead of the built-in ALTCHA robot check |
| `COLLAB_EDITING=1` | Live co-editing of group documents |
| `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | AI drafting for The Acid Quest's stories and prompts |
| `AA_INTERGROUP_FEED_URL` | Overrides the AA Intergroup meeting feed |
| `MAP_TILE_URL`, `GEOCODER_URL` | Override the OpenStreetMap tiles and Nominatim geocoder used for maps |
| `APPLE_SMTP_USERNAME`, `APPLE_PASSWORD` | Outgoing mail in production |
| `POSTGRE_SQL_HOST`, `POSTGRE_SQL_PASSWORD` | Production database |
| `SECRET_KEY_BASE` | Production secret. Changing it makes encrypted step work unreadable unless the `ACTIVE_RECORD_ENCRYPTION_*` keys are set to the old values first |

### Scheduled jobs

The server runs its own reminders in the background (meeting hosts every 10 minutes, gratitude and 10th step every 5, Task board hourly). Each also has a rake task to run by hand: `meeting_hosts:remind`, `recovery:remind`, `admin_tasks:remind`, `group_service:remind`, `meeting_lists:refresh` and `aa_intergroup:sync`.

## Tests

The front end must be built for the test environment once before controller and system tests that render pages can pass:

```sh
RAILS_ENV=test bin/vite build
bin/rails test           # unit, controller and integration tests
bin/rails test:system    # browser tests (needs Chrome)
```

A handful of old scaffold-generated tests are known to fail on `main`; compare against `main` before assuming a failure is new. The site blocks headless browsers it doesn't recognize, so Playwright or other scripted browsers need a normal user agent.

## Deployment

Production runs on CapRover from the `Dockerfile` and `captain-definition`. Merging to `main` does not deploy.

Deploy with `bin/deploy [ref]` (for example `bin/deploy origin/main`). It exports the committed code at that ref, builds the Vite assets on your machine (building them on the server runs it out of memory), checks the icon chunks, and uploads one tarball. Set `CAPROVER_APP_TOKEN` in your shell to use the app's deploy token instead of a saved `caprover login`.

On start the container runs `rails db:migrate` and then Puma. The image installs ImageMagick and ffmpeg. After a deploy that changes help pages, run `bin/rails "docs:refresh[reviewed]"` on the server to pick up the new text (it only replaces pages whose words nobody changed, and keeps the old text in History).

Production logs go to STDOUT, so CapRover's app logs show them.

See `AGENTS.md` for an architecture guide to the codebase.
