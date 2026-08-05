# FleetSync Pro — Showcase Website

A single-page, fully offline presentation website for the **FleetSync Pro** university
project — a microservices-based fleet tracking and delivery management system.

Open `index.html` and the whole site works: no server, no build step, no internet,
no external libraries.

> **Source of truth:** all content is extracted from the *FleetSync Pro Evaluator Q&A —
> Preparation Guide* (the 20 evaluator questions, the 10 engineer follow-ups, and the
> quick-reference figures). Nothing is invented.

---

## Quick start

1. Navigate into this folder.
2. Double-click `index.html` (or open it with your browser).
3. Present.

---

## File structure

```
showcase/
├── index.html          # The full single-page site (all 14 sections)
├── styles.css          # Design system, components, responsive + print styles
├── script.js           # Q&A data (30 entries), accordions, search, animations, scroll-spy
├── README.md           # This file
└── assets/
    ├── icons/          # Standalone SVG icon set + favicon
    └── images/         # Logo + hand-drawn hero dashboard illustration
```

## What the page contains

| # | Section | Notes |
|---|---------|-------|
| 1 | Hero | Title, purpose, tech chips, animated dashboard illustration |
| 2 | Project Overview | Problem · Solution · Key Benefits cards |
| 3 | System Workflow | 8-step animated timeline (trip creation → completion) |
| 4 | Architecture | Interactive layer explorer with hover/tap inspector |
| 5 | Technologies | Grouped badge cloud of the real stack |
| 6 | Evaluator Q&A | 20 searchable accordions: answer · explanation · notes · takeaway |
| 7 | Engineer Follow-ups | 10 accordions with code, tables, callouts & warnings |
| 8 | Security | Defence-in-depth cards + audit findings table |
| 9 | Performance | Animated counters (11 services, 17 containers, 42 tests, …) |
| 10 | Scaling Strategy | 50 → 10,000 driver roadmap + cheapest-first fixes |
| 11 | Known Limitations | Honest warning cards + one-month plan |
| 12 | Testing | Coverage bars + well-tested / weakly-tested callouts |
| 13 | Personal Contribution | Contributions, decisions, challenges, lessons |
| 14 | Quick Reference | All figures as a metric dashboard |

## User experience

- Sticky header with scroll-spy, smooth scrolling, responsive (hamburger) nav
- Back-to-top button, fade-in-on-scroll reveals, hover lift effects
- Search box that filters the evaluator Q&A in real time
- Print-friendly layout (accordions auto-expand, navigation hidden)
- Keyboard accessible: skip link, focus rings, `aria-expanded` accordions, `aria-live` panels
- `prefers-reduced-motion` aware via CSS media queries

## Accessibility

Semantic HTML5 landmarks, ARIA labels, WCAG-oriented contrast (theme colours from the
project: green `#16A34A` / `#22C55E` / `#4ADE80` on `#F8FAFC` with dark text `#0F172A`),
and keyboard-only navigation throughout.

## Performance

- Zero runtime dependencies, zero network requests — everything is local
- Icons are an inline SVG sprite (no external fonts or icons)
- IntersectionObserver-driven animations so nothing runs off-screen
- A single lightweight stylesheet and one script file

## Editing the content

The evaluator answers live in `script.js` as structured data:

- `EVALUATOR_QA` — 20 questions with `answer`, `mechanism`, `notes`, `takeaway`
- `ENGINEER_QA` — 10 follow-ups with rich blocks (tables, code, callouts)
- `ARCH` — the architecture inspector content

Edit the strings and refresh the page; no other file needs changing.

## License

Project presentation material for the FleetSync Pro university project.
