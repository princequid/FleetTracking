import React from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function PrivateRoute({ children }) {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
