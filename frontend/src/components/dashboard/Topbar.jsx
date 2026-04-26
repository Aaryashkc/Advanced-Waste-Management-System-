import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../stores/useAuthStore";
import useBillingStore from "../../stores/useBillingStore";
import { getSocket } from "../../utils/socket";
import axios from "axios";
import { AlertTriangle, Bell, CreditCard, LogOut, Menu } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const Topbar = ({ onMenuToggle }) => {
  const navigate = useNavigate();
  const { logout, user, token } = useAuthStore();
  const { bills, summary: billingSummary, fetchMyBills } = useBillingStore();
  const [unreadCount, setUnreadCount] = useState(0);

  const displayName = user?.name || "Admin User";
  const displayRole = user?.role || "admin";
  const shouldShowAdminBilling = user?.role === "admin";
  const overdueBills = shouldShowAdminBilling
    ? bills.filter((bill) => bill.status === "OVERDUE")
    : [];
  const unpaidBillCount = shouldShowAdminBilling ? billingSummary?.unpaid || 0 : 0;
  const hasBillingAlert = shouldShowAdminBilling && unpaidBillCount > 0;
  const billingAlertLabel = overdueBills.length > 0 ? "Payment overdue" : "Payment due";

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
    socket.on("notification:counts", () => fetchTotalUnread());

    // Periodically sync unread count (every 60 seconds)
    const interval = setInterval(fetchTotalUnread, 60000);

    return () => {
      socket.off("notification:new", incrementCount);
      socket.off("new_contact_message", incrementCount);
      socket.off("update_unread_count");
      socket.off("notification:counts");
      clearInterval(interval);
    };
  }, [fetchTotalUnread]);

  useEffect(() => {
    if (!shouldShowAdminBilling) return;

    fetchMyBills();

    const refetch = () => fetchMyBills();
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    const interval = setInterval(refetch, 60000);

    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [shouldShowAdminBilling, fetchMyBills]);

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
    <header className="h-16 bg-[color-mix(in_srgb,var(--dash-shell)_92%,transparent)] backdrop-blur-md border-b border-primary/10 fixed top-0 right-0 left-0 z-40 supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--dash-shell)_88%,transparent)]">
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
          {hasBillingAlert && (
            <button
              onClick={() => navigate("/billing")}
              className={`hidden sm:inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                overdueBills.length > 0
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
              aria-label={`${billingAlertLabel}: ${unpaidBillCount} unpaid bill${unpaidBillCount === 1 ? "" : "s"}`}
            >
              {overdueBills.length > 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              <span>{billingAlertLabel}</span>
            </button>
          )}

          {hasBillingAlert && (
            <button
              onClick={() => navigate("/billing")}
              className={`relative p-2 rounded-lg transition-colors sm:hidden ${
                overdueBills.length > 0
                  ? "bg-red-50 text-red-700 hover:bg-red-100"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
              aria-label={`${billingAlertLabel}: ${unpaidBillCount} unpaid bill${unpaidBillCount === 1 ? "" : "s"}`}
            >
              {overdueBills.length > 0 ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[var(--dash-shell)]">
                {unpaidBillCount > 9 ? "9+" : unpaidBillCount}
              </span>
            </button>
          )}

          {/* Notification Bell */}
          <button
            onClick={() => navigate("/admin-dashboard/notifications")}
            className="relative p-2 rounded-lg hover:bg-primary/5 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-primary/70" />
            {unreadCount > 0 && (
              <>
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[var(--dash-shell)]">
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
