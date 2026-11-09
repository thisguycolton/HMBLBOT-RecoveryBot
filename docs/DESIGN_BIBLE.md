# RecoveryBot Design Bible

For Claude and other agents building UI in this repo. Written from the current docs screenshots (`public/docs-images/**`, also served at https://recoverybot.hmblbot.com/docs-images) and the tokens in `app/javascript/styles/tailwind.css` and `writebook.css`. Values marked **~** are read off a screenshot, so confirm the token in code before hard-coding anything. The older `docs/screenshots/*.png` show a previous top-bar layout and are out of date.

Screens reviewed: home page (logged out), home feed (phone), group page, Hosting, HostDeck, Group conscience > Treasury, profile page, Library chapter reader, Chips, 10th step (phone), Admin dashboard.

## 1. Personality

Calm, warm, plain-spoken. People in recovery, often on a phone, often new. Safe and unhurried.

- Generous white space, big rounded corners, soft shadows, almost no hard borders.
- One accent blue. Colour carries state and meaning, not decoration.
- Short human copy: "Come as you are", "Keep it going today", "I'll cover it". No jargon, no shouting, no shaming. The app records and suggests; it doesn't block.
- Privacy is stated plainly where it matters ("Only you can see your chips", "Private. Only you can ever read this here…") with a small lock icon.

## 2. The shell (every page sits inside it)

- **Sidebar** (left, ~18rem, `--side-w`; collapsible to ~4.75rem with "Collapse" at the bottom): light grey (~`#ececec`). Small uppercase eyebrow groups (YOU, YOUR GROUPS, EXPLORE; Admin has MENU / REVIEW / CONTENT / INSIGHTS). Items are icon + label, ~15px. The active item is a pill: white with accent text (member shell) or pale-blue fill with accent text (admin). Count badges are small accent-blue circles (Hosting "1"). Groups show a small rounded-square avatar with initials.
- **Top bar**: the logo (robot mark + "RecoveryBot" with "Bot" in brand blue `--color-brand`), then a wide rounded search field with a "/" shortcut chip, Donate (outline pill with heart), theme toggle, bell, and the account chip (avatar + name + chevron). Logged out: Log in (ghost) and Sign up (solid accent). Admin shows an accent "Admin" badge next to the logo.
- **The stage**: the rounded white panel the page sits in (`--radius-panel`, top-left corner visibly curved against the grey shell). Page content is a centred column inside it; reading and form pages use a narrower column (~760–900px).
- **Phone**: the sidebar goes away. A grey top bar (logo, search, bell) and a floating rounded **bottom bar**: menu, home, a large centred accent circle with the robot mark, calendar/Today, and settings or info. Floating page buttons sit at `bottom: calc(var(--shell-bottom,0px) + …)`.
- Full-window tools (HostDeck, Topicificator, chapter and reading editors) use a slim app bar instead: back arrow, group avatar + title + subtitle, then tool buttons on the right.
- Wide screens may show `PageAside` as a side panel beside the stage; on phones it becomes a sheet.

## 3. Color

| Role | Value | Use |
|---|---|---|
| Accent | `--color-accent` `#0b6ede` (`--wb-accent`) | Primary buttons, links, active tab/pill, icons, count badges |
| Accent tint | `--color-accent-tint` (16% accent on white) | Icon chips, "Join us" card, info banner, selected step |
| Accent ink | `--color-accent-ink` | Text on tinted accent surfaces |
| Accent light | `--color-accent-light` `oklch(76% 0.13 250)` | Links/accents in dark mode |
| Brand | `--color-brand` `#4c7ba6` | "Bot" in the wordmark |
| Hero gradient | blue `#0b6ede` ~ to violet ~`#4527d8`, diagonal | Group and profile heroes, meeting-card headers; the logged-out home hero is a deeper blue with an orange feature card |
| Shell grey | ~`#ececec` sidebar, ~`#f5f5f4` page behind cards | Behind and around the stage |
| Surface | white | Stage, cards, inputs |
| Dark surface | `--color-surface-dark` `#0d0d0f` | Dark-mode surface |
| Ink | navy-black ~`#0f172a` | Headings and body |
| Muted ink | slate ~`#475569` / `#64748b` | Subtitles, helper text, eyebrow labels |
| Warm notice | pale amber `~#fef3c7` fill, brown/orange text | "Open" and "Host" chips, streak banner, "Choose your reading" panel, nudges that need attention |
| Success | green dot/avatar ~`#16a34a` | Presence ("On Before we begin"), avatars |
| Highlights | `--hl-yellow/pink/lime/cyan/orange` | Highlighted reading text, notes (yellow is the default) |
| Chips (sobriety) | bronze, teal, purple, blue, green, gold, red, silver | Only on the chip artwork; locked/future chips are greyed |
| Avatars | solid colours (green, orange, indigo, blue) with white initials | People with no photo |

Rules:
- Use CSS variables, not literals. Dark mode exists (theme toggle), so every surface and text colour must come from a token that has a dark value (the `--calendar-*`, `--hb-*`, `--wb-*` families do).
- On gradient heroes, controls are translucent white glass (`rgba(255,255,255,.15–.25)` with white text); the single primary action is solid near-white with dark text.
- Red is only for Donate's heart, chips and destructive actions.

## 4. Typography

- Neutral sans (Inter look; the code names `"Public Sans", system-ui, sans-serif` via `--wb-font-reading`). Use `font-family: inherit`; never add a font.
- Page title (H1): very bold, tight tracking, large: ~44–52px desktop, ~56px on phone ("Notes", "10th step"). Hero titles are white and bigger.
- Subtitle under a title: 16–18px, muted, one sentence ("Where you're serving, and where your groups need a hand.").
- Section/card title: 17–22px, semibold.
- Body 16px / 1.5. Meta 13–14px muted.
- **Eyebrow labels**: 12px, UPPERCASE, letter-spaced, semibold, muted. They head sections outside cards (SUBS NEEDED, SOBRIETY, MEETING FLOW) and label form fields (MONTH, STATUS, HOST). Often preceded by a small outline icon. Type them in sentence case and uppercase in CSS.
- **Reading text** (library chapter): very large bold serif-free sans, justified, centred column; chapter title italic bold, chapter name uppercase. Highlights are marker-yellow with a small orange dot for a note.

## 5. Shape, elevation, spacing

- Radii: `--radius` 0.375rem, `--radius-md` 0.5rem, `--radius-lg` 0.875rem, `--radius-xl` 1.125rem, `--radius-2xl`/`--radius-panel` 1.75rem. Cards in screenshots look like ~20–28px; inputs, chips and buttons are fully round (pill).
- Shadow: `--shadow-panel: 0 4px 12px rgb(0 0 0 / .1)`; cards use a softer version, and often a faint 1px border instead. Tinted cards use a 1px pale-blue border.
- Spacing: ~8/12/16/24/32. Cards pad 20–28px. Sections are ~24px apart.
- Layouts: hero (full width of column) then tabs; two columns at about 2/3 + 1/3 (group home, profile: Timeline left, About / Groups / Following cards right); HostDeck is three columns (flow, current section, chat postings); stat tiles are three across; forms put two fields per row.

## 6. Components

**Gradient hero** (groups, profiles): `--radius-panel`, diagonal blue to violet. Group: name, description, glass chips (time zone, members, Website), darker "Next meeting in 1 day 10h · Mon, Nov 9, 6:30 AM MST" capsule with Join and a Passcode copy chip, then action pills (role badge, Dashboard, Edit page in solid light, Settings, Leave, Share). Profile: ring-bordered avatar, name, @handle, chips (followers, following, joined), Edit your page, Settings.

**Tabs**: icon + label, active in accent with a 2px underline under a hairline. Second-level tabs are **pills**: white with hairline border, active = solid accent with white text (Overview, Meetings, Decisions, Documents, HostDecks, Elected officials, Treasury, Templates). Always show a breadcrumb-style context above: group avatar chip + group name, then the H1, then a "‹ Treasurer's reports" back link in accent.

**Cards**: white, soft shadow, large radius. Optional leading **icon chip** (small rounded square, accent-tint fill, accent outline icon) next to a semibold title ("Timeline", "About", "Groups", "Following" with a count at the right). Empty state: one muted sentence, action on the right.

**Info banner**: pale-blue surface, pale-blue border, text left, small primary button right.

**List rows** (Hosting, admin "Waiting on you"): rounded row card; title with inline chip, muted date · group line, optional quote; action button right-aligned. Admin rows are bordered with a small grey count pill.

**Buttons**: Primary = solid accent pill, white text, icon left ("I'll cover it", Edit the page, Sign up). Secondary = white pill, hairline border, icon + dark text (Copy, Print, Give a chip, HostDeck). Disabled primary = washed-out blue (Save with nothing to save). Dark pill is for the second CTA on a coloured hero ("See how it works"). Icons: Lucide outline, ~16–20px, always paired with a label except in toolbars (give those an `aria-label`).

**Chips/pills**: "Host" amber, "Co-host" blue-tint, "Covering" grey; count badges accent circles; topic chips are white outline pills with icon ("Find a meeting", "HostDeck"); "New: …" announcement is a small tinted pill above a hero title.

**Form fields**: eyebrow label above, pill-shaped inputs (fully round) with a white fill and hairline border, muted placeholder; numeric amounts right-aligned; remove "x" is a muted icon; "+ Add a line" is a small outline pill. Selects have a chevron; date inputs use the native picker.

**Summary panel** (treasury): soft grey rounded panel, label left and amount right, bold totals, hairline dividers, small eyebrow for sub-groups (SHARED).

**Stat tiles** (admin): white card, icon chip top-left, muted label, big bold number, small muted detail line.

**Feed notes**: avatar (initials) + bold name + "Note · 5h ago" muted, "…" menu top-right, body, hashtags in accent, hairline, then action icons (like, love, hugs on the left; comment, repost on the right). Highlight notes show the marker-yellow quote, the source line with a book icon, a grey "YOUR NOTE" inset, and a visibility pill (Followers, Members) with chevron. The composer is a rounded box: placeholder, Photo pill, visibility pill, "Also share to" picker, Post note (disabled until text).

**HostDeck panels**: left = numbered steps (selected step is pale-blue with an accent number, others grey numbers); centre = eyebrow "CURRENTLY" + huge H1, a pale-amber callout when something still needs picking, white option cards in a two-column grid with icon chips, and a form card ("People doing service today"); right = chat posting cards (time, icon, title, Copy), share-with-co-host card with mono link, presence list with green dot. Section eyebrows throughout.

**Chips page**: a white card with a 4-column grid of round chip art, bold label and muted date; upcoming chip is greyed with "In 365 days".

**Streak/encouragement banner**: pale amber rounded bar, flame icon, bold line then encouraging text, small muted stats right.

**Sign-in-required sidebar card**: white rounded card with a short sentence and Log in / Sign up side by side.

**Toggle**: iOS-style, grey off, accent on, label to the right ("Remind me to do my 10th step").

**Yes/No segmented pill** (10th step): outline pill with two words; the chosen side fills.

## 7. Content and voice

- Sentence case everywhere; uppercase only on eyebrow labels (via CSS).
- Buttons are verbs: Join, Leave, Copy, Give a chip, Put someone on, I'll cover it.
- Plain counts and relative times first, absolute second: "Next meeting in 1 day 10h · Mon, Nov 9, 6:30 AM MST"; "5h ago".
- Say what's private and what's shared, right where the control is.
- Names: "RecoveryBot", "HMBLBOT Editor", "HostDeck", "Group conscience", "AA Intergroup" (see AGENTS.md). Keep Court verification out of the docs.

## 8. Responsive and accessibility

- Mobile first. Below ~768px: sidebar becomes the menu, single column, tabs scroll horizontally, two-column forms stack, side cards fold under the main column, bottom bar appears.
- Touch targets ≥ 40px; phone type is larger (titles ~56px, body 17–18px, big pill inputs).
- Never use colour alone: chips carry words, active tabs have an underline or fill, locked chips say when they unlock.
- Visible accent focus ring; icon-only buttons need `aria-label`.
- Test every new surface in light and dark.

## 9. Do and don't

Do
- Reuse components in `components/` (`shell/`, `groups/`, `notes/`, `share/`) and wrap new pages in `components/Layout.jsx`.
- Use tokens (`--color-accent`, `--radius-*`, `--shadow-panel`) and Lucide icons.
- One primary action per card or region.
- Pattern: eyebrow label, then card; icon chip + title inside the card.

Don't
- Add colours, fonts, hard dividers, or shadows heavier than `--shadow-panel`.
- Put long text in cards; one short paragraph, then the action.
- Add cookies, trackers or outside services without updating `/privacy` and its date.
- Rebuild a page with its own header and nav; the shell provides them.

## 10. Prompt snippet for agents

> Build in RecoveryBot's style: it lives inside the shell (grey sidebar, search top bar, rounded white stage; bottom bar on phones). Page = bold H1 + one muted sentence, UPPERCASE 12px muted eyebrow labels, white large-radius cards with soft shadow and an accent-tint icon chip beside the title, pill-shaped inputs and buttons, one solid accent `#0b6ede` primary action, Lucide outline icons with labels, pale-amber for things needing attention, blue-to-violet gradient hero with glass chips for groups and profiles. Use CSS variables so dark mode works, keep copy short and kind, and be single-column and touch-friendly on phones.

## Reference images

`public/docs-images/`: `getting-started/home-page`, `home-phone`; `group-tools/group-page`, `hostdeck`, `treasury-report`, `conscience`; `community/my-page`, `home-feed`; `library/chapter`; `step-work/chips`, `inventory-phone`; `site-admin/dashboard`. The rest of that folder shows every other screen in the same style.
