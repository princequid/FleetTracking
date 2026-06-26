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
          <span className="user-role">{auth.role || "Guest"}</span>
          <span className="user-email">{auth.email || "no-email@example.com"}</span>
        </div>
      </div>
    </header>
  );
}

