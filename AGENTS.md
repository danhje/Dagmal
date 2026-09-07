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

Constraints enforced in the UI: 1–5 kids, 1–5 time ranges, 1–50 items per
time range.

## Conventions

- Keep it dependency-free static HTML/CSS/JS unless there's a strong reason
  to introduce tooling — the whole point is that it's simple to open and run.
- Favor small, readable vanilla JS over adding a framework.
