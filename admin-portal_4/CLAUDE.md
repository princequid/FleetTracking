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

## Working agreement

- This folder is frontend-only. Don't touch backend/Java code from here.
- Don't implement ahead of what's asked — confirm scope before building beyond the specific
  prompt given for a feature/page, even if this design system implies a larger surface area.
- **Never render a metric with no backing API.** Revenue, fuel, cost and route-efficiency
  have no endpoint in this system; don't invent numbers to fill a card. If a card is asked
  for and the data isn't there, say so rather than seeding placeholder values.
- Pull from the tokens above rather than introducing new ad-hoc colors, spacing, or radii.
