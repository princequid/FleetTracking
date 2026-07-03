import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/common/Sidebar";
import Navbar from "../components/common/Navbar";
import { ToastProvider } from "../components/common/Toast";

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

export default function Layout() {
  const location = useLocation();

  useEffect(() => {
    const base = "/" + location.pathname.split("/")[1];
    const page = DOC_TITLES[location.pathname] || DOC_TITLES[base] || "FleetTrack";
    document.title = `FleetTrack Pro — ${page}`;
  }, [location.pathname]);

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar />
        <div className="app-main">
          <Navbar />
          <main className="page-content">
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
