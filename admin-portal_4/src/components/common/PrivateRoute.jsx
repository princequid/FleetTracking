import React from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

/**
 * Route guard.
 *
 * `allow` restricts a route to specific roles. Hiding a link in the sidebar is
 * presentation, not access control — before this, a DISPATCHER could reach
 * /staff, /incidents and /reports simply by typing the URL, and the Staff page
 * rendered its "Add Staff" button in full.
 *
 * This is defence in depth, not the boundary: the server must still enforce
 * every one of these rules, because a determined client can bypass any of it.
 */
export default function PrivateRoute({ children, allow }) {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const role = useAuthStore((state) => state.role);
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allow && !allow.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
