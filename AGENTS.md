# Agent instructions for Dagmál

## Workflow

- When a task is finished, commit and push straight to `main`. Don't leave
  finished work uncommitted or sitting on a branch waiting for review.
- Keep this file (`AGENTS.md`) updated and useful as the project evolves —
  update it whenever conventions, structure, or workflow change, without
  asking for permission first.

## Project overview

Dagmál is a plain static site (no build step, no framework, no backend):

- `index.html` — page structure and `<template>`s for the main view and the
  parents panel.
- `styles.css` — all styling (sunny/nature theme, animations).
- `app.js` — all behavior: state management, rendering, the parents editor,
  confetti/sound feedback. IIFE, vanilla JS, no dependencies.

The backdrop is pure markup and CSS — there is no scene script. There used
to be a `water.js`; see "Don't bring the shader back" below.

State (kids, time ranges, to-do items, and today's checked-off items) lives
entirely in `localStorage` under the key `dagmal:state`. There is no server
and no login. Checked-off items reset automatically each new day.

Because there's no server, the parents pane has a "Backup & move" section
that reads and writes that state as a small JSON document, so a setup can
travel between browsers, macOS accounts and devices. Export offers both a
downloaded `dagmal-backup-YYYY-MM-DD.json` file and a copyable text blob —
the file is what actually works between two macOS accounts (the clipboard
isn't shared across login sessions), while the blob is the easy path on a
tablet, where file pickers are fiddly and text can just be AirDropped or
messaged. Import accepts either (file picker fills the same textarea).

The document is `{ app: "dagmal", schema: 1, exportedAt, data: { kids,
timeRanges } }`. `app`/`schema` are what `parseImport` checks first — bump
`EXPORT_SCHEMA` and handle older values there if the shape ever changes;
a backup with a *higher* schema than the running page is refused rather
than half-read.

**Configuration travels, check-off state does not.** `data` holds only kids
(with avatars), time ranges and their items; import resets `checks` and sets
`checksDate` to today. Checks are per-day and per-device, already wiped at
midnight, so carrying them across would either be discarded by the date
check or wrongly mark chores done on the machine being set up.

`parseImport` returns `{ config }` or `{ error }` and touches neither
`state` nor `localStorage`, and `applyImportedConfig` writes storage
*before* swapping `state`. So a truncated paste, a foreign JSON file or a
full disk all leave the existing setup exactly as it was, with an inline
error. Keep that ordering — silently wiping a parent's setup is the one
failure this feature must never have. Import is two-step: validate first,
then show a warning naming what's being replaced, then apply.

A time range has no name of its own — it's defined by a `from`/`to` time
(`"HH:MM"`, 24h), and the main view labels it with a formatted time span
(e.g. "7:00 AM – 8:00 AM") plus an icon picked from the start hour. Old
saved data that used a `name` field instead is migrated on load
(`migrateRanges` in `app.js`) — keep that migration in place as long as
pre-time-range localStorage data might still be out there.

Constraints enforced in the UI: 1–5 kids, 1–5 time ranges, 1–50 items per
time range.

The main view only shows the routine(s) relevant to the current time of
day, not the whole day's lists (`relevantRanges`/`isRangeActive` in
`app.js`). A range is "active" if now falls within its `from`/`to` window;
this correctly handles ranges that wrap past midnight (`from > to`, e.g.
20:00 → 07:00). If no range is active (a gap between routines), the view
falls back to showing the soonest upcoming range — wrapping to tomorrow's
earliest range if every range has already ended today — with a banner
explaining that. This keeps the view from ever going empty while a kid is
present. Progress bars count only the currently visible items, not the
whole day. The view re-renders every 20s (skipped while the parents pane
is open, and re-run once it closes) so it swaps to the next routine on
its own when the clock crosses a boundary — no reload needed. That
re-render just rebuilds the DOM from `state`, so it never loses today's
check-off progress.

The "For parents" button doesn't open the parents panel directly — it
opens a `gateOverlay` arithmetic challenge first (two random two-digit
numbers, sum required; wrong answer generates a new pair). This is
explicitly a "keep curious kids out" speed bump, not real security, so
don't add anything (hashing, rate limiting, etc.) that would suggest
otherwise. See `openGate`/`submitGate` in `app.js`.

To-do items within a time range keep whatever order they're in inside
`range.items`, and that's user-controlled: the parents pane has up/down
buttons on each item to reorder it (`renderRangesEditor` in `app.js`).
Deliberately not drag-and-drop — native HTML5 drag-and-drop doesn't work
on touch (tablets are a primary target here), and a touch-compatible
implementation would need real complexity for a "keep order minor" UI
detail. If that changes, buttons should stay as a fallback either way.

Each kid has a persisted `avatar` (an emoji from `AVATARS` in `app.js`),
defaulted by position when a kid is created or migrated from older data
that had no `avatar` field. It's clickable — cycles to the next animal
in `AVATARS` and saves — only on the big avatar in the main view kid
card; the small copy next to the name in the parents pane is display-only
(it mirrors `kid.avatar`, it doesn't set it), to keep "change your look"
as a kid-facing, playful action rather than a settings-panel one.

The fixed backdrop behind the header/banner (`.sky` in `index.html`,
48vh tall) is a hand-drawn-style beach scene — sky, distant shore, sea,
a near beach, dunes, a sandy path, fence posts — built as one inline SVG
plus a couple of emoji clouds. Across the horizon, clipped to the sky by
`#skyClip`, sits the far side of the bay: headland, low scrub and a sliver
of pale sand (the beach in the distance).

The near shoreline is a curve, not a horizontal edge: `#groundClip` is a
path whose top is that curve, so every bit of land is clipped to it. **The
curve must stay above y 474** — that's where the sea rect ends — so the
sand always overlaps painted sea. Drop below it and a strip of raw page
background shows through along the whole shore. It currently runs y 434–465,
leaving at least 9 units of overlap; the two `.foam` wash lines
trace the same curve a little seaward of it, and the sand paints over their
lower half so they read as foam running up the beach.

The beach itself is `.beach`, a band of `#sandGrad` painted back over the
foot of the dunes after they're drawn, so sand — not grass — meets the
water the whole way across. Its top edge is the shoreline curve; its lower
edge wanders on its own, making the beach 52–90 units wide rather than a
ruled band. Sharing `#sandGrad` with the ground rect under it keeps the
sand wet-dark at the water and pale inland, and makes the seam where the
beach meets the central path invisible. If you move that lower edge, check
the `.wildflowers` near it — four of them were nudged inland so they'd stay
on the grass instead of stranding on the sand.

The sea is `.sea`: a flat `#seaGrad` rect (y 284–474, `--sea-deep` at the
horizon to `--sea-light` at the shore), four blurred white `.shimmer-blob`
ellipses and two `.wave-a`/`.wave-b` lines, both drifting sideways on slow
CSS keyframes. Retinting `--sea-deep`/`--sea-light` retints the sea. Sand,
dunes and foam paint over its lower edge.

### Don't bring the shader back

Between commits `5bc6c19` and this one, the sea was a live WebGL surface in
a `water.js`: layered directional ripples, sun glitter, crest foam, a hazy
sky reflection. It looked good and it was already tuned about as far as it
could go — 30fps cap, DPR capped at 1.5, render loop stopped while the tab
was hidden. It still cost too much CPU, which is disqualifying for the one
device that matters here: a tablet parked on a kitchen counter with this
page open all day. It was removed, along with its canvas, its rAF loop, its
visibility handling and its WebGL/reduced-motion detection, and the sea
above is what it had been fading out.

So: the flat sea is the decision, not a placeholder or a fallback. If a
richer sea ever comes back it has to be free when nothing is interacting —
and note that the CSS shimmer is not literally free either, since it
animates filtered SVG elements. `prefers-reduced-motion` already stops it;
dropping the `.shimmer`/`.wave-lines` groups leaves a plain gradient sea
and is the next lever if the page is ever still too warm.

The scene is intentionally muted and confined to the top band so it never
competes with the opaque kid cards and checkboxes, which is the one thing
on this screen that actually matters.

`.claude/launch.json` defines a `dagmal` config that serves the folder on
port 8752. Nothing needs a server any more — `file://` renders the whole
page correctly — but it stays as the convenient way to preview.

## Conventions

- Keep it dependency-free static HTML/CSS/JS unless there's a strong reason
  to introduce tooling — the whole point is that it's simple to open and run.
- Favor small, readable vanilla JS over adding a framework.
