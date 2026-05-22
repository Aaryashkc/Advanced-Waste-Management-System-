import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Calendar, Truck, AlertTriangle, Radio, ArrowLeft,
  CheckCheck, ChevronRight, Inbox,
} from "lucide-react";
import { getSocket } from "../../utils/socket";
import useAuthStore from "../../stores/useAuthStore";
import api from "../../utils/api";
import PaginationControls from "../shared/PaginationControls";

const SEVERITY_CONFIG = {
  info:     { bg: "bg-blue-50",  border: "border-blue-200",  iconBg: "bg-blue-100",  iconColor: "text-blue-600",  badge: "bg-blue-100 text-blue-700" },
  warning:  { bg: "bg-amber-50", border: "border-amber-200", iconBg: "bg-amber-100", iconColor: "text-amber-600", badge: "bg-amber-100 text-amber-700" },
  critical: { bg: "bg-red-50",   border: "border-red-200",   iconBg: "bg-red-100",   iconColor: "text-red-600",   badge: "bg-red-100 text-red-700" },
};

const TYPE_META = {
  schedule_confirmed: { label: "Schedule",   Icon: Calendar },
  general:            { label: "General",     Icon: Bell },
  driverless_truck:   { label: "Truck Alert", Icon: Truck },
  no_driver:          { label: "Driver Alert",Icon: AlertTriangle },
  redispatch_needed:  { label: "Redispatch",  Icon: Radio },
};

export default function DriverNotifications() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api.get(`/notifications?limit=10&page=${page}`);
      setNotifications(res.data.data || []);
      setPagination(res.data.pagination || null);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [page, token]);

  useEffect(() => {
    fetchNotifications();
    const socket = getSocket();
    const onNew = () => fetchNotifications();
    socket.on("notification:new", onNew);
    socket.on("schedule:confirmed", onNew);
    return () => {
      socket.off("notification:new", onNew);
      socket.off("schedule:confirmed", onNew);
    };
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleNotificationClick = (n) => {
    if (!n.isRead) markAsRead(n._id);
    if (n.type === "schedule_confirmed") navigate("/driver-ml-assignments");
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="min-h-screen bg-[#f5f3ee] pb-24">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#354f52] to-[#2d4a4e] px-5 sm:px-8 pt-8 pb-10 sm:rounded-b-3xl">
        <button onClick={() => navigate("/driver-dashboard")} className="flex items-center gap-2 text-white/70 hover:text-white mb-4 transition">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Alerts</h1>
            <p className="text-sm text-white/50 mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs font-semibold text-white/80 bg-white/15 backdrop-blur-sm px-3 py-2 rounded-xl hover:bg-white/25 transition"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="px-5 sm:px-8 -mt-5 space-y-3 max-w-2xl">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm">
            <div className="w-10 h-10 border-4 border-primary/15 border-t-[#354f52] rounded-full animate-spin" />
            <p className="text-sm text-primary/50 mt-3">Loading alerts...</p>
          </div>
        )}

        {/* Notification Cards */}
        {!loading && notifications.map((n) => {
          const severity = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.info;
          const meta = TYPE_META[n.type] || TYPE_META.general;
          const Icon = meta.Icon;

          return (
            <button
              key={n._id}
              onClick={() => handleNotificationClick(n)}
              className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 hover:shadow-md active:scale-[0.98] ${
                n.isRead
                  ? "bg-white border-primary/8"
                  : `${severity.bg} ${severity.border} shadow-sm`
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  n.isRead ? "bg-primary/5" : severity.iconBg
                }`}>
                  <Icon size={18} className={n.isRead ? "text-primary/25" : severity.iconColor} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      n.isRead ? "bg-primary/5 text-primary/35" : severity.badge
                    }`}>
                      {meta.label}
                    </span>
                    <span className={`text-[10px] ${n.isRead ? "text-primary/25" : "text-primary/45"}`}>
                      {formatTime(n.createdAt)}
                    </span>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 ml-auto shrink-0" />
                    )}
                  </div>
                  <p className={`text-sm font-semibold leading-snug ${n.isRead ? "text-primary/45" : "text-primary"}`}>
                    {n.title}
                  </p>
                  <p className={`text-xs mt-1 leading-relaxed ${n.isRead ? "text-primary/30" : "text-primary/55"}`}>
                    {n.message}
                  </p>
                  {n.type === "schedule_confirmed" && !n.isRead && (
                    <p className="text-xs text-blue-600 font-semibold mt-2 flex items-center gap-1">
                      View Schedule <ChevronRight size={12} />
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {!loading && (
          <PaginationControls
            pagination={pagination}
            onPageChange={setPage}
            itemLabel="alerts"
          />
        )}

        {/* Empty state */}
        {!loading && notifications.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-primary/8">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <Inbox size={28} className="text-violet-400" />
            </div>
            <h3 className="text-base font-semibold text-primary/70 mb-1">No alerts yet</h3>
            <p className="text-sm text-primary/40 max-w-xs mx-auto">
              You'll receive alerts here when schedules are confirmed, trucks need attention, or areas are assigned.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
