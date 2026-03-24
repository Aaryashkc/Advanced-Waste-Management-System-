import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../stores/useAuthStore";
import { getSocket } from "../../utils/socket";
import axios from "axios";
import { Bell, LogOut, Menu } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const Topbar = ({ onMenuToggle }) => {
  const navigate = useNavigate();
  const { logout, user, token } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  const displayName = user?.name || "Admin User";
  const displayRole = user?.role || "admin";

  // Fetch aggregated unread count across all notification types
  const fetchTotalUnread = useCallback(async () => {
    if (!token) return;
    try {
      const [alertsRes, contactRes, orgAdminRes, driverRes] = await Promise.all([
        axios.get(`${API_URL}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/contact/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/internal-messages/org_admin/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/internal-messages/driver/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const total =
        (alertsRes.data.count || 0) +
        (contactRes.data.count || 0) +
        (orgAdminRes.data.count || 0) +
        (driverRes.data.count || 0);
      setUnreadCount(total);
    } catch (err) {
      console.error("Failed to fetch unread counts:", err);
    }
  }, [token]);

  useEffect(() => {
    fetchTotalUnread();

    const socket = getSocket();

    // Listen for real-time events that affect unread count
    const incrementCount = () => setUnreadCount(prev => prev + 1);

    socket.on("notification:new", incrementCount);
    socket.on("new_contact_message", incrementCount);
    socket.on("update_unread_count", (count) => setUnreadCount(count));

    // Periodically sync unread count (every 60 seconds)
    const interval = setInterval(fetchTotalUnread, 60000);

    return () => {
      socket.off("notification:new", incrementCount);
      socket.off("new_contact_message", incrementCount);
      socket.off("update_unread_count");
      clearInterval(interval);
    };
  }, [fetchTotalUnread]);

  const initials = React.useMemo(() => {
    const parts = String(displayName).trim().split(/\s+/).slice(0, 2);
    const a = parts[0]?.[0] ?? "A";
    const b = parts[1]?.[0] ?? "U";
    return (a + b).toUpperCase();
  }, [displayName]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="h-16 bg-[#faf8f3]/90 backdrop-blur border-b border-primary/10 fixed top-0 right-0 left-0 z-40">
      <div className="h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile menu toggle */}
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-lg hover:bg-primary/5 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-primary/70" />
          </button>

          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-primary tracking-tight truncate">
              Admin Console
            </h1>
            <p className="hidden sm:block text-xs text-primary/50">
              Monitor vehicles, routes, and collections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <button
            onClick={() => navigate("/admin-dashboard/notifications")}
            className="relative p-2 rounded-lg hover:bg-primary/5 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-primary/70" />
            {unreadCount > 0 && (
              <>
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#faf8f3]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
                {/* Pulse ring for attention */}
                <span className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-red-400 opacity-30 animate-ping" />
              </>
            )}
          </button>

          <div className="hidden sm:block h-8 w-px bg-primary/10" />

          {/* User info */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold text-primary">{displayName}</p>
              <p className="text-xs text-primary/50 capitalize">{displayRole.replace("_", " ")}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-primary/8 flex items-center justify-center text-sm font-bold text-primary">
              {initials}
            </div>
          </div>

          <div className="hidden sm:block h-8 w-px bg-primary/10" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary/70 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
