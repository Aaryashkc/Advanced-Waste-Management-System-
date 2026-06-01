import React from "react";
import { NavLink } from "react-router-dom";
import useAuthStore from "../../stores/useAuthStore";
import { useDashboardTheme } from "../../hooks/useDashboardTheme";
import { useAdminNotificationCounts } from "../../hooks/useAdminNotificationCounts";
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
  CreditCard,
  Landmark,
  Mail,
  X,
  Moon,
  Sun,
} from "lucide-react";

const Sidebar = ({ mobileOpen, onClose }) => {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";
  const { theme, toggleTheme } = useDashboardTheme();
  const { totalUnread } = useAdminNotificationCounts();
  const isDark = theme === "dark";

  const navSections = [
    {
      label: "Overview",
      items: [{ name: "Dashboard", icon: LayoutDashboard, path: "/admin-dashboard" }],
    },
    {
      label: "Revenue",
      items: [
        { name: "Billing Management", icon: Receipt, path: "/admin-dashboard/billing" },
        ...(!isSuperAdmin
          ? [{ name: "My Billing", icon: CreditCard, path: "/admin-dashboard/my-billing" }]
          : []),
        { name: "Pricing", icon: DollarSign, path: "/admin-dashboard/pricing" },
        ...(isSuperAdmin
          ? [{ name: "Bank Management", icon: Landmark, path: "/admin-dashboard/organization-banks" }]
          : []),
      ],
    },
    {
      label: "Operations",
      items: [
        ...(isSuperAdmin
          ? [{ name: "Organizations", icon: Building2, path: "/admin-dashboard/organizations" }]
          : [{ name: "My Organization", icon: Building2, path: "/admin-dashboard/my-organization" }]),
        { name: "Areas", icon: MapPin, path: "/admin-dashboard/areas" },
        { name: "ML Schedule", icon: BrainCircuit, path: "/admin-dashboard/ml-schedule" },
        { name: "Trucks", icon: Truck, path: "/admin-dashboard/vehicles" },
        { name: "Drivers", icon: Users, path: "/admin-dashboard/drivers" },
      ],
    },
    {
      label: "People",
      items: [
        { name: "Users", icon: UsersRound, path: "/admin-dashboard/users" },
        { name: "Admins", icon: UserCog, path: "/admin-dashboard/admins" },
      ],
    },
    {
      label: "Insights",
      items: [
        ...(isSuperAdmin
          ? [
              { name: "Pickup Stats", icon: BarChart3, path: "/admin-dashboard/pickup-stats" },
              { name: "Reports", icon: FileText, path: "/admin-dashboard/reports" },
            ]
          : []),
        { name: "History", icon: ClipboardList, path: "/admin-dashboard/history" },
      ],
    },
    {
      label: "Communication",
      items: [
        { name: "Notifications", icon: Bell, path: "/admin-dashboard/notifications" },
        { name: "Contact", icon: Mail, path: "/admin-dashboard/contact" },
      ],
    },
  ];

  const navContent = (
    <div className="flex flex-col w-full h-full">
      {/* Brand */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-primary/10">
        <p className="text-lg font-bold text-primary tracking-tight">
          {isSuperAdmin ? "Super Admin" : "Org Admin"}
        </p>
        {/* Mobile close button */}
        <button
          type="button"
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg hover:bg-primary/5 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5 text-primary/60" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="mb-1.5 px-4 text-[10px] font-bold uppercase tracking-wide text-primary/35">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.name}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/admin-dashboard"}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group flex min-h-10 items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-primary/9 text-primary shadow-sm shadow-primary/5"
                            : "text-primary/[0.58] hover:bg-primary/5 hover:text-primary"
                        }`
                      }
                    >
                      <item.icon className="h-4.5 w-4.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      {item.path === "/admin-dashboard/notifications" && totalUnread > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-sm shadow-red-500/20">
                          {totalUnread > 99 ? "99+" : totalUnread}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Theme toggle */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-primary/10 bg-primary/4 px-3 py-2.5 text-left transition-colors hover:bg-primary/[0.07]"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={isDark}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
              {isDark ? (
                <Moon className="h-4 w-4" aria-hidden />
              ) : (
                <Sun className="h-4 w-4" aria-hidden />
              )}
            </span>
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-primary truncate">
                {isDark ? "Dark mode" : "Light mode"}
              </span>
              <span className="text-xs text-primary/45 truncate">
                {isDark ? "Easier on the eyes" : "Default dashboard look"}
              </span>
            </span>
          </span>
          <span
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${
              isDark ? "bg-primary/35" : "bg-primary/15"
            }`}
            aria-hidden
          >
            <span
              className={`inline-block h-6 w-6 rounded-full bg-(--dash-shell) shadow-sm ring-1 ring-primary/10 transition-transform duration-200 ease-out ${
                isDark ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </span>
        </button>
      </div>

    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden dark:bg-black/50"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-(--dash-shell) border-r border-primary/10 z-50 transform transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-(--dash-shell) border-r border-primary/10 z-30">
        {navContent}
      </aside>
    </>
  );
};

export default Sidebar;
