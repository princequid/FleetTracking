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
 *
 * `redirectTo` is where a denied role lands, defaulting to the dashboard. The
 * guard on the layout route itself must override it: sending a denied user to
 * /dashboard only works while the dashboard sits *outside* the route that
 * denied them, and for the layout guard it doesn't — it would re-enter the same
 * check and redirect at itself forever.
 */
export default function PrivateRoute({ children, allow, redirectTo = "/dashboard" }) {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const role = useAuthStore((state) => state.role);
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allow && !allow.includes(role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
