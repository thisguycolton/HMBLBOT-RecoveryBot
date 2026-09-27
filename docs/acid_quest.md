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
- **Never more than one obstacle before any stop**, none near spawn or early in a journey.
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

## Where things live

| Area | Files |
|---|---|
| Page + styles | `app/views/game/game.html.erb`, entry `app/javascript/entrypoints/quest.js` |
| App shell (screens, HUD, toolbar, saves, help, cannon) | `app/javascript/quest/quest_app.js` |
| Map (Phaser scene: drawing, movement, generation hooks) | `app/javascript/quest/game_scene.js` |
| World generation + movement rules (no Phaser) | `app/javascript/quest/world/{noise,terrain,settlements,world,paths,names,tiles}.js` |
| Card flow / fork panel / summary | `app/javascript/quest/ui/*.js` |
| API | `Api::V1::QuestSessionsController` (+ `journey`, `complete`), `QuestTopicsController` (`draw`, `categories`), `SharingModesController`, `QuestLogEntriesController` |
| Stats | `app/services/journey_stats.rb` |
| Category backfill | `lib/tasks/topic_categories.rake` |

Game state lives in `QuestSession.game_state` (client-owned JSON: `version: 3`, `seed`, `grid`
of carved tiles/visits, `current_position`, `tools`, `coins`, `topic_modes`, `history`). Older
v2 journeys (no seed) load as a flat meadow; older item counts convert to tools.

## Testing

`script/quest/e2e/run_all.sh` runs everything (needs `bin/dev` on localhost:3000, Google Chrome,
and `npm i --no-save playwright-core`). Output and screenshots go to `tmp/quest-e2e/`.

- `world_invariants.mjs`, `path_rules.mjs`, `tools_unit.mjs` — pure Node checks over 100 seeds
  (safe zone, castle/town spacing, town connectivity, determinism, one obstacle per branch,
  stop spacing, tool merging).
- Browser suites (`core_loop`, `encounters`, `tools_merchant_ghost_cannon`,
  `obstacles_help_towns`, `categories`, `tool_merge`) drive the real game with handcrafted
  states. Tip: navigate away from a board *before* PATCHing a test state — the page saves on exit.

## Loose ends

- **Vite live reload**: `config/vite.json` sets `host: 127.0.0.1` but the running dev server was
  started before that and listens on `::1`, so open tabs never get updates. Restart `bin/dev`.
- **Production data**: run `bin/rails topics:backfill_categories APPLY=1` after deploying
  (copies categories onto uncategorized topics by title; writes an undo file under `tmp/`).
- Migrations: `sharing_modes`, `quest_log_entries`, quest fields on `quest_sessions`; seed with
  `bin/rails db:seed` or `load "db/seeds/sharing_modes.rb"`.
- Journeys created before the backfill keep "Open Road" on stops already on their map.
- No auth on the quest API (as before this work): anyone with a screen name gets that player.

## Phase 2 (next)

Design notes are in the Phase 2 section of the planning doc; the short list:

- **Choice vs. risk dial** on topic stops: SAFE (pick of 3) / CURIOUS (random from category) /
  RISKY (the encounter's topic) / CHAOS (random topic + lens). Voluntary risk earns Courage.
- **Fog** (hidden destinations; fork shows "???"), **Locked gate** (room vote or a condition;
  never blocks the only way forward).
- **Revisit**: "Revisit" action + Memory Stone encounter; pick a topic already discussed this
  journey, automatically with a lens not yet used on it (`game_state.topic_modes`).
- **Resources** Courage / Connection / Hope derived from the log (flavor and gates only).
- **Topic metadata**: `topics.difficulty`, `topic_tags` (reuse `Tag`), `topic_sharing_prompts`
  (curated per-topic wording or disabling a lens; statuses draft/approved), admin curation page.
- Journey log viewer for completed journeys.

## Phase 3 (later, AI)

- Offline authoring: rake task drafts topic × lens wording with Claude (Ruby `anthropic` gem,
  Message Batches, structured output) into `topic_sharing_prompts` as drafts; humans approve; the
  live game only uses approved wording.
- Post-meeting fictional story from the `/journey` JSON only (no people data exists), opt-in,
  clearly fiction, several styles.
