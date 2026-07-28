import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import api from "../../services/api";
import {
  GridIcon,
  MapPinIcon,
  PlusCircleIcon,
  TruckIcon,
  UsersIcon,
  CarIcon,
  AlertTriangleIcon,
  BarChartIcon,
  ShieldIcon,
  LogOutIcon,
  PanelCollapseIcon,
  PanelExpandIcon,
} from "./Icons";

const navSections = [
  {
    label: "OPERATIONS",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: GridIcon },
      { to: "/map", label: "Live Map", icon: MapPinIcon },
      { to: "/dispatch", label: "Dispatch", icon: PlusCircleIcon },
      { to: "/trips", label: "Trips", icon: TruckIcon },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { to: "/drivers", label: "Drivers", icon: UsersIcon },
      { to: "/vehicles", label: "Vehicles", icon: CarIcon },
      { to: "/incidents", label: "Incidents", icon: AlertTriangleIcon, hideFor: ["DISPATCHER"] },
      { to: "/reports", label: "Reports", icon: BarChartIcon, hideFor: ["DISPATCHER"] },
      { to: "/staff", label: "Staff", icon: ShieldIcon, hideFor: ["DISPATCHER"] },
    ],
  },
];

function getInitials(email) {
  if (!email) return "?";
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

export default function Sidebar({ isOpen, onClose, collapsed = false, onToggleCollapse }) {
  const role = useAuthStore((state) => state.role) || "";
  const email = useAuthStore((state) => state.email);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // proceed with local logout regardless of network outcome
    }
    clearAuth();
    navigate("/login");
  }

  const sidebarClass = [
    "sidebar",
    mounted ? "sidebar-mounted" : "",
    isOpen ? "sidebar-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={sidebarClass} aria-label="Main navigation">
      <div className="sidebar-header">
        <img src="/images/logo.png" alt="" className="sidebar-logo" />
        <div className="sidebar-brand-text">
          <span className="sidebar-brand">FleetSync</span>
          <span className="sidebar-brand-sub">Fleet Operations</span>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelExpandIcon size={17} /> : <PanelCollapseIcon size={17} />}
          </button>
        )}
      </div>
      <div className="sidebar-rule" />

      <nav className="sidebar-nav">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => !item.hideFor?.includes(role));
          if (!visibleItems.length) return null;
          return (
            <div className="sidebar-section" key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    // Collapsed rail hides the label, so surface it as a native
                    // tooltip — it escapes the nav's clipped overflow, which a
                    // CSS pseudo-element could not.
                    title={collapsed ? item.label : undefined}
                    // Ignore clicks on the route we're already viewing — no navigation,
                    // no history entry, no page re-render/scroll reset.
                    onClick={(e) => {
                      if (pathname === item.to) {
                        e.preventDefault();
                        if (import.meta.env.DEV) console.log(`[Nav] ignored — already on "${item.to}"`);
                      } else if (import.meta.env.DEV) {
                        console.log(`[Nav] navigate → "${item.to}"`);
                      }
                      // Close the off-canvas menu on mobile — Layout also closes on
                      // pathname change, but that doesn't fire for a same-route click.
                      onClose?.();
                    }}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
                    }
                  >
                    <Icon size={18} className="sidebar-link-icon" />
                    <span className="sidebar-link-label">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar" aria-hidden="true">
            {getInitials(email)}
          </div>
          <div className="sidebar-user-meta">
            <div className="sidebar-user-email" title={email || ""}>
              {email || "unknown@fleettrack.com"}
            </div>
            <span className="sidebar-role-pill">{role || "GUEST"}</span>
          </div>
        </div>
        <button className="sidebar-logout" type="button" onClick={handleLogout}>
          <LogOutIcon size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
