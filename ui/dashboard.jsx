import {
  LayoutDashboard,
  Truck,
  Users,
  Map,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  MapPin,
  Clock,
} from "lucide-react";

import { useState } from "react";

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static z-40
          w-64 min-h-screen
          bg-gray-900 text-white
          transform transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-blue-500">FleetTrack</h1>

          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600"
          >
            <LayoutDashboard size={20} />
            Dashboard
          </a>

          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <Truck size={20} />
            Vehicles
          </a>

          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <Users size={20} />
            Drivers
          </a>

          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <Map size={20} />
            Live Tracking
          </a>

          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <Bell size={20} />
            Notifications
          </a>

          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <Settings size={20} />
            Settings
          </a>
        </nav>

        {/* Logout */}
        <div className="absolute bottom-6 left-4 right-4">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top Navbar */}
        <header className="h-20 bg-white border-b flex items-center justify-between px-4 md:px-8">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={26} />
          </button>

          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">
              Dashboard
            </h2>

            <p className="text-sm text-gray-500 hidden md:block">
              Monitor your fleet in real time
            </p>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-gray-800">Simon Prince</p>

              <p className="text-xs text-gray-500">Administrator</p>
            </div>

            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
              SP
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-4 md:p-8">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
            {/* Card 1 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-500 text-sm">Total Vehicles</p>

                  <h3 className="text-3xl font-bold mt-2">48</h3>
                </div>

                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                  <Truck size={24} />
                </div>
              </div>

              <p className="text-sm text-green-600 mt-4">
                ↑ 12% from last month
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-500 text-sm">Active Drivers</p>

                  <h3 className="text-3xl font-bold mt-2">32</h3>
                </div>

                <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                  <Users size={24} />
                </div>
              </div>

              <p className="text-sm text-green-600 mt-4">
                ↑ 8% from last month
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-500 text-sm">Active Trips</p>

                  <h3 className="text-3xl font-bold mt-2">24</h3>
                </div>

                <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                  <MapPin size={24} />
                </div>
              </div>

              <p className="text-sm text-green-600 mt-4">
                ↑ 15% from last month
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-500 text-sm">Completed Trips</p>

                  <h3 className="text-3xl font-bold mt-2">156</h3>
                </div>

                <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
                  <Clock size={24} />
                </div>
              </div>

              <p className="text-sm text-green-600 mt-4">
                ↑ 20% from last month
              </p>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Map */}
            <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="p-5 flex justify-between items-center border-b">
                <div>
                  <h3 className="font-bold text-lg">Live Fleet Tracking</h3>

                  <p className="text-sm text-gray-500">
                    Monitor your vehicles in real time
                  </p>
                </div>

                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
                  View Map
                </button>
              </div>

              {/* Replace this with Leaflet */}
              <div className="h-[400px] bg-gray-200 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Map size={50} className="mx-auto mb-3" />

                  <p>Your Leaflet map will appear here</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-5 border-b">
                <h3 className="font-bold text-lg">Recent Activity</h3>
              </div>

              <div className="p-5 space-y-6">
                <div className="flex gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />

                  <div>
                    <p className="text-sm font-medium">
                      Vehicle GH-2456 started a trip
                    </p>

                    <p className="text-xs text-gray-500 mt-1">5 minutes ago</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />

                  <div>
                    <p className="text-sm font-medium">
                      Driver John completed a stop
                    </p>

                    <p className="text-xs text-gray-500 mt-1">20 minutes ago</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2" />

                  <div>
                    <p className="text-sm font-medium">
                      Vehicle GH-7821 requires maintenance
                    </p>

                    <p className="text-xs text-gray-500 mt-1">1 hour ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicles Table */}
          <div className="bg-white rounded-xl shadow-sm border mt-6 overflow-x-auto">
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Active Vehicles</h3>

              <button className="text-blue-600 text-sm font-medium">
                View All
              </button>
            </div>

            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 text-sm text-gray-500">
                    Vehicle
                  </th>

                  <th className="text-left p-4 text-sm text-gray-500">
                    Driver
                  </th>

                  <th className="text-left p-4 text-sm text-gray-500">
                    Status
                  </th>

                  <th className="text-left p-4 text-sm text-gray-500">
                    Location
                  </th>

                  <th className="text-left p-4 text-sm text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-t">
                  <td className="p-4 font-medium">GH-2456</td>

                  <td className="p-4">John Mensah</td>

                  <td className="p-4">
                    <span className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                      On Trip
                    </span>
                  </td>

                  <td className="p-4 text-gray-600">Accra Central</td>

                  <td className="p-4">
                    <button className="text-blue-600 text-sm">Track</button>
                  </td>
                </tr>

                <tr className="border-t">
                  <td className="p-4 font-medium">GH-7821</td>

                  <td className="p-4">Michael Boateng</td>

                  <td className="p-4">
                    <span className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                      Idle
                    </span>
                  </td>

                  <td className="p-4 text-gray-600">Kumasi</td>

                  <td className="p-4">
                    <button className="text-blue-600 text-sm">Track</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
