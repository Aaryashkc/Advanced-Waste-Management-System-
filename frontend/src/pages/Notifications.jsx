import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import useAuthStore from "../stores/useAuthStore";
import { getSocket } from "../utils/socket";
import DeletionRequests from "./DeletionRequests";
import { Bell, AlertTriangle, CheckCircle, Info, Truck, User, Ban, RotateCcw, Clock, CheckCheck, Filter, RefreshCw } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const SEVERITY_CONFIG = {
  critical: { border: "border-l-red-500", bg: "bg-red-50/60", badge: "bg-red-100 text-red-700", icon: <AlertTriangle className="w-5 h-5 text-red-500" /> },
  warning: { border: "border-l-amber-500", bg: "bg-amber-50/60", badge: "bg-amber-100 text-amber-700", icon: <AlertTriangle className="w-5 h-5 text-amber-500" /> },
  info: { border: "border-l-blue-500", bg: "bg-blue-50/60", badge: "bg-blue-100 text-blue-700", icon: <Info className="w-5 h-5 text-blue-500" /> },
};

const TYPE_ICONS = {
  driverless_truck: <Truck className="w-5 h-5 text-primary/70" />,
  no_driver: <User className="w-5 h-5 text-primary/70" />,
  no_truck: <Ban className="w-5 h-5 text-primary/70" />,
  schedule_failed: <AlertTriangle className="w-5 h-5 text-red-500" />,
  redispatch_needed: <RotateCcw className="w-5 h-5 text-primary/70" />,
  general: <Bell className="w-5 h-5 text-primary/70" />,
};

const Notifications = () => {
  const { token, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("alerts");
  const [messages, setMessages] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [counts, setCounts] = useState({
    alerts: 0,
    clients: 0,
    org_admin: 0,
    driver: 0,
    deletions: 0
  });
  const socketListenersRef = useRef(false);

  const totalUnread = counts.alerts + counts.clients + counts.org_admin + counts.driver + counts.deletions;

  const fetchSystemAlerts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemAlerts(res.data.data || []);
      return res.data.unreadCount || 0;
    } catch (err) {
      console.error("Failed to fetch system alerts", err);
      return 0;
    }
  }, [token]);

  const markAlertRead = async (id) => {
    try {
      await axios.put(`${API_URL}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemAlerts(prev => prev.map(a =>
        a._id === id ? { ...a, isRead: true } : a
      ));
      setCounts(prev => ({ ...prev, alerts: Math.max(0, prev.alerts - 1) }));
    } catch (err) {
      console.error("Failed to mark alert as read", err);
    }
  };

  const markAllAlertsRead = async () => {
    try {
      await axios.put(`${API_URL}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
      setCounts(prev => ({ ...prev, alerts: 0 }));
    } catch (err) {
      console.error("Failed to mark all alerts as read", err);
    }
  };

  const fetchCounts = useCallback(async () => {
    try {
      const [alertsCount, clientsRes, orgAdminRes, driverRes, deletionsRes] = await Promise.all([
        fetchSystemAlerts(),
        axios.get(`${API_URL}/contact/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/internal-messages/org_admin/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/internal-messages/driver/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(user?.role === "super_admin"
          ? `${API_URL}/super-admin/deletion-requests/pending-count`
          : `${API_URL}/org-admin/deletion-requests/pending-count`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
      ]);
      setCounts({
        alerts: alertsCount,
        clients: clientsRes.data.count || 0,
        org_admin: orgAdminRes.data.count || 0,
        driver: driverRes.data.count || 0,
        deletions: deletionsRes.data.count || 0
      });
    } catch (err) {
      console.error("Failed to fetch notification counts", err);
    }
  }, [token, user, fetchSystemAlerts]);

  const fetchMessages = async (type) => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = "";
      if (type === "clients") {
        endpoint = `${API_URL}/contact/messages`;
      } else if (type === "org_admin" || type === "driver") {
        endpoint = `${API_URL}/internal-messages/${type}`;
      } else {
        setLoading(false);
        return;
      }

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  // Socket listeners for real-time updates
  useEffect(() => {
    if (socketListenersRef.current) return;
    socketListenersRef.current = true;

    const socket = getSocket();

    // Real-time system notification
    socket.on("notification:new", (notification) => {
      setSystemAlerts(prev => [{ ...notification, isRead: false }, ...prev]);
      setCounts(prev => ({ ...prev, alerts: prev.alerts + 1 }));
    });

    // Real-time contact message
    socket.on("new_contact_message", () => {
      setCounts(prev => ({ ...prev, clients: prev.clients + 1 }));
      if (activeTab === "clients") {
        fetchMessages("clients");
      }
    });

    // General unread count update
    socket.on("update_unread_count", (count) => {
      setCounts(prev => ({ ...prev, clients: count }));
    });

    // Real-time notification count sync
    socket.on("notification:counts", (newCounts) => {
      setCounts(prev => ({ ...prev, ...newCounts }));
    });

    return () => {
      socket.off("notification:new");
      socket.off("new_contact_message");
      socket.off("update_unread_count");
      socket.off("notification:counts");
      socketListenersRef.current = false;
    };
  }, [activeTab]);

  useEffect(() => {
    fetchCounts();
    if (activeTab !== "deletions" && activeTab !== "alerts") {
      fetchMessages(activeTab);
    }
  }, [activeTab, token]);

  const markAsRead = async (id, type) => {
    try {
      const endpoint = type === "clients"
        ? `${API_URL}/contact/${id}/read`
        : `${API_URL}/internal-messages/${id}/read`;

      await axios.put(endpoint, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessages(prev => prev.map(msg => msg._id === id ? { ...msg, status: "read" } : msg));
      setCounts(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
    } catch (err) {
      console.error("Failed to mark message as read", err);
    }
  };

  const filteredAlerts = filterSeverity === "all"
    ? systemAlerts
    : systemAlerts.filter(a => a.severity === filterSeverity);

  const tabs = [
    { id: "alerts", label: "System Alerts", icon: <AlertTriangle className="w-4 h-4" /> },
    { id: "clients", label: "Client Messages", icon: <User className="w-4 h-4" /> },
    { id: "org_admin", label: "Org / Admin", icon: <Bell className="w-4 h-4" /> },
    { id: "driver", label: "Driver Reports", icon: <Truck className="w-4 h-4" /> },
    { id: "deletions", label: "Deletion Requests", icon: <Ban className="w-4 h-4" /> }
  ];

  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary text-left">Notifications Center</h1>
              <p className="text-sm text-primary/50 mt-0.5 text-left">
                {totalUnread > 0 ? `${totalUnread} unread notification${totalUnread > 1 ? "s" : ""}` : "All caught up"}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={fetchCounts}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary/70 rounded-xl border border-primary/10 hover:bg-primary/5 transition self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative p-3 rounded-xl border text-left transition-all ${
              activeTab === tab.id
                ? "bg-white border-primary/20 shadow-sm ring-1 ring-primary/10"
                : "bg-white/50 border-primary/8 hover:bg-white hover:border-primary/15"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`${activeTab === tab.id ? "text-primary" : "text-primary/50"}`}>
                {tab.icon}
              </span>
              {counts[tab.id] > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white animate-pulse">
                  {counts[tab.id]}
                </span>
              )}
            </div>
            <p className={`text-xs font-medium truncate ${activeTab === tab.id ? "text-primary" : "text-primary/50"}`}>
              {tab.label}
            </p>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div>
        {activeTab === "alerts" ? (
          <div className="space-y-4">
            {/* Alerts toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary/40" />
                <div className="flex gap-1">
                  {["all", "critical", "warning", "info"].map(sev => (
                    <button
                      key={sev}
                      onClick={() => setFilterSeverity(sev)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        filterSeverity === sev
                          ? "bg-primary text-white"
                          : "bg-primary/5 text-primary/60 hover:bg-primary/10"
                      }`}
                    >
                      {sev === "all" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {systemAlerts.some(a => !a.isRead) && (
                <button
                  onClick={markAllAlertsRead}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 px-3 py-1.5 rounded-lg border border-primary/10 hover:bg-primary/5 transition"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark All Read
                </button>
              )}
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="p-12 bg-white rounded-2xl border border-primary/10 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="font-semibold text-primary/60">No alerts</p>
                <p className="text-sm text-primary/40 mt-1">Everything is running smoothly</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map(alert => {
                  const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
                  return (
                    <div
                      key={alert._id}
                      className={`bg-white rounded-xl border border-l-4 overflow-hidden transition-all ${
                        !alert.isRead
                          ? `${sev.border} ${sev.bg} shadow-sm`
                          : "border-gray-200 border-l-gray-300 opacity-60"
                      }`}
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className="flex-shrink-0 mt-0.5">
                            {TYPE_ICONS[alert.type] || TYPE_ICONS.general}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-primary text-sm">{alert.title}</h3>
                                {!alert.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sev.badge}`}>
                                  {alert.severity}
                                </span>
                              </div>
                              <span className="text-xs text-primary/40 whitespace-nowrap flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(alert.createdAt)}
                              </span>
                            </div>

                            <p className="text-sm text-primary/70 leading-relaxed mt-1.5">
                              {alert.message}
                            </p>

                            {/* Related trucks */}
                            {alert.relatedData?.trucks?.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {alert.relatedData.trucks.map((t, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs">
                                    <Truck className="w-3 h-3 text-primary/50" />
                                    <span className="font-semibold text-primary">{t.licensePlate}</span>
                                    {t.capacity && <span className="text-primary/40">({t.capacity}kg)</span>}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Mark as read */}
                            {!alert.isRead && (
                              <button
                                onClick={() => markAlertRead(alert._id)}
                                className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary/60 hover:text-primary transition"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Mark as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === "deletions" ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-primary/10">
            <DeletionRequests onUpdate={fetchCounts} />
          </div>
        ) : (
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-48 bg-white/50 rounded-2xl border border-primary/10">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="p-6 bg-red-50 rounded-2xl border border-red-200 text-red-600 text-center font-medium">
                {error}
              </div>
            ) : messages.length === 0 ? (
              <div className="p-12 bg-white rounded-2xl border border-primary/10 text-center">
                <Bell className="w-12 h-12 text-primary/20 mx-auto mb-3" />
                <p className="font-semibold text-primary/60">No messages</p>
                <p className="text-sm text-primary/40 mt-1">No messages found for this category</p>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg._id}
                  className={`bg-white rounded-xl border overflow-hidden transition-all ${
                    msg.status === "unread"
                      ? "border-l-4 border-l-primary border-primary/15 shadow-sm"
                      : "border-gray-200 opacity-70"
                  }`}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      <div className="flex-shrink-0 mt-1">
                        {msg.status === "unread" ? (
                          <span className="flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full h-3 w-3 bg-gray-300" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-primary text-sm">
                              {activeTab === "clients" ? msg.name : msg.title}
                            </h3>
                            <p className="text-xs text-primary/50 mt-0.5">
                              {activeTab === "clients"
                                ? `${msg.email}`
                                : `${msg.fromUser?.name || "Unknown"} (${msg.fromUser?.role || ""})`
                              }
                              {msg.orgId?.name && <span className="text-primary/40"> · {msg.orgId.name}</span>}
                            </p>
                          </div>
                          <span className="text-xs text-primary/40 whitespace-nowrap flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>

                        <div className="mt-2 bg-primary/[0.03] p-3 rounded-lg border border-primary/5 text-sm text-primary/80 leading-relaxed max-h-32 overflow-y-auto">
                          {msg.message}
                        </div>

                        {msg.status === "unread" && (
                          <button
                            onClick={() => markAsRead(msg._id, activeTab)}
                            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary/60 hover:text-primary transition"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
