# FleetTrack Pro — Admin Portal Design System

This is a 100% frontend project — React.js + Vite. No Java/Spring Boot work happens here.
The bar for every page/component built in this folder is **premium**, not just functional:
deliberate color use, consistent spacing/radius/shadow scale, and a transition on every
interactive element. Follow this system exactly so the whole app reads as one coherent product.

## Color Palette

| Name | Hex | Use For |
|---|---|---|
| Navy Primary | `#1B3A6B` | Sidebar, header, primary buttons, table headers |
| Navy Dark | `#0F2347` | Sidebar background, deep sections, overlays |
| Navy Hover | `#2E5090` | Button hover states, active nav items |
| Teal Accent | `#0D9488` | Active nav links, badges, chart highlights, CTA |
| Teal Light | `#14B8A6` | Hover on teal elements, secondary highlights |
| Teal Pale | `#CCFBF1` | Teal element backgrounds, success chip backgrounds |
| Success Green | `#059669` | DELIVERED, AVAILABLE, RESOLVED status badges |
| Warning Amber | `#D97706` | IN_USE, UNDER_REVIEW, STARTED status badges |
| Danger Red | `#DC2626` | CANCELLED, CRITICAL, error states |
| Info Blue | `#3B82F6` | ASSIGNED, OPEN, informational states |
| Text Primary | `#111827` | Headings, important labels |
| Text Secondary | `#374151` | Body text, descriptions |
| Text Muted | `#6B7280` | Placeholders, captions, timestamps |
| Background | `#F9FAFB` | Page background |
| Surface | `#F3F4F6` | Card backgrounds, alternating table rows |
| Border | `#E5E7EB` | Card borders, dividers, table lines |
| White | `#FFFFFF` | Card faces, modal backgrounds, sidebar text |

## Typography

Font: **Inter** (Google Fonts), weights 300/400/500/600/700.

```html
<!-- index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

```css
/* index.css */
* { font-family: 'Inter', sans-serif; }
```

Type scale (CSS vars):

```css
--text-xs:   0.75rem;   /* 12px — captions, timestamps */
--text-sm:   0.875rem;  /* 14px — table content, labels */
--text-base: 1rem;      /* 16px — body text */
--text-lg:   1.125rem;  /* 18px — card titles */
--text-xl:   1.25rem;   /* 20px — section headings */
--text-2xl:  1.5rem;    /* 24px — page titles */
--text-3xl:  1.875rem;  /* 30px — dashboard stat numbers */
```

## Animation Standards

Every interactive element must have a transition. Use these values consistently.

```css
/* Standard transitions */
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 400ms cubic-bezier(0.4, 0, 0.2, 1);

button, a, .nav-link, .card, input, select {
  transition: all var(--transition-base);
}

/* Page entry animation */
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.page-enter {
  animation: fadeSlideUp var(--transition-slow) both;
}

/* Stagger children on page load */
.stagger-child:nth-child(1) { animation-delay: 0ms; }
.stagger-child:nth-child(2) { animation-delay: 60ms; }
.stagger-child:nth-child(3) { animation-delay: 120ms; }
.stagger-child:nth-child(4) { animation-delay: 180ms; }

/* Card hover lift */
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(27, 58, 107, 0.12);
}

/* Button press effect */
button:active { transform: scale(0.98); }

/* Sidebar link highlight */
.nav-link:hover {
  background: rgba(255,255,255,0.08);
  padding-left: 1.25rem;
}
.nav-link.active {
  background: rgba(13,148,136,0.15);
  border-left: 3px solid #0D9488;
  color: #14B8A6;
}
```

## Master CSS Custom Properties

All of these belong in `index.css` `:root`. Every component should pull colors/spacing/radius/shadows
from these variables — never hardcode hex values in component CSS.

```css
:root {
  /* Colors */
  --color-navy:        #1B3A6B;
  --color-navy-dark:   #0F2347;
  --color-navy-hover:  #2E5090;
  --color-teal:        #0D9488;
  --color-teal-light:  #14B8A6;
  --color-teal-pale:   #CCFBF1;
  --color-success:     #059669;
  --color-warning:     #D97706;
  --color-danger:      #DC2626;
  --color-info:        #3B82F6;
  --color-text-1:      #111827;
  --color-text-2:      #374151;
  --color-text-3:      #6B7280;
  --color-bg:          #F9FAFB;
  --color-surface:     #F3F4F6;
  --color-border:      #E5E7EB;
  --color-white:       #FFFFFF;

  /* Spacing scale */
  --space-1: 0.25rem;   --space-2: 0.5rem;
  --space-3: 0.75rem;   --space-4: 1rem;
  --space-5: 1.25rem;   --space-6: 1.5rem;
  --space-8: 2rem;      --space-10: 2.5rem;
  --space-12: 3rem;     --space-16: 4rem;

  /* Radius */
  --radius-sm: 6px;    --radius-md: 10px;
  --radius-lg: 14px;   --radius-xl: 20px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:  0 4px 12px rgba(27,58,107,0.10);
  --shadow-lg:  0 8px 24px rgba(27,58,107,0.14);
  --shadow-xl:  0 16px 48px rgba(27,58,107,0.18);

  /* Sidebar */
  --sidebar-width: 260px;
  --navbar-height: 64px;
}
```

## Working agreement

- This folder is frontend-only. Don't touch backend/Java code from here.
- Don't implement ahead of what's asked — confirm scope before building beyond the specific
  prompt given for a feature/page, even if this design system implies a larger surface area.
- When building any new page/component, pull from the variables above rather than introducing
  new ad-hoc colors, spacing, or radii.
