import React, { lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext";
import PrivateRoute from "./components/common/PrivateRoute";
import Layout from "./pages/Layout";
import LoginPage from "./pages/LoginPage";

// Route-level code splitting: each page (and its heavy deps — Recharts on the
// dashboard/reports, Google Maps on the map) ships as its own chunk that loads only
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

const root = createRoot(document.getElementById("root"));

root.render(
  <ThemeProvider>
    <BrowserRouter>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="map" element={<LiveMapPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
      </Routes>
    </BrowserRouter>
  </ThemeProvider>
);
