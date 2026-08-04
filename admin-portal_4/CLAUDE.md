# FleetSync Pro — Admin Portal Design System

This is a 100% frontend project — React.js + Vite. No Java/Spring Boot work happens here.
The bar for every page/component built in this folder is **premium**, not just functional:
deliberate color use, consistent spacing/radius/shadow scale, and a transition on every
interactive element. Follow this system exactly so the whole app reads as one coherent product.

Benchmarks: Stripe Dashboard, Linear, Vercel, Supabase, Microsoft Fabric.

## Token architecture

`src/index.css` defines tokens in three layers. **Components may only use layers 2 and 3.**

| Layer | What | Examples |
|---|---|---|
| 1. Primitives | Raw ramps. Never referenced by components. | `--brand-500`, `--gold-400`, `--neutral-200`, `--success-500` |
| 2. Semantic | Role-named. These are what dark mode remaps. | `--color-bg`, `--color-white`, `--color-text-1`, `--color-primary`, `--color-border` |
| 3. System | Type, space, radius, elevation, motion, layout. | `--text-lg`, `--space-6`, `--radius-lg`, `--shadow-md`, `--transition-base` |

Dark mode works by remapping **layer 2 only**, in the single `:root[data-theme="dark"]` block.
If a component hardcodes a hex, it will not flip — that's the rule this architecture enforces.

## Colour

Brand is a navy ramp (`--brand-50` → `--brand-950`); `--brand-800`/`--brand-900` are the
original FleetSync navy marks, preserved exactly. Interactive brand is `--color-primary`
(`--brand-600` light, `--brand-400` dark — the deep navy is too dim on a near-black page).

**Gold (`--gold-*`) is the premium accent.** Use it sparingly: the active sidebar rail, the
logo mark, rank-1 podium. **Never for status** — status has its own ramps.

Each status ships a solid, a soft background and a border tint, so badges and banners never
need one-off `rgba()`:

```
--success-500 / --success-soft / --success-border
--warning-500 / --warning-soft / --warning-border
--danger-500  / --danger-soft  / --danger-border
--info-500    / --info-soft    / --info-border
```

The sidebar is an always-dark surface and has dedicated tokens (`--sidebar-bg`,
`--sidebar-text`, `--sidebar-text-active`, …) rather than inheriting page surfaces, which
invert between themes.

### Text on a fill vs. text on a surface

Two traps, both of which shipped as real dark-mode contrast bugs before being fixed:

**`--color-white` is a surface token, not a colour.** It is the card face, and dark mode
remaps it to `#151f33`. Using it as a *text* colour on a navy or teal fill produced
near-black-on-navy at 1.46:1 in dark mode. For a label sitting on a fill that does **not**
invert — navy buttons, teal dots, avatar shades, the login panel — use **`--color-on-brand`**.
It is deliberately absent from the dark block, and must stay that way.

**`--color-navy` is a fill, and is not remapped in dark.** As text on a card it also
measured 1.46:1. For brand-coloured *text or icons* use **`--color-primary`**, which lifts to
`brand-400` in dark (5.3:1 on the card face, 6.6:1 on white in light).

Same split for teal: `--color-teal` is tuned to sit under white as a fill, and only reaches
3.74:1 as small text on white. Teal text/icons use **`--color-teal-text`** (`teal-700` light,
`teal-400` dark).

The rule of thumb: **ask whether the thing behind your text inverts between themes.** If it
doesn't, the text colour must not either.

## Typography

Two faces, loaded in `index.html`:

- **Plus Jakarta Sans** (`--font-display`) — headings, KPI values, brand. Applied to all
  `h1`–`h6` automatically.
- **Inter** (`--font-sans`) — body, UI, dense table text. The default on `*`.

Scale runs `--text-2xs` (11px) → `--text-4xl` (36px). Tracking tokens: `--tracking-tight`
for display, `--tracking-caps` for uppercase micro-labels.

Anything that changes over time gets `font-variant-numeric: tabular-nums` so digits don't
jitter — already applied to `.kpi-value`, `.stat-value` and table cells.

## Radius & elevation

Cards and controls live in the **12–16px** band: `--radius-md: 12px`, `--radius-lg: 16px`.

Shadows are two-part (broad ambient + tight contact) so cards sit on the page rather than
float in a blur. `--shadow-xs` → `--shadow-xl`, plus `--shadow-focus` for focus rings.

## Components

| Use | Not |
|---|---|
| `KpiCard` — icon, animated value, trend chip, sparkline | hand-rolled stat markup |
| `Sparkline` — dependency-free stretched SVG | a Recharts `ResponsiveContainer` per tile |
| `Icons.jsx` — the single icon system | importing `lucide-react` directly in a component |
| `.btn` + variant | ad-hoc button styling |
| `TableCard` — the surface every data table sits on | `<div className="trips-table-card">` |

`TableCard` exists for one reason: below 768px that card becomes an `overflow-x: auto` scroll
container, and a scroll container that can't take focus can't be scrolled by keyboard, so the
off-screen columns are unreachable (WCAG 2.1.1). It owns the `tabIndex`/`role="region"`/
`aria-label` triple in one place instead of six pages. Always pass a `label`.

**Below 768px a `DataTable` row is a card, not a row**, and every new table must say which
field is which via the column's `card` role — `"title"` (the record's identity, one per
table), `"meta"` (its status, top-right), `"wide"` (a route or address, full width) or
`"actions"` (the footer). Unflagged columns fill a two-up grid. Skip the roles and the card
still works, but every field renders at the same weight and it reads as a ledger dump — which
is exactly what it looked like before the roles existed. The CSS lives in the "Mobile" section
at the foot of `index.css`, appended for the same source-order reason as the premium layer.

Buttons: `primary` (the only gradient — one per view), `secondary`, `outline`, `ghost`,
`success`, `warning`, `danger`. Sizes `xs`/`sm`/`md`/`lg`, plus `.btn-icon` and `.btn-block`.
Every variant shares geometry, focus ring and press feedback.

`StatCard` is a **thin adapter over `KpiCard`**, kept only for its existing call sites.
Use `KpiCard` for anything new.

## Charts

Recharts writes colours as SVG **presentation attributes**, where `var()` is not reliably
honoured across browsers. Never pass a token string to `stroke`/`fill`/`stopColor` — resolve
it first with the `useCssVars` hook, which also re-reads on theme change.

Same applies to any colour handed to `Sparkline`.

## Motion

`--transition-fast` (140ms) / `--transition-base` (220ms) / `--transition-slow` (380ms), all
on `--ease-out`. `--ease-spring` for entrances that should overshoot slightly.

A global `prefers-reduced-motion` block collapses all animation — respect it rather than
adding per-component guards. `KpiCard`'s count-up checks it too.

## The "premium layer"

The last section of `index.css` is appended deliberately. It refines surfaces that
page-specific sections above already styled (tables, forms, chart cards, dashboard grids),
and **source order** is what lets it win without editing 4k lines of older page CSS.

If a refinement isn't taking effect, check whether an earlier page section is overriding it
before adding `!important` — append to this layer instead.

## Accessibility

- Focus rings are global (`:focus-visible`) — don't remove them; restyle via `--shadow-focus`.
- Trend and status must not rely on colour alone; pair with a glyph or label.
- Icons are `aria-hidden` by default. Pass `title` only when the glyph is the sole carrier
  of meaning (an icon-only control with no visible label).

## Styling stack — a settled decision

This portal styles with **plain CSS and the token system above**, in one `src/index.css`.
That is a decision, not an accident, and it has been re-evaluated:

**Do not install Tailwind CSS, and do not install shadcn/ui.** Tailwind would stand up a
second, parallel styling system beside ~6.5k lines of already-tokenised CSS — two sources of
truth for the same colours, spacing and radii, and a dark mode that only one of them knows
about. shadcn/ui hard-requires Tailwind plus a `@/` alias, and its Button/Card/Dialog/Badge
would duplicate `Button.jsx`, `Modal.jsx`, `Badge.jsx`, `EmptyState.jsx` and `Skeleton.jsx`
that already exist here and already consume the tokens.

**Magic UI, Aceternity UI and 21st.dev are reference sources, not dependencies.** None of
them ship as an npm package — they're copy-paste registries, and all three assume Tailwind +
Framer Motion. Use them for *ideas* (an interaction pattern, a card composition, a text
effect), then rebuild the idea against our tokens and `--transition-*` scale. Porting their
markup verbatim drags in Tailwind by the back door.

If a component genuinely needs animation beyond CSS transitions, raise it before adding a
motion library — `KpiCard`'s count-up shows the bar for doing it dependency-free.

## UI/UX audit tooling

Playwright + axe-core are installed here for design work: layout verification across
breakpoints, screenshot capture, and WCAG 2.1 AA auditing.

| Command | What it does |
|---|---|
| `npm run test:ui` | Everything, on all three viewports |
| `npm run ui:smoke` | Routes mount, theme toggle remaps tokens, fonts load |
| `npm run ui:responsive` | Horizontal-overflow + tap-target checks per breakpoint |
| `npm run ui:a11y` | axe WCAG 2.1 AA, light **and** dark |
| `npm run ui:shots` | Full-page screenshots → `screenshots/<viewport>/` |
| `npm run ui:report` | Opens the last HTML report |

Viewport projects are `desktop` (1440×900), `tablet` (768×1024) and `mobile` (Pixel 7), so a
failure names the breakpoint that broke. Scope a run with `--project=mobile`.

The Spring Boot API is **not** running during these specs. That's deliberate: with fetches
failing, the pages render their loading/empty/error states, which is exactly the surface most
likely to be neglected. It also means **these specs cannot assert on data** — don't write one
that does. `tests/helpers/auth.js` seeds the persisted zustand session directly to get past
`PrivateRoute`; it bypasses login on purpose and is not a login-flow test.

The a11y gate fails on **serious + critical** only. Moderate and minor findings are still
written to an `axe-report.txt` attachment on every run, passing or not — read them before
declaring a page done.

## The redesign loop

For any "improve/redesign page X" request, in order:

1. **Inspect** — read the page and the components it already uses. Reuse beats rebuild.
2. **Audit** — visual hierarchy, layout/spacing, typography scale, contrast, component
   consistency, and the full state matrix: loading, empty, error, success, disabled, hover,
   focus, confirmation.
3. **Plan** — state what's wrong, what changes, what gets reused vs. created. Get agreement
   before building beyond the prompt (see the working agreement below).
4. **Implement** — tokens only, no new ad-hoc values, functionality untouched.
5. **Verify** — `npm run ui:smoke && npm run ui:responsive`, then `npm run ui:a11y`.
6. **Look at it** — `npm run ui:shots` and actually inspect the PNGs, both themes.
7. **Report** — what changed, why, files touched, tests run, what's still open.

Steps 5 and 6 are not optional garnish. A redesign that hasn't been screenshotted at 390px
has not been checked.

## Working agreement

- This folder is frontend-only. Don't touch backend/Java code from here.
- Don't implement ahead of what's asked — confirm scope before building beyond the specific
  prompt given for a feature/page, even if this design system implies a larger surface area.
- **Never render a metric with no backing API.** Revenue, fuel, cost and route-efficiency
  have no endpoint in this system; don't invent numbers to fill a card. If a card is asked
  for and the data isn't there, say so rather than seeding placeholder values.
- Pull from the tokens above rather than introducing new ad-hoc colors, spacing, or radii.
