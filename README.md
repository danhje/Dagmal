# Dagmál ☀️

A sunny, playful nature-themed static site with morning and bedtime routines for kids.

**Live site:** https://danhje.github.io/Dagmal/

- No login, no backend — everything is stored locally in the browser (`localStorage`).
- Kids check off their routine items with a playful animation and a cheerful sound.
- A "For parents" panel lets a grown-up configure:
  - 1–5 kids
  - 1–5 time ranges, each with a start and end time (e.g. 7:00 AM – 8:00 AM)
  - 1–50 to-do items per time range
- Checklists reset automatically each day.

## Running locally

It's a plain static site — no build step. Just open `index.html` in a browser,
or serve the folder with any static server, e.g.:

```sh
python3 -m http.server 8000
```

then visit `http://localhost:8000`.
