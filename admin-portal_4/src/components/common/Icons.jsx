import React from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Bell,
  Car,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CirclePlus,
  Clock,
  Command,
  Crosshair,
  Download,
  EllipsisVertical,
  Eye,
  EyeOff,
  Filter,
  Gauge,
  Inbox,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  Minus,
  Monitor,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
  X,
} from "lucide-react";

/**
 * Single icon system for the portal — Lucide, wrapped so every glyph shares one
 * grid, one stroke weight, and one default size. Call sites keep the historical
 * `<SomeIcon size={18} className="…" />` signature, so nothing downstream changed
 * when this moved off the hand-rolled SVG set.
 *
 * Never import from "lucide-react" directly in a component: route it through here
 * so the stroke/size defaults stay consistent across the app.
 */
function icon(Glyph, displayName) {
  const Wrapped = React.forwardRef(function IconWrapper(
    { size = 18, strokeWidth = 1.75, className, title, ...rest },
    ref
  ) {
    return (
      <Glyph
        ref={ref}
        size={size}
        strokeWidth={strokeWidth}
        className={className}
        // Icons are decorative by default; pass `title` only when the glyph is
        // the sole carrier of meaning (i.e. an icon-only control with no label).
        aria-hidden={title ? undefined : "true"}
        aria-label={title}
        role={title ? "img" : undefined}
        focusable="false"
        {...rest}
      />
    );
  });
  Wrapped.displayName = displayName;
  return Wrapped;
}

/* ── Navigation ─────────────────────────────────────────────────────────────── */
export const GridIcon = icon(LayoutGrid, "GridIcon");
export const MapPinIcon = icon(MapPin, "MapPinIcon");
export const PlusCircleIcon = icon(CirclePlus, "PlusCircleIcon");
export const TruckIcon = icon(Truck, "TruckIcon");
export const UsersIcon = icon(Users, "UsersIcon");
export const CarIcon = icon(Car, "CarIcon");
export const AlertTriangleIcon = icon(TriangleAlert, "AlertTriangleIcon");
export const BarChartIcon = icon(ChartColumn, "BarChartIcon");
export const ShieldIcon = icon(ShieldCheck, "ShieldIcon");

/* ── Shell / chrome ─────────────────────────────────────────────────────────── */
export const LogOutIcon = icon(LogOut, "LogOutIcon");
export const MenuIcon = icon(Menu, "MenuIcon");
export const SearchIcon = icon(Search, "SearchIcon");
export const BellIcon = icon(Bell, "BellIcon");
export const CommandIcon = icon(Command, "CommandIcon");
export const PanelCollapseIcon = icon(PanelLeftClose, "PanelCollapseIcon");
export const PanelExpandIcon = icon(PanelLeftOpen, "PanelExpandIcon");

/* ── Controls ───────────────────────────────────────────────────────────────── */
export const ArrowLeftIcon = icon(ArrowLeft, "ArrowLeftIcon");
export const ArrowRightIcon = icon(ArrowRight, "ArrowRightIcon");
export const ChevronLeftIcon = icon(ChevronLeft, "ChevronLeftIcon");
export const ChevronRightIcon = icon(ChevronRight, "ChevronRightIcon");
export const ChevronDownIcon = icon(ChevronDown, "ChevronDownIcon");
export const MoreVerticalIcon = icon(EllipsisVertical, "MoreVerticalIcon");
export const CheckCircleIcon = icon(CircleCheck, "CheckCircleIcon");
export const CheckIcon = icon(Check, "CheckIcon");
export const XIcon = icon(X, "XIcon");
export const EyeIcon = icon(Eye, "EyeIcon");
export const EyeOffIcon = icon(EyeOff, "EyeOffIcon");
export const PlusIcon = icon(Plus, "PlusIcon");
export const MinusIcon = icon(Minus, "MinusIcon");
export const CrosshairIcon = icon(Crosshair, "CrosshairIcon");
export const FilterIcon = icon(Filter, "FilterIcon");
export const SortIcon = icon(ArrowUpDown, "SortIcon");
export const SlidersIcon = icon(SlidersHorizontal, "SlidersIcon");
export const DownloadIcon = icon(Download, "DownloadIcon");

/* ── Theme ──────────────────────────────────────────────────────────────────── */
export const SunIcon = icon(Sun, "SunIcon");
export const MoonIcon = icon(Moon, "MoonIcon");
export const MonitorIcon = icon(Monitor, "MonitorIcon");

/* ── Metrics / dashboard ────────────────────────────────────────────────────── */
export const TrendUpIcon = icon(TrendingUp, "TrendUpIcon");
export const TrendDownIcon = icon(TrendingDown, "TrendDownIcon");
export const ActivityIcon = icon(Activity, "ActivityIcon");
export const PackageIcon = icon(Package, "PackageIcon");
export const ClockIcon = icon(Clock, "ClockIcon");
export const GaugeIcon = icon(Gauge, "GaugeIcon");
export const RouteIcon = icon(Route, "RouteIcon");
export const InboxIcon = icon(Inbox, "InboxIcon");
export const AlertCircleIcon = icon(CircleAlert, "AlertCircleIcon");

/* ── Brand art ──────────────────────────────────────────────────────────────────
   Not part of the Lucide set — these are bespoke marks, kept as hand-drawn SVG. */

export function HexagonLogoIcon({ size = 24, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="fsLogoOuter" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-500)" />
          <stop offset="100%" stopColor="var(--brand-700)" />
        </linearGradient>
        <linearGradient id="fsLogoInner" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--gold-400)" />
          <stop offset="100%" stopColor="var(--gold-600)" />
        </linearGradient>
      </defs>
      <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="url(#fsLogoOuter)" />
      <polygon points="12,6.4 16.8,9.2 16.8,14.8 12,17.6 7.2,14.8 7.2,9.2" fill="url(#fsLogoInner)" />
    </svg>
  );
}

/**
 * ## Empty-state illustration family
 *
 * One visual language, so an empty drivers table and an empty trips table read
 * as the same product rather than as two screens built by different people.
 * Before this there was a single hand-drawn truck, a literal 📊 emoji on
 * Reports, and 64px Lucide glyphs blown up to fill the gap everywhere else.
 *
 * The shared rules, all of which matter for keeping them coherent:
 *
 *   - 140 × 84 viewBox, drawn on a 4px grid.
 *   - Only four fills, all semantic tokens, so they flip with the theme:
 *       --color-surface-2      the solid body of an object
 *       --color-border-strong  its detail and any dashed guide
 *       --color-text-3         the one element that carries weight (a wheel,
 *                              a head, the bar that matters)
 *       --color-bg             punched-out negative space
 *   - No brand colour and no gradients. These sit behind a call to action; if
 *     the artwork competes with the button, the state has failed.
 *   - A dashed path or ground line anchors the object, so nothing floats.
 *   - Line weight is 2.5, matching the 1.75 Lucide stroke scaled to this size.
 *
 * `aria-hidden` on every one of them: the adjacent title and subtitle carry the
 * meaning, and announcing "illustration of an empty truck" first would put
 * decoration ahead of the sentence that tells the user what to do.
 */

/** Shared dashed ground line — what stops each object floating in space. */
function GroundLine({ d = "M6 68c14 4 28 2 38-8s14-22 28-26 36 2 46-6" }) {
  return (
    <>
      <path
        d={d}
        stroke="var(--color-border-strong)"
        strokeWidth="2.5"
        strokeDasharray="1 8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="6" cy="68" r="3.5" fill="var(--color-border-strong)" />
    </>
  );
}

function Art({ size = 140, className, children }) {
  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox="0 0 140 84"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function EmptyTruckIllustration({ size = 140, className }) {
  return (
    <Art size={size} className={className}>
      <GroundLine />
      <g transform="translate(76, 14)">
        <rect x="0" y="10" width="38" height="26" rx="4" fill="var(--color-surface-2)" />
        <rect x="6" y="16" width="22" height="14" rx="3" fill="var(--color-border-strong)" />
        <path d="M38 18h11l9 10v8H38Z" fill="var(--color-surface-2)" />
        <rect x="42" y="22" width="10" height="8" rx="2" fill="var(--color-bg)" />
        <circle cx="13" cy="38" r="5.5" fill="var(--color-text-3)" />
        <circle cx="13" cy="38" r="2" fill="var(--color-bg)" />
        <circle cx="48" cy="38" r="5.5" fill="var(--color-text-3)" />
        <circle cx="48" cy="38" r="2" fill="var(--color-bg)" />
      </g>
    </Art>
  );
}

/** No drivers — two figures, the front one carrying the weight. */
export function EmptyDriversIllustration({ size = 140, className }) {
  return (
    <Art size={size} className={className}>
      <GroundLine d="M10 70h120" />
      <g transform="translate(44, 16)">
        {/* Back figure, set down in the hierarchy */}
        <circle cx="40" cy="14" r="8" fill="var(--color-border-strong)" />
        <path d="M24 46c0-9 7-16 16-16s16 7 16 16v6H24Z" fill="var(--color-border-strong)" />
        {/* Front figure */}
        <circle cx="18" cy="18" r="10" fill="var(--color-text-3)" />
        <path d="M0 52c0-10 8-18 18-18s18 8 18 18v2H0Z" fill="var(--color-surface-2)" />
        <path d="M0 52c0-10 8-18 18-18s18 8 18 18v2H0Z" stroke="var(--color-text-3)" strokeWidth="2.5" fill="none" />
      </g>
    </Art>
  );
}

/** No vehicles — an empty bay, the parking outline with nothing in it. */
export function EmptyVehiclesIllustration({ size = 140, className }) {
  return (
    <Art size={size} className={className}>
      <GroundLine d="M10 70h120" />
      {/* The bay markings: the point is the absence inside them */}
      <path
        d="M34 24v40M106 24v40M34 24h72"
        stroke="var(--color-border-strong)"
        strokeWidth="2.5"
        strokeDasharray="6 7"
        strokeLinecap="round"
      />
      <g transform="translate(52, 34)">
        <rect x="0" y="8" width="36" height="16" rx="5" fill="var(--color-surface-2)" />
        <path d="M7 8l5-7h12l6 7Z" fill="var(--color-border-strong)" />
        <circle cx="9" cy="25" r="4.5" fill="var(--color-text-3)" />
        <circle cx="28" cy="25" r="4.5" fill="var(--color-text-3)" />
      </g>
    </Art>
  );
}

/** No search results — a lens over a list that came back short. */
export function EmptySearchIllustration({ size = 140, className }) {
  return (
    <Art size={size} className={className}>
      <GroundLine d="M14 72h112" />
      <g transform="translate(38, 14)">
        <rect x="0" y="0" width="46" height="54" rx="6" fill="var(--color-surface-2)" />
        <rect x="9" y="12" width="28" height="4" rx="2" fill="var(--color-border-strong)" />
        <rect x="9" y="24" width="20" height="4" rx="2" fill="var(--color-border-strong)" />
        <rect x="9" y="36" width="24" height="4" rx="2" fill="var(--color-border-strong)" />
      </g>
      <g transform="translate(74, 30)">
        <circle cx="16" cy="16" r="15" fill="var(--color-bg)" stroke="var(--color-text-3)" strokeWidth="3.5" />
        <path d="M27 27l10 10" stroke="var(--color-text-3)" strokeWidth="4" strokeLinecap="round" />
      </g>
    </Art>
  );
}

/** No incidents — a shield, i.e. the good outcome, not a warning triangle. */
export function EmptyIncidentsIllustration({ size = 140, className }) {
  return (
    <Art size={size} className={className}>
      <GroundLine d="M18 72h104" />
      <g transform="translate(50, 10)">
        <path
          d="M20 0l20 8v18c0 14-8 25-20 30C8 51 0 40 0 26V8Z"
          fill="var(--color-surface-2)"
          stroke="var(--color-border-strong)"
          strokeWidth="2.5"
        />
        <path
          d="M11 27l6 6 12-13"
          stroke="var(--color-text-3)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </Art>
  );
}

/** No staff accounts — a badge/credential rather than another pair of people. */
export function EmptyStaffIllustration({ size = 140, className }) {
  return (
    <Art size={size} className={className}>
      <GroundLine d="M16 72h108" />
      <g transform="translate(44, 12)">
        <rect x="0" y="6" width="52" height="52" rx="7" fill="var(--color-surface-2)" />
        <path d="M20 0h12v10H20Z" fill="var(--color-border-strong)" />
        <circle cx="26" cy="26" r="8" fill="var(--color-text-3)" />
        <path d="M14 48c0-7 5-12 12-12s12 5 12 12Z" fill="var(--color-text-3)" />
      </g>
    </Art>
  );
}

/** No report yet — bars waiting to be drawn. Replaces a literal 📊 emoji. */
export function EmptyReportIllustration({ size = 140, className }) {
  return (
    <Art size={size} className={className}>
      {/* Axes, so the bars have somewhere to stand */}
      <path
        d="M34 16v52h74"
        stroke="var(--color-border-strong)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="44" y="46" width="13" height="22" rx="3" fill="var(--color-surface-2)" />
      <rect x="63" y="34" width="13" height="34" rx="3" fill="var(--color-border-strong)" />
      {/* The one bar that carries weight — the reading the report is here for */}
      <rect x="82" y="24" width="13" height="44" rx="3" fill="var(--color-text-3)" />
      <path
        d="M44 30l19-10 19 6"
        stroke="var(--color-border-strong)"
        strokeWidth="2.5"
        strokeDasharray="1 7"
        strokeLinecap="round"
        fill="none"
      />
    </Art>
  );
}

/** Connection lost — a plug pulled out. Used by ErrorState. */
export function ConnectionLostIllustration({ size = 140, className }) {
  return (
    <Art size={size} className={className}>
      <GroundLine d="M16 72h108" />
      <g transform="translate(30, 24)">
        <rect x="0" y="10" width="30" height="22" rx="6" fill="var(--color-surface-2)" />
        <path d="M30 17h8M30 25h8" stroke="var(--color-text-3)" strokeWidth="3.5" strokeLinecap="round" />
      </g>
      <g transform="translate(78, 24)">
        <rect x="14" y="10" width="30" height="22" rx="6" fill="var(--color-surface-2)" />
        <path d="M6 17h8M6 25h8" stroke="var(--color-text-3)" strokeWidth="3.5" strokeLinecap="round" />
      </g>
      {/* The break, drawn as a gap rather than a cross */}
      <path
        d="M70 14l-5 10h10l-5 10"
        stroke="var(--color-border-strong)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Art>
  );
}

/** Permission denied — a closed lock, for role-gated surfaces. */
export function NoAccessIllustration({ size = 140, className }) {
  return (
    <Art size={size} className={className}>
      <GroundLine d="M20 72h100" />
      <g transform="translate(52, 12)">
        <path
          d="M8 26v-8a10 10 0 0 1 20 0v8"
          stroke="var(--color-text-3)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="0" y="26" width="36" height="30" rx="6" fill="var(--color-surface-2)" />
        <circle cx="18" cy="39" r="4" fill="var(--color-text-3)" />
        <path d="M18 42v6" stroke="var(--color-text-3)" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </Art>
  );
}
