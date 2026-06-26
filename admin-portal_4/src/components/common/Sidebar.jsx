import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { authStore, useAuthStore } from "../../store/authStore";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/trips", label: "Trips" },
  { to: "/dispatch", label: "Dispatch", hideFor: ["DISPATCHER"] },
  { to: "/drivers", label: "Drivers" },
  { to: "/vehicles", label: "Vehicles" },
  { to: "/incidents", label: "Incidents" },
  { to: "/reports", label: "Reports", hideFor: ["DISPATCHER"] },
];

export default function Sidebar() {
  const auth = useAuthStore();
  const role = auth.role || "";
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    authStore.clearAuth();
    navigate("/login");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">FleetTrack</div>
      <nav className="sidebar-nav">
        {navItems
          .filter((item) => !item.hideFor?.includes(role))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
      </nav>
      <button className="sidebar-logout" onClick={handleLogout}>
        Logout
      </button>
    </aside>
  );
}

