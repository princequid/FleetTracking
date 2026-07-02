import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import api from "../../services/api";
import {
  HexagonLogoIcon,
  GridIcon,
  MapPinIcon,
  PlusCircleIcon,
  TruckIcon,
  UsersIcon,
  CarIcon,
  AlertTriangleIcon,
  BarChartIcon,
  LogOutIcon,
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
    ],
  },
];

function getInitials(email) {
  if (!email) return "?";
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

export default function Sidebar({ mobileOpen, onNavigate }) {
  const role = useAuthStore((state) => state.role) || "";
  const email = useAuthStore((state) => state.email);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const navigate = useNavigate();
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
    mobileOpen ? "sidebar-mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={sidebarClass}>
      <div className="sidebar-header">
        <HexagonLogoIcon size={24} />
        <span className="sidebar-brand">
          FleetTrack<span className="sidebar-brand-pro">Pro</span>
        </span>
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
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
                    }
                  >
                    <Icon size={18} className="sidebar-link-icon" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{getInitials(email)}</div>
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
