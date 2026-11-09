# RecoveryBot Design Bible

For Claude and other agents building UI in this repo. It is based on the four screenshots in `docs/screenshots/` (group home, group conscience, host scheduling, meeting finder) and the CSS tokens in `app/javascript`. Where a value is read off a screenshot rather than from code, it is marked **~** (approximate). Check the token in code before hard-coding anything.

## 1. Personality

Calm, warm and plain-spoken. The audience is people in recovery, often on a phone and often new. The app should feel safe and unhurried.

- Lots of white space, soft corners, soft shadows. No harsh borders and no dense data tables.
- One accent blue. Colour is used for state and meaning, not decoration.
- Copy is short and human: "Come as you are", "Put someone on", "No business meeting is scheduled." Avoid jargon and shouting.
- Never block or shame. The app records and suggests (see the Robert's Rules note in AGENTS.md).

## 2. Color

| Role | Value | Use |
|---|---|---|
| Accent | `--color-accent` `#0b6ede` | Primary buttons, active tab/pill, links, icons on cards |
| Accent tint | `--color-accent-tint` (16% accent on white) | Info banners, "Join us" card, icon chips |
| Accent ink | `--color-accent-ink` | Text on tinted accent surfaces |
| Accent light | `--color-accent-light` `oklch(76% 0.13 250)` | Links and accents in dark mode |
| Brand | `--color-brand` `#4c7ba6` | Logo / secondary brand touches |
| Hero gradient | blue `#0b6ede` ~ to indigo/violet ~`#4527d8`, diagonal (~135deg) | Group hero, meeting-card headers (darkened toward navy at the bottom) |
| Page background | light grey ~`#f5f5f4` | Behind cards |
| Surface | white | Cards, top bar |
| Dark surface | `--color-surface-dark` `#0d0d0f` | Dark-mode surface |
| Ink | near-black navy ~`#0f172a` | Headings and body |
| Muted ink | slate ~`#475569`, lighter ~`#64748b` | Subtitles, helper text, section labels |
| Donate | rose/crimson on a pale rose pill | The only warm accent in the chrome |
| Status "Open" | amber chip: pale yellow background `~#fef3c7`, brown text | Unfilled host places |
| Highlight marks | `--hl-yellow/pink/lime/cyan/orange` | Highlights and notes only |

Rules:
- Use CSS variables, not literals. The app has a dark theme toggle (moon icon in the top bar), so every colour must come from a token that has a dark value. The `--calendar-*`, `--hb-*` and `--wb-*` families already do.
- On the blue hero, controls are translucent white (glass): `rgba(255,255,255,.15–.25)` fill with white text. The one primary action there (Edit page) is solid near-white with dark text.
- Contrast: white on the hero blue is fine. Do not put muted grey text on the tinted blue surfaces; use accent ink.

## 3. Typography

- Family: **Inter-style neutral sans** in the screenshots. The code names `"Public Sans", system-ui, sans-serif` (`--wb-font-reading`), so use `font-family: inherit` and let the app set it. Do not introduce a new font.
- Page title (H1): very bold, tight, big. ~44–48px desktop, e.g. "Find a meeting". The hero title is bigger, ~52px, white.
- Section heading inside a page: ~28px bold ("Welcome to Sunrise Group").
- Card title: ~17–20px, medium/semibold.
- Body: 16px, line-height ~1.5.
- Meta / helper: 13–14px muted.
- **Eyebrow labels**: 12px, UPPERCASE, letter-spaced, semibold, muted slate ("NEXT BUSINESS MEETING", "HOSTS", "SUNDAY", "TIME OF DAY"). They label sections and sit above cards or fields, outside the card.

## 4. Shape, elevation, spacing

- Radii (tokens): `--radius` 0.375rem (inputs' inner bits), `--radius-md` 0.5rem, `--radius-lg` 0.875rem (cards), `--radius-xl` 1.125rem, `--radius-2xl` / `--radius-panel` 1.75rem (hero, big panels). Pills and chips are fully round (999px).
- Shadow: `--shadow-panel: 0 4px 12px rgb(0 0 0 / .1)`. Cards use a very soft version of this with no visible border. Selected or tinted surfaces get a 1px pale-blue border instead of a shadow.
- Content width: ~1150px centred (screenshot 1280 wide, ~64px gutters). The page top bar is full width; content below it is a centred column.
- Vertical rhythm: ~16px between small items, ~24px between sections, ~32px under hero. Cards have ~20–24px padding.
- Two-column pages: main column ~2/3, side column ~1/3 (group home). Collapse to one column on phones; side content folds into `PageAside` or a sheet.

## 5. Layout anatomy (what every page is made of)

1. **Top bar** (white, 1px bottom border, `--nav-h`): logo + "BETA" chip, nav dropdowns (Meetings / Library / Extras, with chevrons), then on the right the Donate pill, theme toggle, bell, Account menu. The active nav item turns accent blue.
2. **Back link**: "← Groups", small muted, above the page title.
3. **Page header**: either the plain title + one-line muted subtitle (Find a meeting), or the **gradient hero** (group pages).
4. **Tabs**: underline tabs with an icon and label, with the active one in accent blue with a 2px underline and a hairline under the whole row.
5. **Sub-pills** (second level, e.g. Overview / Meetings / Decisions…): rounded white pills with a hairline border, active one filled accent with white text.
6. **Body**: eyebrow label, card(s), repeat.

In the real shell (`components/Layout.jsx`) a sidebar and "stage" panel wrap React pages (see AGENTS.md "The shell"). The screenshots show the simpler top-bar layout. Use whatever the page's own entrypoint already uses.

## 6. Components

**Gradient hero (group header)**
Big rounded panel (`--radius-panel`), blue to violet diagonal gradient, white text. Order: group name, one-line description, small glass chips (time zone, member count), a darker "Next meeting in 13h 41m · Today, 2:00 PM" capsule with a glass Join button, then a row of action pills (role badge, Edit page, Details, Leave). Chips are 12–13px with icon. Action pills ~36px high, translucent.

**Cards**
White, `--radius-lg`, soft shadow, no border, 20–24px padding. Optional small icon chip (rounded square, accent-tint background, accent icon) beside a semibold title ("Join us", "Meetings"). Empty states are one muted sentence with the action on the right ("No business meeting is scheduled." + Schedule one).

**Tinted info banner**
Pale blue surface with 1px pale-blue border, `--radius-lg`, text left, a small primary button right. Used for admin hints ("This is the default group page…").

**Buttons**
- Primary: solid accent, white text, icon left, ~36–40px high, radius ~10px (or pill in tight rows). Example: Edit the page, Schedule one.
- Secondary: white, hairline border, dark text, optional icon (Print, "Put someone on", "Cover a date"). In dense rows they are small (~28px) and pill-shaped.
- Glass: translucent white on the hero only.
- Donate: pale rose fill, rose border, heart icon, rose text.
- Icons are Lucide, outline, ~16px, stroke inherits text colour. Pair every action with an icon and a text label.

**Pills / chips**
- Filter pills (Coming week, Live now, Today, Tomorrow): white with border; selected = solid accent with white text. "Live now" carries a broadcast icon.
- Status chips: "Open" amber; countdown chips ("in 13h 41m") are a dark navy translucent capsule on the top-right of a hero image.
- Tag chips (time zone, "1 member"): glass on hero, grey elsewhere.

**Search / filter panel (meeting finder)**
A light grey rounded tray, containing a white panel. It has an accent-blue header strip with a search icon and the title "What are you looking for?", a full-width search input (white, hairline border, muted placeholder, leading icon), the filter pills, then a row of labelled selects (eyebrow label above each, rounded inputs with chevron or leading icon). Four columns on desktop, stacked on phones.

**Result cards (meeting grid)**
Three across on desktop. Top: gradient image band (~130px) with countdown chip at the top-right and group name + member count in white bottom-left over a navy fade. Below on white: meeting name (medium), then icon rows (accent calendar icon + "Today, 2:00 PM", grey video icon + "Online"). Grid / List toggle is a segmented control at the right of the result count; the active segment has a pale blue fill and accent text.

**Schedule rows (hosts)**
Day eyebrow ("SUNDAY"), then a white card per meeting: time and name on the left with a small "Cover a date" secondary pill; two columns "HOST" and "CO-HOST" with an eyebrow label, "Open" chip and a "Put someone on" button. Top of the page has a summary line (**bold number** of N places open), a toggle ("Only meetings with an open place") and a Print button.

**Toggle**: small iOS-style switch, grey off, accent on, label to its right.

## 7. Content and voice

- Sentence case everywhere except eyebrow labels (CSS uppercase, not typed caps).
- Buttons are verbs: Join, Leave, Edit page, Schedule one, Put someone on, Cover a date.
- Counts are plain: "1 member", "8 host places are open", "4 meetings, soonest first".
- Times show relative first ("in 13h 41m") and absolute second ("Today, 2:00 PM"), in the viewer's zone, and say which zone when it could confuse.
- Name the product "RecoveryBot" and the page editor "HMBLBOT Editor". AA Intergroup is called "AA Intergroup" everywhere users see it (see AGENTS.md).

## 8. Responsive and accessibility

- Mobile first. Below ~768px: single column, tabs scroll horizontally, filter grid stacks, result grid is one column, side panel becomes a sheet. Floating buttons sit at `bottom: calc(var(--shell-bottom,0px) + …)`; the top bar height is `--nav-h`.
- Touch targets at least 40px, even where the desktop version looks smaller.
- Never convey state by colour alone: "Open" has a word, the active tab has an underline, selected pills have a fill and a label.
- Visible focus ring in accent on every interactive element. Icons that stand alone need an `aria-label`.
- Respect dark mode via the tokens above and test every new surface in both themes.

## 9. Do and don't

Do
- Reuse existing components in `components/` (shell, groups, notes, share) before writing new ones.
- Use tokens (`--color-accent`, `--radius-*`, `--shadow-panel`) and Lucide icons.
- Keep one primary action per card or region.
- Use the eyebrow label + card pattern for any new section.

Don't
- Add new colours, fonts, shadows heavier than `--shadow-panel`, or border-heavy boxes.
- Use red for anything except Donate and destructive confirmations.
- Put walls of text in cards; one short paragraph, then the action.
- Add cookies, trackers or outside services without updating `/privacy` (see AGENTS.md).

## 10. Quick prompt for agents

> Build this in RecoveryBot's style: light grey page, white `--radius-lg` cards with a soft shadow and no border, accent `#0b6ede` for the one primary action, UPPERCASE 12px muted eyebrow labels above sections, Lucide outline icons with text labels, pill filters (selected = solid accent), amber "Open" chips for unfilled places, and a blue-to-violet gradient hero with glass chips for group pages. Use CSS variables so dark mode works, keep copy short and friendly, and make it single-column and touch-friendly on phones.

## Reference screenshots

- `docs/screenshots/group-home.png`: gradient hero, tabs, info banner, two-column cards.
- `docs/screenshots/group-conscience.png`: sub-pills, eyebrow-labelled cards, empty state with action.
- `docs/screenshots/host-scheduling.png`: day groups, host/co-host columns, Open chips, toggle, Print.
- `docs/screenshots/meeting-finder.png`: page title, search tray, filter pills and selects, meeting card grid.
