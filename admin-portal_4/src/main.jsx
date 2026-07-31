import React, { lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext";
import PrivateRoute from "./components/common/PrivateRoute";
import Layout from "./pages/Layout";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

// Route-level code splitting: each page (and its heavy deps — Recharts on the
// dashboard/reports, Leaflet on the map) ships as its own chunk that loads only
// when navigated to. The login screen no longer downloads the whole app.
// The shell (Layout, Sidebar, Navbar, Login) stays eager for an instant first paint.
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TripsPage = lazy(() => import("./pages/TripsPage"));
const TripDetailPage = lazy(() => import("./pages/TripDetailPage"));
const DispatchPage = lazy(() => import("./pages/DispatchPage"));
const DriversPage = lazy(() => import("./pages/DriversPage"));
const DriverDetailPage = lazy(() => import("./pages/DriverDetailPage"));
const VehiclesPage = lazy(() => import("./pages/VehiclesPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const IncidentsPage = lazy(() => import("./pages/IncidentsPage"));
const LiveMapPage = lazy(() => import("./pages/LiveMapPage"));
const StaffPage = lazy(() => import("./pages/StaffPage"));

// Roles permitted on the routes the sidebar hides from DISPATCHER.
const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const root = createRoot(document.getElementById("root"));

root.render(
  <ThemeProvider>
    <BrowserRouter>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="trips" element={<TripsPage />} />
        <Route path="trips/:id" element={<TripDetailPage />} />
        <Route path="dispatch" element={<DispatchPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="drivers/:id" element={<DriverDetailPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        {/* These three are hidden from DISPATCHER in the sidebar; guard the
            routes too, or the pages are reachable by typing the URL. Mirrors
            Sidebar.jsx `hideFor` — keep the two in sync. */}
        <Route
          path="incidents"
          element={
            <PrivateRoute allow={STAFF_ROLES}>
              <IncidentsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="reports"
          element={
            <PrivateRoute allow={STAFF_ROLES}>
              <ReportsPage />
            </PrivateRoute>
          }
        />
        <Route path="map" element={<LiveMapPage />} />
        <Route
          path="staff"
          element={
            <PrivateRoute allow={ADMIN_ROLES}>
              <StaffPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
      </Routes>
    </BrowserRouter>
  </ThemeProvider>
);

// Let the boot loader's fade-out happen only after the real app has actually
// painted (double rAF), not right after render() returns — render() commits
// synchronously but the browser hasn't necessarily drawn the frame yet, and
// removing the loader a frame early would show a blank flash underneath it.
const bootLoader = document.getElementById("boot-loader");
if (bootLoader) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bootLoader.classList.add("boot-loader-hide");
      setTimeout(() => bootLoader.remove(), 450);
    });
  });
}
