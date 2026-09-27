# ACID QUEST

The Topicificator, presented as a top-down 16-bit journey the whole room takes together.
One person drives the device (the Guide); the room is the party. The game adds choice,
variety and continuity around the existing topic library; it never scores or judges sharing.

Play it at `/game/game`. Generated-world overview for tuning: `/game/world?seed=777`.

## Design rules (keep these)

- **The computer provides the adventure; the group provides the game.** Mechanics serve the loop:
  pick a topic → choose how to approach it → share (~3 min) → group choice → continue.
- **Passing is always fine.** Pass is on every topic screen ("Some paths aren't ours to walk
  today."). A pass still moves the journey on, still earns a trail coin, and is never counted,
  shown or logged in stats.
- **Risk is voluntary.** Risky choices can earn things; declining never costs anything.
- **No scores, rankings or judging.** Journey stats describe the trip (miles, stories, encounters).
- **Topics always come from the Topicificator library.** The live game never invents prompts.
- **Never more than one obstacle before any stop** (a locked gate counts as one), none near
  spawn or early in a journey.
- **Resources are group totals and flavour only.** Courage / Connection / Hope are never shown
  per person and never gate the core loop.
- Keep it light. This is not meant to become a full RPG.

## Core loop and features (Phase 1, done)

- **Journeys** use a Topicificator topic set (chosen at "New journey").
- **The road forks**: panel listing the nearest reachable stops with deterministic place names
  ("Willow Pasture · Gratitude"); pick with 1–4 or tap the map.
- **Topic card** (`quest/ui/topic_flow.js`): the topic is the headline; "Choose your path" offers
  three sharing lenses (at least one gentle). "Different topic" stays in the topic's category.
  Quiet 3-minute timer ("The journey continues…", chime off by default). Keyboard: 1–3, P, Space, Enter.
- **Sharing modes** (`sharing_modes` table, seeded from `db/seeds/sharing_modes.rb`): reusable
  lenses (Story, Check-In, Lesson…) whose prompts say "this" under the topic heading, so no
  per-topic wording is needed.
- **Categories**: every stop shows its category (plate icon + pixel label on the map, header and
  lens icons on the card). Topics without a category are the **Open Road** (signpost icon;
  `category_id=none` in draws).
- **Encounters** (`quest/encounters.js`): topic stops, Mystery (random topic + random lens,
  gives a tool), Merchant (3 wares for 1 trail coin: a named topic, a topic from a category, a
  mystery topic that may hold a legendary tool; credit when broke), Campfire (gentle lenses,
  "just check in"), Ghost (a voluntary question; finishing earns a Spirit Lantern), Cannon (fly
  to any path/stop in view, over obstacles; one shot), town houses/wells/castles (castles lean
  12 Steps; wells give a tool).
- **Tools** (`quest/tools.js`): boat/pickaxe/axe/rope each have 1–5 uses (5 rarest); each
  obstacle crossed uses one; duplicates merge (capped at 5); legendary tools never wear out.
  Spirit Lantern uses unlock "Someone else shares" (otherwise hidden). 9-slot toolbar with
  durability bars; legendaries glint.
- **Help**: when every reachable stop is blocked, "Ask for help" opens by itself — a wandering
  merchant (default) or call a friend (`?help=friend`) trades a tool for a story.
- **Journey log + Quest Complete**: `quest_log_entries` (structured facts only, no free text, no
  participant data). "End journey" shows stats and the topics explored, with a copy button.
  `GET /api/v1/quest_sessions/:id/journey` returns the summary Phase 3's story generator will read.
- **World generation** (`quest/world/*`, pure functions of the seed, no Phaser):
  big smooth plateaus/basins (3 levels), bending rivers 1–4 tiles wide, towns (well, 3–6 houses,
  gardens, connecting paths), castles far from towns, an 8-tile safe zone at spawn. Player paths
  are windy random walks (8–13 tiles), 2 tiles apart, stops 3+ tiles apart.
- **Art**: ClassicRPG sheet (`quest/assets/classic_rpg.png`) plus a generated supplement
  (`classic_rpg_extra.png/json`, tool/item icons in `quest/assets/icons/`) built by
  `python3 script/quest/build_extra_tiles.py` (stdlib only; rerun after editing it).

## Phase 2, part 1: gameplay (done)

Decisions made with the user: gameplay before content; the dial shows *before* the topic; HUD
counters for the resources; gates open by room vote only.

- **Choice vs. risk dial** (`APPROACHES` in `quest/encounters.js`, `showDial` in
  `topic_flow.js`): regular stops (`dial: true`: topic plates, houses, wells, castles) open on
  "Which way in? Ask the room:" SAFE (pick 1 of 3 from the category, "Three others") /
  CURIOUS (default, Enter) / RISKY (a topic from anywhere; no "Different topic", take it or
  pass) / CHAOS (random topic + random lens). Pass is on the dial too. Merchant, campfire,
  mystery, ghost and Memory Stone keep their own approach.
- **Courage / Connection / Hope** (`quest/resources.js`, mirrored in `JourneyStats`): derived
  from share log entries, which now carry `approach`. Courage = sharing after RISKY/CHAOS or at
  a ghost/mystery; Connection = Connection lens, campfire, house; Hope = Looking Forward /
  Gratitude / Change lenses or a revisit. Passes never count. Kept in `game_state.resources`
  for the HUD (older journeys pick theirs up once from `/journey` stats) and shown on Quest
  Complete (`hope_found`, `gates_opened` added to stats).
- **Revisit + Memory Stone**: "Revisit an earlier topic" on the dial and lens screens (only once
  something has been shared); the Memory Stone (`kind: "memory"`, ~6% of new stops, never
  before a first share) opens straight on that list. Picking a topic goes to a share with a
  lens not yet used on it (`game_state.topic_modes`), approach `revisit`. History entries now
  store `subtitle` and `topic_category_id` for this.
- **Locked gates** (`placeGate` in `world/paths.js`, grid types `gate` / `gate_open`): only on
  branches to rarer stops (`GATED_KINDS`, 35%), never on the first branch from a stop, never
  before stop 3, never alongside another obstacle. Routes avoid gates like obstacles; the fork
  row says "· locked gate". Choosing a gated road opens a vote card (1 open / 2 find another
  way); opening is always possible, so a gate never blocks for good. Logged as `gate`.
- **Fog** (`fogAt` in `world/terrain.js`, `world.cell().fog`): noise banks over ~17% of the map,
  none within 18 tiles of spawn. Unvisited stops inside show a grey closed-eye plate and read
  "??? · Hidden in the fog" in the fork; reaching one reveals it. Fog lifts around visited
  stops, the traveler and along carved roads. Drifting 2-frame tiles with dithered edges.
- **Art**: `gate_{v,h}`, `gate_open_{v,h}`, `memory_{0,1}`, `fog_{a,b}`, `fog_edge_{a,b}` in
  `build_extra_tiles.py`.
- Also fixed: the card's pop-in animation borrowed the toast's `translate(-50%)` and slid in
  from the left; `run_all.sh` now counts a script that crashes part way as a failure.

## Where things live

| Area | Files |
|---|---|
| Page + styles | `app/views/game/game.html.erb`, entry `app/javascript/entrypoints/quest.js` |
| App shell (screens, HUD, toolbar, saves, help, cannon) | `app/javascript/quest/quest_app.js` |
| Map (Phaser scene: drawing, movement, generation hooks) | `app/javascript/quest/game_scene.js` |
| World generation + movement rules (no Phaser) | `app/javascript/quest/world/{noise,terrain,settlements,world,paths,names,tiles}.js` |
| Card flow / fork panel / summary | `app/javascript/quest/ui/*.js` |
| API | `Api::V1::QuestSessionsController` (+ `journey`, `complete`), `QuestTopicsController` (`draw`, `categories`), `SharingModesController`, `QuestLogEntriesController` |
| Stats | `app/services/journey_stats.rb` (resource rules mirror `quest/resources.js`) |
| Approaches, encounter kinds, gate odds | `app/javascript/quest/encounters.js` |
| Category backfill | `lib/tasks/topic_categories.rake` |

Game state lives in `QuestSession.game_state` (client-owned JSON: `version: 3`, `seed`, `grid`
of carved tiles/visits, `current_position`, `tools`, `coins`, `topic_modes`, `history`). Older
v2 journeys (no seed) load as a flat meadow; older item counts convert to tools.

## Testing

`script/quest/e2e/run_all.sh` runs everything (needs `bin/dev` on localhost:3000, Google Chrome,
and `npm i --no-save playwright-core`). Output and screenshots go to `tmp/quest-e2e/`.

- `world_invariants.mjs`, `path_rules.mjs`, `tools_unit.mjs`, `phase2_unit.mjs` — pure Node
  checks over 100 seeds (safe zone, castle/town spacing, town connectivity, determinism, one
  obstacle per branch, stop spacing, tool merging, fog placement, gates, resource rules).
- Browser suites (`core_loop`, `encounters`, `tools_merchant_ghost_cannon`,
  `obstacles_help_towns`, `categories`, `tool_merge`, `phase2`) drive the real game with
  handcrafted states. Tip: navigate away from a board *before* PATCHing a test state — the page
  saves on exit. Regular stops open on the dial: press Enter (curious) to reach the lenses.
- `soak.mjs [steps]` (not in `run_all.sh`): a long random journey on a real world; reports how
  often gates / fog / Memory Stones came up and any page errors.

## Loose ends

- **Vite live reload**: `config/vite.json` sets `host: 127.0.0.1` but the running dev server was
  started before that and listens on `::1`, so open tabs never get updates. Restart `bin/dev`.
- **Production data**: run `bin/rails topics:backfill_categories APPLY=1` after deploying
  (copies categories onto uncategorized topics by title; writes an undo file under `tmp/`).
- Migrations: `sharing_modes`, `quest_log_entries`, quest fields on `quest_sessions`; seed with
  `bin/rails db:seed` or `load "db/seeds/sharing_modes.rb"`.
- Journeys created before the backfill keep "Open Road" on stops already on their map.
- No auth on the quest API (as before this work): anyone with a screen name gets that player.

## Phase 2, part 2: content (next)

- **Topic metadata**: `topics.difficulty` (gentle / standard / deep, nullable), `topic_tags`
  (reuse `Tag`), `topic_sharing_prompts` (`topic_id`, `sharing_mode_id`, `text`, `status`
  draft/approved/rejected, `source` human/ai, `enabled`: curated wording or disabling a lens).
  `pickLenses` prefers approved per-topic wording, then the generic prompt.
- Once `difficulty` exists: RISKY and the ghost should prefer `deep` topics, campfires `gentle`.
- **Admin curation page** (`require_admin!`, like `Api::BooksController`) for prompts,
  difficulty and tags. Ask before bulk-editing Topicificator data.
- **Journey log viewer** for completed journeys.
- Not built: gates opened by a condition or by spending Courage (the user chose room vote only).

## Phase 3 (later, AI)

- Offline authoring: rake task drafts topic × lens wording with Claude (Ruby `anthropic` gem,
  Message Batches, structured output) into `topic_sharing_prompts` as drafts; humans approve; the
  live game only uses approved wording.
- Post-meeting fictional story from the `/journey` JSON only (no people data exists), opt-in,
  clearly fiction, several styles.
