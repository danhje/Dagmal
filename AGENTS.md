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

## Conventions

- Keep it dependency-free static HTML/CSS/JS unless there's a strong reason
  to introduce tooling — the whole point is that it's simple to open and run.
- Favor small, readable vanilla JS over adding a framework.
