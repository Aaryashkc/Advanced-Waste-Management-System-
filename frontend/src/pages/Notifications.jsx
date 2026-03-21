import React, { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "../stores/useAuthStore";
import DeletionRequests from "./DeletionRequests";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const Notifications = () => {
  const { token, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("clients");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [counts, setCounts] = useState({
    clients: 0,
    org_admin: 0,
    driver: 0,
    deletions: 0
  });

  const fetchCounts = async () => {
    try {
      const endpoints = [
        axios.get(`${API_URL}/contact/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/internal-messages/org_admin/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/internal-messages/driver/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(user?.role === "super_admin" 
          ? `${API_URL}/super-admin/deletion-requests/pending-count`
          : `${API_URL}/org-admin/deletion-requests/pending-count`, 
          { headers: { Authorization: `Bearer ${token}` } }
        ),
      ];
      const [clientsRes, orgAdminRes, driverRes, deletionsRes] = await Promise.all(endpoints);
      setCounts({
        clients: clientsRes.data.count || 0,
        org_admin: orgAdminRes.data.count || 0,
        driver: driverRes.data.count || 0,
        deletions: deletionsRes.data.count || 0
      });
    } catch (err) {
      console.error("Failed to fetch notification counts", err);
    }
  };

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
        return; // deletion requests handled by its own component
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

  useEffect(() => {
    fetchCounts();
    if (activeTab !== "deletions") {
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

      // Update local state to reflect read status
      setMessages(prev => prev.map(msg => msg._id === id ? { ...msg, status: "read" } : msg));
      setCounts(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
    } catch (err) {
      console.error("Failed to mark message as read", err);
    }
  };

  const tabs = [
    { id: "clients", label: "Client Messages", icon: "👤" },
    { id: "org_admin", label: "Org / Admin", icon: "🏢" },
    { id: "driver", label: "Driver Reports", icon: "🚛" },
    { id: "deletions", label: "Deletion Requests", icon: "🗑️" }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--primary)] text-left">🔔 Notifications Center</h1>
        <p className="text-sm text-[var(--primary)]/60 mt-1 text-left">
          Manage messages, alerts, and requests from across the platform
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--primary)]/10 pb-2 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white text-[var(--primary)] border font-bold shadow-sm"
                : "text-[var(--primary)]/50 hover:text-[var(--primary)] hover:bg-[var(--primary)]/5"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {counts[tab.id] > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.id 
                  ? "bg-[var(--primary)] text-white" 
                  : "bg-red-500 text-white"
              }`}>
                {counts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="pt-2">
        {activeTab === "deletions" ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[var(--primary)]/10">
            <DeletionRequests onUpdate={fetchCounts} />
          </div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-48 bg-white/50 rounded-2xl border border-[var(--primary)]/10">
                <div className="w-8 h-8 border-4 border-[var(--primary)]/20 border-t-[var(--primary)] rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="p-6 bg-red-50 rounded-2xl border border-red-200 text-red-600 text-center font-medium">
                {error}
              </div>
            ) : messages.length === 0 ? (
              <div className="p-12 bg-white rounded-2xl border border-[var(--primary)]/10 text-center text-[var(--primary)]/40">
                No messages found for this category.
              </div>
            ) : (
              messages.map(msg => (
                <div 
                  key={msg._id} 
                  className={`bg-white rounded-2xl border p-5 shadow-sm transition-all text-left ${
                    msg.status === "unread" ? "border-l-4 border-l-[var(--primary)] border-[var(--primary)]/10" : "border-gray-100 opacity-80"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      {msg.status === "unread" && (
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                      )}
                      <h3 className="font-bold text-[var(--primary)] text-lg">
                        {activeTab === "clients" ? msg.name : msg.title}
                      </h3>
                      {msg.status === "unread" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)]">New</span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-[var(--primary)]/40 bg-[var(--primary)]/5 px-2 py-1 rounded-lg">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-[var(--primary)]/50 uppercase tracking-widest mb-1">From</p>
                    <p className="text-sm font-medium text-[var(--primary)]/80">
                      {activeTab === "clients" 
                        ? <>{msg.name} ({msg.email})</>
                        : <>{msg.fromUser?.name} ({msg.fromUser?.role}){msg.orgId && ` - ${msg.orgId.name}`}</>
                      }
                    </p>
                  </div>

                  <div className="bg-[var(--primary)]/[0.03] p-4 rounded-xl border border-[var(--primary)]/5 text-sm text-[var(--primary)]/90 leading-relaxed max-h-48 overflow-y-auto">
                    {msg.message}
                  </div>

                  {msg.status === "unread" && (
                    <div className="mt-4 flex justify-end">
                      <button 
                        onClick={() => markAsRead(msg._id, activeTab)}
                        className="text-xs font-semibold text-[var(--primary)] hover:text-white border border-[var(--primary)] hover:bg-[var(--primary)] px-4 py-2 rounded-lg transition-colors"
                      >
                        Mark as Read ✔️
                      </button>
                    </div>
                  )}
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
