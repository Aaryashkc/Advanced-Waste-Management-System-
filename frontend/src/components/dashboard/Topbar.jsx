import React, { useState, useEffect } from "react";
import Button from "../common/Button";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../stores/useAuthStore";
import { io } from "socket.io-client";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";

const Topbar = ({ name = "Admin User", role = "System Administrator" }) => {
  const navigate = useNavigate();
  const { logout, user, token } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  // Use user data from store if available
  const displayName = user?.name || name;
  const displayRole = user?.role || role;

  useEffect(() => {
    // 1. Fetch initial unread count
    const fetchUnreadCount = async () => {
      try {
        const response = await axios.get(`${API_URL}/contact/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUnreadCount(response.data.count || 0);
      } catch (err) {
        console.error("Failed to fetch unread count:", err);
      }
    };

    if (token) {
      fetchUnreadCount();
    }

    // 2. Setup Socket.IO listener
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true
    });

    socket.on("connect_error", (err) => {
      console.warn("Socket connection error in topbar:", err.message);
    });

    socket.on("new_contact_message", () => {
      setUnreadCount(prev => prev + 1);
    });

    socket.on("update_unread_count", (count) => {
      setUnreadCount(count);
    });

    return () => socket.disconnect();
  }, [token]);

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
    <header className="h-16 bg-white/90 backdrop-blur border-b border-primary/12 fixed top-0 right-0 left-0 z-40">
      <div className="h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile brand icon */}
          <div className="md:hidden w-10 h-10 rounded-2xl bg-[#f5f1e8] border border-primary/12 flex items-center justify-center">
            <span className="text-xl">♻️</span>
          </div>

          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-primary tracking-tight truncate">
              Admin Console
            </h1>
            <p className="hidden sm:block text-xs text-primary/60 truncate">
              Monitor vehicles, routes, and collections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <button 
              onClick={() => navigate("/admin-dashboard/notifications")}
              className="relative p-2 rounded-full hover:bg-primary/5 transition-colors focus:outline-none" 
              aria-label="Notifications"
            >
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <div className="text-right hidden sm:block leading-tight border-l pl-3 border-primary/10">
              <p className="text-sm font-semibold text-primary">
                {displayName}
              </p>
              <p className="text-xs text-primary/60">{displayRole}</p>
            </div>

            <div className="h-10 w-10 rounded-2xl bg-[#f5f1e8] border border-primary/12 flex items-center justify-center font-bold text-primary">
              {initials}
            </div>
          </div>

          <div className="hidden sm:block h-8 w-px bg-primary/10" />

          <Button
            variant="outline"
            onClick={handleLogout}
            className="px-3! py-2! text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
