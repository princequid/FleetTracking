import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./index.css";
import PrivateRoute from "./components/common/PrivateRoute";
import Layout from "./pages/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import TripsPage from "./pages/TripsPage";
import TripDetailPage from "./pages/TripDetailPage";
import DispatchPage from "./pages/DispatchPage";
import DriversPage from "./pages/DriversPage";
import DriverDetailPage from "./pages/DriverDetailPage";
import VehiclesPage from "./pages/VehiclesPage";
import ReportsPage from "./pages/ReportsPage";
import IncidentsPage from "./pages/IncidentsPage";
import LiveMapPage from "./pages/LiveMapPage";

const root = createRoot(document.getElementById("root"));

root.render(
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
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
