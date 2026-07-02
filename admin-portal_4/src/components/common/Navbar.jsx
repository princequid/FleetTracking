import React from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import NotificationBell from "./NotificationBell";
import { MenuIcon, SearchIcon } from "./Icons";

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/map": "Live Map",
  "/dispatch": "Dispatch",
  "/trips": "Manage Trips",
  "/drivers": "Drivers",
  "/vehicles": "Vehicles",
  "/incidents": "Incidents",
  "/reports": "Reports",
};

function getPageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const base = "/" + pathname.split("/")[1];
  return PAGE_TITLES[base] || "FleetTrack";
}

function getInitials(email) {
  if (!email) return "?";
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

export default function Navbar({ onToggleSidebar }) {
  const role = useAuthStore((state) => state.role);
  const email = useAuthStore((state) => state.email);
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button
          className="navbar-icon-btn navbar-hamburger"
          type="button"
          aria-label="Toggle navigation"
          onClick={onToggleSidebar}
        >
          <MenuIcon size={20} />
        </button>
        <span className="navbar-title">{title}</span>
      </div>
      <div className="navbar-actions">
        <button className="navbar-icon-btn" type="button" aria-label="Search">
          <SearchIcon size={18} />
        </button>
        <NotificationBell />
        <div className="navbar-separator" />
        <div className="navbar-user">
          <div className="navbar-avatar">{getInitials(email)}</div>
          <div className="user-info">
            <div className="user-email">{email || "no-email@example.com"}</div>
            <div className="user-role">{role || "Guest"}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
