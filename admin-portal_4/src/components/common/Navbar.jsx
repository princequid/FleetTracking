import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import { SearchIcon, MenuIcon, ChevronRightIcon } from "./Icons";
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
  "/staff": "Staff",
};

/**
 * Builds the crumb trail from the URL. Detail routes (/trips/42) render as
 * "Trips → Trip #42" with the section crumb linking back to the list.
 */
function buildCrumbs(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return [];

  const basePath = "/" + segments[0];
  const baseLabel = PAGE_TITLES[basePath] || segments[0];
  const crumbs = [{ label: baseLabel, to: basePath }];

  if (segments.length > 1) {
    const id = segments[1];
    const singular = baseLabel.replace(/^Manage /, "").replace(/s$/, "");
    crumbs.push({ label: `${singular} #${id}`, to: null });
  }
  return crumbs;
}

export default function Navbar({ onMenuClick }) {
  const location = useLocation();
  const crumbs = buildCrumbs(location.pathname);
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl-K opens search from anywhere in the shell.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
          <div className="navbar-heading">
            {crumbs.length > 0 && (
              <nav className="navbar-crumbs" aria-label="Breadcrumb">
                <Link to="/dashboard" className="navbar-crumb">
                  Home
                </Link>
                {crumbs.map((crumb) => (
                  <React.Fragment key={crumb.label}>
                    <span className="navbar-crumb-sep" aria-hidden="true">
                      <ChevronRightIcon size={12} />
                    </span>
                    {crumb.to ? (
                      <Link to={crumb.to} className="navbar-crumb">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="navbar-crumb navbar-crumb-current" aria-current="page">
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            )}
          </div>
        </div>

        <div className="navbar-actions">
          <button
            className="navbar-search"
            type="button"
            aria-label="Search fleet data"
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon size={16} />
            <span className="navbar-search-label">Search…</span>
            <kbd className="navbar-kbd">Ctrl K</kbd>
          </button>
          <ThemeToggle />
          <NotificationBell />
        </div>
      </header>
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
