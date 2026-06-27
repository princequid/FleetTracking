import { useLocation, Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function PrivateRoute({ children }) {
  const auth = useAuthStore();
  const location = useLocation();

  if (!auth.authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

