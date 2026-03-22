import React from "react";
import { NavLink } from "react-router-dom";
import useAuthStore from "../../stores/useAuthStore";

const Sidebar = () => {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const menuItems = [
    { name: "Dashboard", icon: "📊", path: "/admin-dashboard" },
    ...(isSuperAdmin ? [{ name: "Organizations", icon: "🏢", path: "/admin-dashboard/organizations" }] : []),
    { name: "Trucks", icon: "🚛", path: "/admin-dashboard/vehicles" },
    { name: "Drivers", icon: "👤", path: "/admin-dashboard/drivers" },
    { name: "Admins", icon: "👥", path: "/admin-dashboard/admins" },
    { name: "Areas", icon: "📍", path: "/admin-dashboard/areas" },
    { name: "ML Schedule", icon: "🤖", path: "/admin-dashboard/ml-schedule" },
    { name: "History", icon: "📋", path: "/admin-dashboard/history" },
    { name: "Notifications", icon: "🔔", path: "/admin-dashboard/notifications" },
    ...(isSuperAdmin ? [
      { name: "Pickup Stats", icon: "📦", path: "/admin-dashboard/pickup-stats" },
      { name: "Reports", icon: "📑", path: "/admin-dashboard/reports" },
    ] : []),
  ];

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-primary/15">
      <div className="flex flex-col w-full">
        {/* Brand / Title */}
        <div className="h-16 flex items-center px-6 border-b border-primary/10">
          <p className="text-lg font-bold text-primary tracking-tight">
            Admin Panel
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  end={item.path === "/admin-dashboard"}
                  className={({ isActive }) =>
                    `
                    group flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition
                    ${
                      isActive
                        ? "bg-accent/10 text-black"
                        : "text-primary/70 hover:bg-black/5 hover:text-primary"
                    }
                  `
                  }
                >
                  <span
                    className={`
                      text-lg transition
                      group-hover:scale-105
                    `}
                  >
                    {item.icon}
                  </span>
                  <span className="text-sm">{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* System Status */}
        <div className="p-4 border-t border-primary/10">
          <div className="rounded-2xl border border-accent/20 bg-[#f2f7ee] p-4">
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-wide mb-2">
              System Status
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              <span className="text-sm font-medium text-primary">
                Online
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
