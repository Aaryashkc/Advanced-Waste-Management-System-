import React from "react";
import { NavLink } from "react-router-dom";
import useAuthStore from "../../stores/useAuthStore";
import {
  LayoutDashboard,
  Building2,
  Truck,
  Users,
  UserCog,
  UsersRound,
  MapPin,
  BrainCircuit,
  ClipboardList,
  Bell,
  BarChart3,
  FileText,
  DollarSign,
  Receipt,
  X,
} from "lucide-react";

const Sidebar = ({ mobileOpen, onClose }) => {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/admin-dashboard" },
    ...(isSuperAdmin
      ? [{ name: "Organizations", icon: Building2, path: "/admin-dashboard/organizations" }]
      : []),
    { name: "Trucks", icon: Truck, path: "/admin-dashboard/vehicles" },
    { name: "Drivers", icon: Users, path: "/admin-dashboard/drivers" },
    { name: "Admins", icon: UserCog, path: "/admin-dashboard/admins" },
    { name: "Areas", icon: MapPin, path: "/admin-dashboard/areas" },
    { name: "ML Schedule", icon: BrainCircuit, path: "/admin-dashboard/ml-schedule" },
    { name: "Pricing", icon: DollarSign, path: "/admin-dashboard/pricing" },
    { name: "History", icon: ClipboardList, path: "/admin-dashboard/history" },
    { name: "Notifications", icon: Bell, path: "/admin-dashboard/notifications" },
    { name: "Billing", icon: Receipt, path: "/admin-dashboard/billing" },
    ...(isSuperAdmin
      ? [
          { name: "Users", icon: UsersRound, path: "/admin-dashboard/users" },
          { name: "Pickup Stats", icon: BarChart3, path: "/admin-dashboard/pickup-stats" },
          { name: "Reports", icon: FileText, path: "/admin-dashboard/reports" },
        ]
      : []),
  ];

  const navContent = (
    <div className="flex flex-col w-full h-full">
      {/* Brand */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-primary/10">
        <p className="text-lg font-bold text-primary tracking-tight">
          Admin Panel
        </p>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg hover:bg-primary/5 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5 text-primary/60" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto">
        <ul className="space-y-0.5">
          {menuItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                end={item.path === "/admin-dashboard"}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/8 text-primary"
                      : "text-primary/60 hover:bg-primary/5 hover:text-primary"
                  }`
                }
              >
                <item.icon className="w-4.5 h-4.5 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* System Status */}
      <div className="p-4 border-t border-primary/10">
        <div className="flex items-center gap-2 px-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-medium text-primary/50">
            System Online
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-[#faf8f3] border-r border-primary/10 z-50 transform transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-[#faf8f3] border-r border-primary/10 z-30">
        {navContent}
      </aside>
    </>
  );
};

export default Sidebar;
