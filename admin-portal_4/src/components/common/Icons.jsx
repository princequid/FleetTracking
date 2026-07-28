import React from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpDown,
  Bell,
  Car,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CirclePlus,
  Clock,
  Command,
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
export const ChevronLeftIcon = icon(ChevronLeft, "ChevronLeftIcon");
export const ChevronRightIcon = icon(ChevronRight, "ChevronRightIcon");
export const ChevronDownIcon = icon(ChevronDown, "ChevronDownIcon");
export const MoreVerticalIcon = icon(EllipsisVertical, "MoreVerticalIcon");
export const CheckCircleIcon = icon(CircleCheck, "CheckCircleIcon");
export const XIcon = icon(X, "XIcon");
export const EyeIcon = icon(Eye, "EyeIcon");
export const EyeOffIcon = icon(EyeOff, "EyeOffIcon");
export const PlusIcon = icon(Plus, "PlusIcon");
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

export function EmptyTruckIllustration({ size = 140, className }) {
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
      <path
        d="M6 68c14 4 28 2 38-8s14-22 28-26 36 2 46-6"
        stroke="var(--color-border-strong)"
        strokeWidth="2.5"
        strokeDasharray="1 8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="6" cy="68" r="3.5" fill="var(--color-border-strong)" />
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
    </svg>
  );
}
