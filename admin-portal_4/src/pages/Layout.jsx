import React, { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/common/Sidebar";
import Navbar from "../components/common/Navbar";
import RouteFallback from "../components/common/RouteFallback";
import ErrorBoundary from "../components/common/ErrorBoundary";
import { ToastProvider } from "../components/common/Toast";

// Warm the chunks for the pages users reach most often, once the browser is idle
// and the current page has settled. Vite dedupes these with the lazy() imports,
// so navigation to them is instant without competing with critical first paint.
function prefetchCommonRoutes() {
  import("./TripsPage");
  import("./DriversPage");
  import("./VehiclesPage");
}

const DOC_TITLES = {
  "/dashboard": "Dashboard",
  "/map": "Live Map",
  "/dispatch": "Dispatch",
  "/trips": "Manage Trips",
  "/drivers": "Drivers",
  "/vehicles": "Vehicles",
  "/incidents": "Incidents",
  "/reports": "Reports & Analytics",
};

const COLLAPSE_KEY = "ft-admin-sidebar-collapsed";

export default function Layout() {
  const location = useLocation();
  // Off-canvas sidebar state — only meaningful below the mobile breakpoint (CSS
  // keeps the sidebar permanently visible above it regardless of this flag).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop rail collapse. Read synchronously on first render so the shell never
  // paints expanded and then snaps closed.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // private mode / storage disabled — collapse just won't persist
    }
  }, [collapsed]);

  useEffect(() => {
    const base = "/" + location.pathname.split("/")[1];
    const page = DOC_TITLES[location.pathname] || DOC_TITLES[base] || "FleetSync";
    document.title = `FleetSync — ${page}`;
  }, [location.pathname]);

  // Close the mobile nav automatically whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const ric = window.requestIdleCallback || ((cb) => setTimeout(cb, 400));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const handle = ric(prefetchCommonRoutes);
    return () => cancel(handle);
  }, []);

  return (
    <ToastProvider>
      <div className="app-shell" data-sidebar={collapsed ? "collapsed" : "expanded"}>
        {/* First focusable element on the page — keyboard users can jump the nav. */}
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
        {/* Backdrop: mobile-only (off-canvas sidebar), click to dismiss */}
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <div className="app-main">
          <Navbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="page-content" id="main-content" tabIndex={-1}>
            {/* Keyed on pathname so navigating away clears a stuck error. */}
            <ErrorBoundary key={location.pathname}>
              <Suspense fallback={<RouteFallback />}>
                <div className="page-enter">
                  <Outlet />
                </div>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
