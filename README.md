# RecoveryBot

A platform for running 12-step recovery groups: a literature library, group pages and meetings, and the record-keeping a group's business meeting needs.

**Live:** https://recoverybot.hmblbot.com

## Screenshots

| Group home page | Group conscience |
| --- | --- |
| ![A group's home page](docs/screenshots/group-home.png) | ![Group conscience overview](docs/screenshots/group-conscience.png) |
| **Host scheduling** | **Public meeting finder** |
| ![Host scheduling with open places](docs/screenshots/host-scheduling.png) | ![Find a meeting](docs/screenshots/meeting-finder.png) |

The screenshots show the app running locally with made-up demo data.

## Features

### Library
- Recovery books with search across all of them, and a chapter reader
- Shareable highlights with Markdown notes
- Problem reports on text
- Admin book and chapter editor

### Groups
- Memberships, with admin and member roles
- Meetings linked to the AA Intergroup directory
- Group home pages and events built in a Tiptap-based page editor
- Approved literature per group
- Court-verification forms and emails

### Group conscience
- Bylaws and policies as live documents, with PDF export and Word/RTF import
- A decision log
- Business meetings with agendas, minutes, quorum and unfinished business
- Robert's Rules checks on records (the app records what the room decided; it never blocks)

### Service
- Treasurer's reports with the prudent reserve and the split
- Officer terms and rotation reminders
- Host scheduling for 28 weekly meetings, with open-spot flags and one-day covers

### Community
- Profiles, follows and timeline posts
- A public meeting finder
- Schedule polls with a vote heat map

### Admin
- Overview, analytics, users, readings, tags and court verifications

## Tech stack

- **Backend:** Ruby 3.2.3, Ruby on Rails 8, PostgreSQL, Devise for accounts, Active Storage, Ahoy for analytics, Sentry for error reporting
- **Frontend:** React 19 with Stimulus and Turbo, bundled by Vite (`vite_rails`), styled with Tailwind CSS 4 and Bootstrap
- **Editors:** Tiptap and Lexical
- **Documents:** pdf.js and mammoth (browser-side PDF reading and Word import)
- **Tests:** Rails' built-in Minitest, with Capybara system tests
- **Deployment:** Docker on CapRover

## Local setup

You need Ruby 3.2.3, Node.js (the Dockerfile uses 20.x) and PostgreSQL.

```sh
bundle install
npm ci
bin/rails db:create db:schema:load
```

Then run the Rails server and the Vite dev server (two terminals):

```sh
bin/rails s
bin/vite dev
```

The app is at http://localhost:3000. `bin/rails db:seed` does not work on an empty database (it expects an existing topic set), so create content through the app or the importers in `lib/tasks/`.

A few features are behind environment variables:

| Variable | Effect |
| --- | --- |
| `ADMIN_EMAILS` | Comma-separated emails of site admins who can use the admin suite and Groups |
| `GROUPS_FOR_EVERYONE=1` | Opens Groups to every account |
| `AA_INTERGROUP_FEED_URL` | Overrides the AA Intergroup meeting feed |

## Demo data

For demo videos and screenshots, `bin/rails demo:seed` (development only) makes 8 fake groups, each with a logo, a cover and believable meeting times, and 33 fake people with cartoon pictures and the roles a group needs. It also imports the Big Book and the Twelve and Twelve from `db/imports/` into the library, adds both to every group's literature, and writes 10 readings cut from them, shared with the groups under their record keepers' names. Timeline posts come too: life updates (some with pictures), chips of every kind, notes written on someone else's page, shared highlights, reposts, reactions and comments. The pictures are drawn by `script/demo/make_images.py`, so Python 3 with Pillow is needed. Start the server with `ADMIN_EMAILS=sam.okafor@demo.example.com bin/rails s`, then open `/dev/users` to become any of them in one click (the password for all is in the task's output). `bin/rails demo:reset` removes it all.

## Tests

```sh
bin/rails test           # unit, controller and integration tests
bin/rails test:system    # browser tests (needs Chrome)
```

The front end must be built once (`npx vite build`) before controller tests that render pages can pass.

## Deployment

The app deploys to CapRover from the `Dockerfile` and `captain-definition`. The image builds the Vite assets, and the container runs `rails db:migrate` and then Puma on start.

See `AGENTS.md` for an architecture guide to the codebase.
