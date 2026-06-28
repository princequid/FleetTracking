import React from "react";
import { useAuthStore } from "../../store/authStore";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const auth = useAuthStore();

  return (
    <header className="navbar">
      <div className="navbar-title">FleetTrack Admin</div>
      <div className="navbar-actions">
        <NotificationBell />
        <div className="user-info">
          <div className="user-role">{auth.role || "Guest"}</div>
          <div className="user-email">{auth.email || "no-email@example.com"}</div>
        </div>
      </div>
    </header>
  );
}

