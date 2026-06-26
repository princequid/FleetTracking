import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/common/Sidebar";
import Navbar from "../components/common/Navbar";

export default function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Navbar />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
