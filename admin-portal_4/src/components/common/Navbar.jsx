import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import { SearchIcon, MenuIcon } from "./Icons";
import GlobalSearchModal from "./GlobalSearchModal";

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
  return PAGE_TITLES[base] || "FleetSync";
}

export default function Navbar({ onMenuClick }) {
  const location = useLocation();
  const title = getPageTitle(location.pathname);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="navbar">
        <div className="navbar-left">
          <button
            className="navbar-hamburger"
            type="button"
            aria-label="Open navigation menu"
            onClick={onMenuClick}
          >
            <MenuIcon size={20} />
          </button>
          <span className="navbar-title">{title}</span>
        </div>
        <div className="navbar-actions">
          <button
            className="navbar-icon-btn"
            type="button"
            aria-label="Search fleet data"
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon size={18} />
          </button>
          <ThemeToggle />
          <NotificationBell />
        </div>
      </header>
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
