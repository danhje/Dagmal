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
- `water.js` — the WebGL sea in the backdrop, self-contained and purely
  decorative. Kept out of `app.js` so the app logic stays shader-free.

State (kids, time ranges, to-do items, and today's checked-off items) lives
entirely in `localStorage` under the key `dagmal:state`. There is no server
and no login. Checked-off items reset automatically each new day.

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
dunes, a sandy path, fence posts — built as one inline SVG plus a couple
of emoji clouds. Across the horizon, clipped to the sky by `#skyClip`,
sits the far side of the bay: headland, low scrub and a sliver of pale
sand (the beach in the distance).

The sea itself is live WebGL, in `water.js`: layered directional ripples
whose gradient stands in for the two scrolling normal maps a three.js
`Water2` surface blends together, plus sun glitter, crest foam and a hazy
sky reflection near the horizon. It's a deliberate re-implementation of
https://codepen.io/wakana-k/pen/QWXwMqw rather than a port of it — three.js
plus its remote HDR/normal-map textures would be ~600 KB and would break
the app offline, which matters for a tablet on a kitchen counter. Keep it
dependency-free and self-contained; don't swap in a library here.

How the two layers fit together: the canvas sits *behind* the scene SVG and
shows through it. The SVG's sky rect stops at the horizon, and the sea band
(gradient + CSS shimmer + wave lines) is grouped as `.sea-fallback`, which
fades to `opacity: 0` once `water.js` has drawn its first frame and put
`.water-live` on `<body>`. So the CSS-only sea is the fallback, still shown
when there's no WebGL, when the context is lost, or under
`prefers-reduced-motion`. Sand, dunes and foam paint over the canvas either
way.

`water.js` maps the SVG's horizon (y 284) and waterline (y 472) into canvas
pixels with `getScreenCTM()` rather than assuming a position — the scene is
drawn `preserveAspectRatio="xMidYMax slice"`, so the band moves with the
viewport aspect. It re-measures on resize/orientation change. Its water
colors are read from the `--sea-deep`/`--sea-light`/`--sky-bottom` custom
properties, so retheming the CSS retints the water too. Cost is kept down
deliberately: 30fps cap, device pixel ratio capped at 1.5, and the render
loop stops entirely while the tab is hidden — keep those in place.

The scene is intentionally muted and confined to the top band so it never
competes with the opaque kid cards and checkboxes, which is the one thing
on this screen that actually matters.

`.claude/launch.json` defines a `dagmal` config that serves the folder on
port 8752 — the scene needs `http://`, not `file://`, to preview properly.

## Conventions

- Keep it dependency-free static HTML/CSS/JS unless there's a strong reason
  to introduce tooling — the whole point is that it's simple to open and run.
- Favor small, readable vanilla JS over adding a framework.
