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
    { name: "Districts", icon: "📍", path: "/admin-dashboard/districts" },
    { name: "ML Schedule", icon: "🤖", path: "/admin-dashboard/ml-schedule" },
    { name: "Schedule History", icon: "📋", path: "/admin-dashboard/ml-schedule/history" },
    { name: "Notifications", icon: "🔔", path: "/admin-dashboard/notifications" },
    ...(isSuperAdmin ? [
      { name: "Pickup Stats", icon: "📦", path: "/admin-dashboard/pickup-stats" },
      { name: "Reports", icon: "📑", path: "/admin-dashboard/reports" },
    ] : []),
  ];

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-[var(--primary)]/15">
      <div className="flex flex-col w-full">
        {/* Brand / Title */}
        <div className="h-16 flex items-center px-6 border-b border-[var(--primary)]/10">
          <p className="text-lg font-bold text-[var(--primary)] tracking-tight">
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
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "text-[var(--primary)]/70 hover:bg-black/5 hover:text-[var(--primary)]"
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
        <div className="p-4 border-t border-[var(--primary)]/10">
          <div className="rounded-2xl border border-[var(--accent)]/20 bg-[#f2f7ee] p-4">
            <p className="text-xs font-semibold text-[var(--primary)]/70 uppercase tracking-wide mb-2">
              System Status
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
              <span className="text-sm font-medium text-[var(--primary)]">
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
