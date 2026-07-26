import React from "react";

function Svg({ size = 18, className, children, viewBox = "0 0 24 24" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function HexagonLogoIcon({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <polygon
        points="12,2 21,7 21,17 12,22 3,17 3,7"
        fill="#06B6D4"
        stroke="#22D3EE"
        strokeWidth="1"
      />
      <polygon points="12,6 17,9 17,15 12,18 7,15 7,9" fill="#0F2347" />
    </svg>
  );
}

export function GridIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </Svg>
  );
}

export function MapPinIcon(props) {
  return (
    <Svg {...props}>
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

export function PlusCircleIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </Svg>
  );
}

export function TruckIcon(props) {
  return (
    <Svg {...props}>
      <rect x="1" y="6" width="13" height="11" rx="1" />
      <path d="M14 10h4l4 4v3h-8z" />
      <circle cx="6" cy="19" r="1.6" />
      <circle cx="17" cy="19" r="1.6" />
    </Svg>
  );
}

export function UsersIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="9" r="2.6" />
      <path d="M16 14.2c2.7.4 4.5 2.6 4.5 5.8" />
    </Svg>
  );
}

export function CarIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 13l1.6-4.8A2 2 0 0 1 6.5 7h11a2 2 0 0 1 1.9 1.2L21 13" />
      <rect x="2" y="13" width="20" height="6" rx="1.5" />
      <circle cx="7" cy="19.2" r="1.4" />
      <circle cx="17" cy="19.2" r="1.4" />
    </Svg>
  );
}

export function AlertTriangleIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3 1 21h22Z" />
      <path d="M12 9.5v5" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function ClockIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  );
}

export function BarChartIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </Svg>
  );
}

export function LogOutIcon(props) {
  return (
    <Svg {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Svg>
  );
}

export function MenuIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </Svg>
  );
}

export function SearchIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </Svg>
  );
}

export function BellIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10.5 20a1.6 1.6 0 0 0 3 0" />
    </Svg>
  );
}

export function ArrowLeftIcon(props) {
  return (
    <Svg {...props}>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </Svg>
  );
}

export function MoreVerticalIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CheckCircleIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5.5" />
    </Svg>
  );
}

export function XIcon(props) {
  return (
    <Svg {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </Svg>
  );
}

export function EyeIcon(props) {
  return (
    <Svg {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function EyeOffIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.6 3.5M6.6 6.6C4.3 8.2 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.2 3.6-.6" />
      <path d="M9.5 9.7a3 3 0 0 0 4.2 4.2" />
    </Svg>
  );
}

export function SunIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

export function MoonIcon(props) {
  return (
    <Svg {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </Svg>
  );
}

export function MonitorIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Svg>
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
    >
      <path
        d="M6 68c14 4 28 2 38-8s14-22 28-26 36 2 46-6"
        stroke="#CBD5E1"
        strokeWidth="2.5"
        strokeDasharray="1 8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="6" cy="68" r="3.5" fill="#CBD5E1" />
      <g transform="translate(76, 14)">
        <rect x="0" y="10" width="38" height="26" rx="3" fill="#E5E7EB" />
        <rect x="6" y="16" width="22" height="14" rx="2" fill="#CBD5E1" />
        <path d="M38 18h11l9 10v8H38Z" fill="#E5E7EB" />
        <rect x="42" y="22" width="10" height="8" rx="1.5" fill="#F9FAFB" />
        <circle cx="13" cy="38" r="5.5" fill="#9CA3AF" />
        <circle cx="13" cy="38" r="2" fill="#F9FAFB" />
        <circle cx="48" cy="38" r="5.5" fill="#9CA3AF" />
        <circle cx="48" cy="38" r="2" fill="#F9FAFB" />
      </g>
    </svg>
  );
}
