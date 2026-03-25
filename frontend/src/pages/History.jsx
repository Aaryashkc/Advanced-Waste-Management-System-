import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../stores/useAuthStore";
import useMLScheduleStore from "../stores/useMLScheduleStore";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const STATUS_COLORS = {
  COMPLETED: "bg-emerald-100 text-emerald-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  EN_ROUTE: "bg-indigo-100 text-indigo-700",
  ARRIVED: "bg-purple-100 text-purple-700",
  COLLECTING: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  PENDING: "bg-yellow-100 text-yellow-700",
};

const LEVEL_COLORS = {
  hard: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  easy: "bg-green-100 text-green-700",
};

const TABS = [
  { id: "pickups", label: "Pickup History" },
  { id: "completions", label: "Schedule Completions" },
  { id: "customers", label: "Customer Stats" },
  { id: "drivers", label: "Driver Stats" },
];

const fmt = (ms) => {
  if (!ms) return "--";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const History = () => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === "super_admin";

  const [activeTab, setActiveTab] = useState("pickups");
  const [loading, setLoading] = useState(true);

  // Pickup history state
  const [pickups, setPickups] = useState([]);
  const [pickupStats, setPickupStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Customer history state
  const [customers, setCustomers] = useState([]);
  const [customerTotals, setCustomerTotals] = useState({});

  // Driver history state
  const [drivers, setDrivers] = useState([]);
  const [driverTotals, setDriverTotals] = useState({});

  // ML Schedule completions
  const { completions, fetchCompletions, loading: mlLoading } = useMLScheduleStore();

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // Expanded row for audit trail
  const [expandedPickup, setExpandedPickup] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // Fetch pickup history
  useEffect(() => {
    if (activeTab !== "pickups") return;
    setLoading(true);
    const params = new URLSearchParams({ page: currentPage, limit: 30 });
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);

    fetch(`${API_URL}/history/pickups?${params}`, { headers })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setPickups(json.data.pickups);
          setPickupStats(json.data.stats);
          setPagination(json.data.pagination);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab, currentPage, statusFilter, categoryFilter]);

  // Fetch customer history
  useEffect(() => {
    if (activeTab !== "customers") return;
    setLoading(true);
    fetch(`${API_URL}/history/customers`, { headers })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setCustomers(json.data.customers);
          setCustomerTotals({
            totalCustomers: json.data.totalCustomers,
            totalPickups: json.data.totalPickups,
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab]);

  // Fetch driver history
  useEffect(() => {
    if (activeTab !== "drivers") return;
    setLoading(true);
    fetch(`${API_URL}/history/drivers`, { headers })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setDrivers(json.data.drivers);
          setDriverTotals({
            totalDrivers: json.data.totalDrivers,
            totalPickups: json.data.totalPickups,
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab]);

  // Fetch ML schedule completions
  useEffect(() => {
    if (activeTab !== "completions") return;
    fetchCompletions();
  }, [activeTab]);

  // Fetch audit trail for a pickup
  const fetchAuditTrail = useCallback(async (pickupId) => {
    if (expandedPickup === pickupId) {
      setExpandedPickup(null);
      return;
    }
    setExpandedPickup(pickupId);
    setAuditLoading(true);
    try {
      const res = await fetch(`${API_URL}/pickups/${pickupId}/events`, { headers });
      const json = await res.json();
      if (json.success) setAuditEvents(json.data);
    } catch (err) {
      console.error("Failed to fetch audit trail:", err);
    } finally {
      setAuditLoading(false);
    }
  }, [expandedPickup]);

  const filteredCustomers = customers.filter(
    (c) =>
      !searchTerm ||
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDrivers = drivers.filter(
    (d) =>
      !searchTerm ||
      d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">History</h1>
        <p className="text-sm text-primary/60 mt-1">
          {isSuperAdmin ? "Complete pickup history across all organizations" : "Pickup history for your organization"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-primary/4 rounded-2xl p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchTerm(""); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id ? "bg-white text-primary shadow-sm" : "text-primary/50 hover:text-primary/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════ PICKUP HISTORY TAB ═══════ */}
      {activeTab === "pickups" && (
        <>
          {/* Stats Cards */}
          {pickupStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: "Total", value: pickupStats.total, color: "text-primary", bg: "bg-white" },
                { label: "Completed", value: pickupStats.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Active", value: pickupStats.active, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Cancelled", value: pickupStats.cancelled, color: "text-red-500", bg: "bg-red-50" },
                { label: "Expired", value: pickupStats.expired, color: "text-gray-500", bg: "bg-gray-50" },
                { label: "Success", value: `${pickupStats.completionRate || 0}%`, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Avg Response", value: fmt(pickupStats.avgResponseMs), color: "text-purple-600", bg: "bg-purple-50" },
                { label: "Avg Task", value: fmt(pickupStats.avgTaskDurationMs), color: "text-amber-600", bg: "bg-amber-50" },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-2xl border border-primary/10 p-4 text-center`}>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-primary/50 font-medium mt-1 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2.5 rounded-xl border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 text-primary bg-white"
            >
              <option value="">All Statuses</option>
              {["COMPLETED", "ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING", "CANCELLED", "EXPIRED", "PENDING"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2.5 rounded-xl border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 text-primary bg-white"
            >
              <option value="">All Categories</option>
              <option value="recyclable">Recyclable</option>
              <option value="non-recyclable">Non-Recyclable</option>
              <option value="both">Mixed</option>
            </select>
            {pagination.total > 0 && (
              <span className="text-xs text-primary/40 ml-auto">
                Showing {(pagination.page - 1) * 30 + 1}-{Math.min(pagination.page * 30, pagination.total)} of {pagination.total}
              </span>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-accent rounded-full animate-spin" />
            </div>
          )}

          {/* Pickup Table */}
          {!loading && pickups.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
              <p className="text-4xl mb-3 opacity-40">&#x1F4ED;</p>
              <h3 className="text-lg font-semibold text-primary/70 mb-1">No Pickups Found</h3>
              <p className="text-sm text-primary/50">
                {statusFilter || categoryFilter ? "Try adjusting the filters." : "No pickup history available yet."}
              </p>
            </div>
          )}

          {!loading && pickups.length > 0 && (
            <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-primary/3 border-b border-primary/10">
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Driver</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Level</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Response</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Duration</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Location</th>
                      {isSuperAdmin && (
                        <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Org</th>
                      )}
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {pickups.map((p) => (
                      <React.Fragment key={p._id}>
                        <tr className={`hover:bg-primary/2 transition cursor-pointer ${expandedPickup === p._id ? "bg-primary/3" : ""}`} onClick={() => fetchAuditTrail(p._id)}>
                          <td className="px-4 py-3 text-sm text-primary/70 whitespace-nowrap">
                            {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            <br />
                            <span className="text-xs text-primary/40">
                              {new Date(p.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-primary">
                                {p.customer?.name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-primary">{p.customer?.name || "Unknown"}</p>
                                <p className="text-[10px] text-primary/40">{p.customer?.phone || ""}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {p.driver ? (
                              <div>
                                <p className="text-sm font-medium text-primary">{p.driver.name}</p>
                                <p className="text-[10px] text-primary/40">{p.driver.phone || ""}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-primary/30 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-primary/70 capitalize">{p.category}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${LEVEL_COLORS[p.level] || "bg-gray-100 text-gray-600"}`}>
                              {p.level}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-purple-600 whitespace-nowrap">{fmt(p.responseTimeMs)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-amber-600 whitespace-nowrap">{fmt(p.taskDurationMs)}</td>
                          <td className="px-4 py-3 text-sm text-primary/70 max-w-32 truncate">
                            {p.area || p.location?.address || "\u2014"}
                          </td>
                          {isSuperAdmin && (
                            <td className="px-4 py-3 text-sm text-primary/60">{p.organization}</td>
                          )}
                          <td className="px-4 py-3">
                            <svg className={`w-4 h-4 text-primary/30 transition-transform ${expandedPickup === p._id ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                        </tr>
                        {/* Expanded Audit Trail */}
                        {expandedPickup === p._id && (
                          <tr>
                            <td colSpan={isSuperAdmin ? 11 : 10} className="px-0 py-0">
                              <div className="bg-primary/2 border-t border-b border-primary/10 px-6 py-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Audit Trail & Timeline</h4>
                                  {p.cancelledAt && (
                                    <span className="text-xs text-red-500">
                                      Cancelled by {p.cancelledBy?.name || "Unknown"} ({p.cancelledBy?.role || "?"})
                                    </span>
                                  )}
                                </div>

                                {/* Timestamps Row */}
                                <div className="flex flex-wrap gap-3 mb-4">
                                  {[
                                    { label: "Created", time: p.createdAt, color: "border-yellow-400" },
                                    { label: "Assigned", time: p.assignedAt, color: "border-blue-400" },
                                    { label: "Completed", time: p.completedAt, color: "border-emerald-400" },
                                    { label: "Cancelled", time: p.cancelledAt, color: "border-red-400" },
                                  ].filter((t) => t.time).map((t) => (
                                    <div key={t.label} className={`px-3 py-2 bg-white rounded-xl border-l-4 ${t.color}`}>
                                      <p className="text-[10px] text-primary/40 uppercase font-medium">{t.label}</p>
                                      <p className="text-xs text-primary font-medium">
                                        {new Date(t.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                      </p>
                                    </div>
                                  ))}
                                  {p.responseTimeMs && (
                                    <div className="px-3 py-2 bg-purple-50 rounded-xl">
                                      <p className="text-[10px] text-purple-500 uppercase font-medium">Response Time</p>
                                      <p className="text-xs text-purple-700 font-bold">{fmt(p.responseTimeMs)}</p>
                                    </div>
                                  )}
                                  {p.taskDurationMs && (
                                    <div className="px-3 py-2 bg-amber-50 rounded-xl">
                                      <p className="text-[10px] text-amber-500 uppercase font-medium">Task Duration</p>
                                      <p className="text-xs text-amber-700 font-bold">{fmt(p.taskDurationMs)}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Audit Events */}
                                {auditLoading ? (
                                  <div className="flex items-center gap-2 text-xs text-primary/40">
                                    <div className="w-4 h-4 border-2 border-primary/20 border-t-accent rounded-full animate-spin" />
                                    Loading audit trail...
                                  </div>
                                ) : auditEvents.length > 0 ? (
                                  <div className="relative pl-4 space-y-3">
                                    <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-primary/10" />
                                    {auditEvents.map((ev, i) => (
                                      <div key={ev._id || i} className="relative flex items-start gap-3">
                                        <div className={`w-3 h-3 rounded-full shrink-0 mt-0.5 border-2 border-white z-10 ${
                                          ev.event === "COMPLETED" ? "bg-emerald-500" :
                                          ev.event === "CANCELLED" ? "bg-red-500" :
                                          ev.event === "ACCEPTED" ? "bg-blue-500" :
                                          ev.event === "CREATED" ? "bg-yellow-500" :
                                          ev.event === "REJECTED" ? "bg-orange-500" :
                                          "bg-gray-400"
                                        }`} />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-primary">{ev.event}</span>
                                            {ev.fromStatus && ev.toStatus && ev.fromStatus !== ev.toStatus && (
                                              <span className="text-[10px] text-primary/40">{ev.fromStatus} &rarr; {ev.toStatus}</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-primary/50">
                                              by {ev.performedBy?.name || ev.performedBy?.role || "system"}
                                              {ev.performedBy?.role && ` (${ev.performedBy.role})`}
                                            </span>
                                            <span className="text-[10px] text-primary/30">
                                              {new Date(ev.timestamp).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", month: "short", day: "numeric" })}
                                            </span>
                                          </div>
                                          {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                                            <div className="mt-1 text-[10px] text-primary/40 bg-white rounded-lg px-2 py-1 inline-block">
                                              {ev.metadata.reason && <span>Reason: {ev.metadata.reason}</span>}
                                              {ev.metadata.matchedCount && <span>Matched {ev.metadata.matchedCount} drivers</span>}
                                              {ev.metadata.responseTimeMs && <span>Response: {fmt(ev.metadata.responseTimeMs)}</span>}
                                              {ev.metadata.taskDurationMs && <span>Duration: {fmt(ev.metadata.taskDurationMs)}</span>}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-primary/40">No audit events recorded.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-primary/10">
                  <p className="text-xs text-primary/50">
                    Page {pagination.page} of {pagination.pages}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-primary/15 hover:bg-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      Prev
                    </button>
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      let pageNum;
                      if (pagination.pages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= pagination.pages - 2) pageNum = pagination.pages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                            currentPage === pageNum ? "bg-accent text-primary font-bold" : "border border-primary/15 hover:bg-primary/5"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                      disabled={currentPage === pagination.pages}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-primary/15 hover:bg-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════ CUSTOMER STATS TAB ═══════ */}
      {activeTab === "customers" && (
        <>
          {/* Customer Summary */}
          {customerTotals.totalCustomers !== undefined && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-primary/10 p-5 text-center">
                <p className="text-3xl font-bold text-primary">{customerTotals.totalCustomers}</p>
                <p className="text-xs text-primary/50 font-medium mt-1">Total Customers</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl border border-primary/10 p-5 text-center">
                <p className="text-3xl font-bold text-emerald-600">{customerTotals.totalPickups}</p>
                <p className="text-xs text-primary/50 font-medium mt-1">Total Pickups</p>
              </div>
              <div className="bg-purple-50 rounded-2xl border border-primary/10 p-5 text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {customerTotals.totalCustomers > 0 ? (customerTotals.totalPickups / customerTotals.totalCustomers).toFixed(1) : 0}
                </p>
                <p className="text-xs text-primary/50 font-medium mt-1">Avg Pickups/Customer</p>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 text-primary"
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-accent rounded-full animate-spin" />
            </div>
          )}

          {!loading && filteredCustomers.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
              <p className="text-4xl mb-3 opacity-40">&#x1F465;</p>
              <h3 className="text-lg font-semibold text-primary/70 mb-1">No Customers Found</h3>
            </div>
          )}

          {!loading && filteredCustomers.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {filteredCustomers.map((c, idx) => (
                <div key={c.customerId} className="bg-white rounded-2xl border border-primary/10 p-5 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? "bg-amber-100 text-amber-700" :
                        idx === 1 ? "bg-gray-200 text-gray-600" :
                        idx === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-primary/5 text-primary/50"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-primary">
                        {c.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">{c.name}</p>
                        <p className="text-xs text-primary/40 truncate">{c.email}</p>
                        {c.phone && <p className="text-xs text-primary/40">{c.phone}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:ml-auto">
                      {[
                        { label: "Total", value: c.totalPickups, color: "text-primary", bg: "bg-primary/4" },
                        { label: "Done", value: c.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
                        { label: "Cancel", value: c.cancelled, color: "text-red-500", bg: "bg-red-50" },
                        { label: "Active", value: c.active, color: "text-blue-600", bg: "bg-blue-50" },
                      ].map((s) => (
                        <div key={s.label} className={`px-3 py-1.5 rounded-xl ${s.bg} text-center min-w-16`}>
                          <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                          <p className="text-[10px] text-primary/50 font-medium uppercase">{s.label}</p>
                        </div>
                      ))}
                      {c.avgResponseMs > 0 && (
                        <div className="px-3 py-1.5 rounded-xl bg-purple-50 text-center min-w-16">
                          <p className="text-lg font-bold text-purple-600">{fmt(c.avgResponseMs)}</p>
                          <p className="text-[10px] text-purple-500/70 font-medium uppercase">Avg Resp</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-primary/5">
                    <div className="flex gap-1.5">
                      {c.categories.recyclable > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                          {c.categories.recyclable} recyclable
                        </span>
                      )}
                      {c.categories["non-recyclable"] > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                          {c.categories["non-recyclable"]} non-recyclable
                        </span>
                      )}
                      {c.categories.both > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                          {c.categories.both} mixed
                        </span>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      {c.totalPickups > 0 && (
                        <span className="text-[10px] text-primary/40">
                          {Math.round((c.completed / c.totalPickups) * 100)}% completion
                        </span>
                      )}
                      {c.lastPickupAt && (
                        <span className="text-[10px] text-primary/40">
                          Last: {new Date(c.lastPickupAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════ DRIVER STATS TAB ═══════ */}
      {activeTab === "drivers" && (
        <>
          {/* Driver Summary */}
          {driverTotals.totalDrivers !== undefined && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-primary/10 p-5 text-center">
                <p className="text-3xl font-bold text-primary">{driverTotals.totalDrivers}</p>
                <p className="text-xs text-primary/50 font-medium mt-1">Total Drivers</p>
              </div>
              <div className="bg-blue-50 rounded-2xl border border-primary/10 p-5 text-center">
                <p className="text-3xl font-bold text-blue-600">{driverTotals.totalPickups}</p>
                <p className="text-xs text-primary/50 font-medium mt-1">Assigned Pickups</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl border border-primary/10 p-5 text-center">
                <p className="text-3xl font-bold text-emerald-600">
                  {driverTotals.totalDrivers > 0 ? (driverTotals.totalPickups / driverTotals.totalDrivers).toFixed(1) : 0}
                </p>
                <p className="text-xs text-primary/50 font-medium mt-1">Avg/Driver</p>
              </div>
              <div className="bg-purple-50 rounded-2xl border border-primary/10 p-5 text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {drivers.length > 0
                    ? `${Math.round(drivers.reduce((s, d) => s + (d.completionRate || 0), 0) / drivers.length)}%`
                    : "0%"}
                </p>
                <p className="text-xs text-primary/50 font-medium mt-1">Avg Completion</p>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 text-primary"
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-accent rounded-full animate-spin" />
            </div>
          )}

          {!loading && filteredDrivers.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
              <p className="text-4xl mb-3 opacity-40">&#x1F69B;</p>
              <h3 className="text-lg font-semibold text-primary/70 mb-1">No Drivers Found</h3>
            </div>
          )}

          {!loading && filteredDrivers.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {filteredDrivers.map((d, idx) => (
                <div
                  key={d.driverId || d.userId}
                  className="bg-white rounded-2xl border border-primary/10 p-5 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/admin-dashboard/drivers/${d.driverId || d.userId}`)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? "bg-amber-100 text-amber-700" :
                        idx === 1 ? "bg-gray-200 text-gray-600" :
                        idx === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-primary/5 text-primary/50"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                        {d.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary truncate">{d.name}</p>
                        <p className="text-xs text-primary/40 truncate">{d.email}</p>
                        {d.phone && <p className="text-xs text-primary/40">{d.phone}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:ml-auto">
                      {[
                        { label: "Total", value: d.totalPickups, color: "text-primary", bg: "bg-primary/4" },
                        { label: "Done", value: d.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
                        { label: "Cancel", value: d.cancelled, color: "text-red-500", bg: "bg-red-50" },
                        { label: "Active", value: d.active, color: "text-blue-600", bg: "bg-blue-50" },
                      ].map((s) => (
                        <div key={s.label} className={`px-3 py-1.5 rounded-xl ${s.bg} text-center min-w-16`}>
                          <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                          <p className="text-[10px] text-primary/50 font-medium uppercase">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Performance metrics + category breakdown */}
                  <div className="mt-3 pt-3 border-t border-primary/5">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Performance badges */}
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50">
                          <span className="text-[10px] text-emerald-600 font-medium">{d.completionRate || 0}% completion</span>
                        </div>
                        {d.avgResponseMs > 0 && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50">
                            <span className="text-[10px] text-purple-600 font-medium">Resp: {fmt(d.avgResponseMs)}</span>
                          </div>
                        )}
                        {d.avgTaskDurationMs > 0 && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50">
                            <span className="text-[10px] text-amber-600 font-medium">Task: {fmt(d.avgTaskDurationMs)}</span>
                          </div>
                        )}
                      </div>

                      {/* Categories */}
                      <div className="flex gap-1.5 ml-auto">
                        {d.categories.recyclable > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                            {d.categories.recyclable} recyclable
                          </span>
                        )}
                        {d.categories["non-recyclable"] > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                            {d.categories["non-recyclable"]} non-rec
                          </span>
                        )}
                        {d.categories.both > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                            {d.categories.both} mixed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Completion progress bar */}
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (d.completionRate || 0) >= 75 ? "bg-emerald-500" :
                            (d.completionRate || 0) >= 50 ? "bg-amber-500" :
                            "bg-red-400"
                          }`}
                          style={{ width: `${d.completionRate || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Last pickup + nav arrow */}
                  <div className="flex items-center justify-between mt-2">
                    {d.lastPickupAt && (
                      <span className="text-[10px] text-primary/40">
                        Last pickup: {new Date(d.lastPickupAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <svg className="w-4 h-4 text-primary/30 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════ SCHEDULE COMPLETIONS TAB ═══════ */}
      {activeTab === "completions" && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50 rounded-2xl border border-primary/10 p-5 text-center">
              <p className="text-3xl font-bold text-emerald-600">{completions.length}</p>
              <p className="text-xs text-primary/50 font-medium mt-1">Total Completions</p>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 p-5 text-center">
              <p className="text-3xl font-bold text-primary">
                {[...new Set(completions.map(c => c.area))].length}
              </p>
              <p className="text-xs text-primary/50 font-medium mt-1">Unique Areas</p>
            </div>
            <div className="bg-blue-50 rounded-2xl border border-primary/10 p-5 text-center">
              <p className="text-3xl font-bold text-blue-600">
                {[...new Set(completions.map(c => c.date))].length}
              </p>
              <p className="text-xs text-primary/50 font-medium mt-1">Days with Completions</p>
            </div>
            <div className="bg-purple-50 rounded-2xl border border-primary/10 p-5 text-center">
              <p className="text-3xl font-bold text-purple-600">
                {completions.reduce((sum, c) => sum + (c.predictedWasteKg || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-primary/50 font-medium mt-1">Total Waste (kg)</p>
            </div>
          </div>

          {/* Loading */}
          {mlLoading && (
            <div className="flex items-center justify-center py-16 bg-white rounded-2xl">
              <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!mlLoading && completions.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
              <p className="text-lg font-semibold text-primary/70 mb-1">No completions yet</p>
              <p className="text-sm text-primary/40">Completed schedule assignments will appear here.</p>
            </div>
          )}

          {/* Completions Table */}
          {!mlLoading && completions.length > 0 && (
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-primary/8 bg-primary/3">
                      <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Date</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Area</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Type</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Waste</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Category</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Driver</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Truck</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Completed At</th>
                      {isSuperAdmin && <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Org</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {completions.map((c, i) => (
                      <tr key={i} className="border-b border-primary/5 hover:bg-primary/2 transition-colors">
                        <td className="px-5 py-3 text-sm text-primary/60">{c.date}</td>
                        <td className="px-5 py-3 font-semibold text-primary text-sm">{c.area}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            { commercial: "bg-blue-100 text-blue-700", residential: "bg-purple-100 text-purple-700", suburban: "bg-teal-100 text-teal-700", rural: "bg-emerald-100 text-emerald-700" }[c.areaType] || "bg-gray-100 text-gray-700"
                          }`}>{c.areaType}</span>
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-primary">{c.predictedWasteKg?.toLocaleString()} kg</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            { none: "bg-gray-100 text-gray-600", low: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700" }[c.wasteCategory] || "bg-gray-100 text-gray-600"
                          }`}>{c.wasteCategory}</span>
                        </td>
                        <td className="px-5 py-3 text-sm text-primary/70">{c.driverName}</td>
                        <td className="px-5 py-3 text-sm text-primary/70">{c.truck?.licensePlate}</td>
                        <td className="px-5 py-3 text-xs text-primary/50">
                          {c.completedAt ? new Date(c.completedAt).toLocaleString("en-US", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                          }) : "--"}
                        </td>
                        {isSuperAdmin && <td className="px-5 py-3 text-xs text-primary/50">{c.orgName || "--"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default History;
