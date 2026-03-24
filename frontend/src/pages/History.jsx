import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../stores/useAuthStore";

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

const TABS = [
  { id: "pickups", label: "Pickup History", icon: "🗂" },
  { id: "customers", label: "Customer Stats", icon: "👥" },
  { id: "drivers", label: "Driver Stats", icon: "🚛" },
];

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

  // Search
  const [searchTerm, setSearchTerm] = useState("");

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
        <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
          History
        </h1>
        <p className="text-sm text-primary/60 mt-1">
          {isSuperAdmin
            ? "Complete pickup history across all organizations"
            : "Pickup history for your organization"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-primary/[0.04] rounded-2xl p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSearchTerm("");
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-white text-primary shadow-sm"
                : "text-primary/50 hover:text-primary/70"
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      {activeTab === "pickups" && pickupStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: pickupStats.total, color: "text-primary", bg: "bg-white" },
            { label: "Completed", value: pickupStats.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Active", value: pickupStats.active, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Cancelled", value: pickupStats.cancelled, color: "text-red-500", bg: "bg-red-50" },
            { label: "Expired", value: pickupStats.expired, color: "text-gray-500", bg: "bg-gray-50" },
          ].map((s) => (
            <div
              key={s.label}
              className={`${s.bg} rounded-2xl border border-primary/10 p-4 text-center`}
            >
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-primary/50 font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "customers" && customerTotals.totalCustomers !== undefined && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-primary/10 p-5 text-center">
            <p className="text-3xl font-bold text-primary">{customerTotals.totalCustomers}</p>
            <p className="text-xs text-primary/50 font-medium mt-1">Total Customers</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl border border-primary/10 p-5 text-center">
            <p className="text-3xl font-bold text-emerald-600">{customerTotals.totalPickups}</p>
            <p className="text-xs text-primary/50 font-medium mt-1">Total Pickups</p>
          </div>
        </div>
      )}

      {activeTab === "drivers" && driverTotals.totalDrivers !== undefined && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-primary/10 p-5 text-center">
            <p className="text-3xl font-bold text-primary">{driverTotals.totalDrivers}</p>
            <p className="text-xs text-primary/50 font-medium mt-1">Total Drivers</p>
          </div>
          <div className="bg-blue-50 rounded-2xl border border-primary/10 p-5 text-center">
            <p className="text-3xl font-bold text-blue-600">{driverTotals.totalPickups}</p>
            <p className="text-xs text-primary/50 font-medium mt-1">Assigned Pickups</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {activeTab === "pickups" && (
          <>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2.5 rounded-xl border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 text-primary bg-white"
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="EN_ROUTE">En Route</option>
              <option value="ARRIVED">Arrived</option>
              <option value="COLLECTING">Collecting</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="EXPIRED">Expired</option>
              <option value="PENDING">Pending</option>
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
          </>
        )}
        {(activeTab === "customers" || activeTab === "drivers") && (
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 text-primary"
            />
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {/* ========== PICKUP HISTORY TABLE ========== */}
      {!loading && activeTab === "pickups" && (
        <>
          {pickups.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
              <p className="text-4xl mb-3">📭</p>
              <h3 className="text-lg font-semibold text-primary/70 mb-1">No Pickups Found</h3>
              <p className="text-sm text-primary/50">
                {statusFilter || categoryFilter
                  ? "Try adjusting the filters."
                  : "No pickup history available yet."}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-primary/[0.03] border-b border-primary/10">
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Driver</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Level</th>
                      <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Location</th>
                      {isSuperAdmin && (
                        <th className="px-4 py-3 text-xs font-semibold text-primary/60 uppercase tracking-wider">Org</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {pickups.map((p) => (
                      <tr key={p._id} className="hover:bg-primary/[0.02] transition">
                        <td className="px-4 py-3 text-sm text-primary/70 whitespace-nowrap">
                          {new Date(p.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                          <br />
                          <span className="text-xs text-primary/40">
                            {new Date(p.createdAt).toLocaleTimeString("en-US", {
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-primary">
                              {p.customer?.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-primary">{p.customer?.name || "Unknown"}</p>
                              <p className="text-xs text-primary/40">{p.customer?.phone || ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {p.driver ? (
                            <div>
                              <p className="text-sm font-medium text-primary">{p.driver.name}</p>
                              <p className="text-xs text-primary/40">{p.driver.phone || ""}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-primary/30 italic">No driver</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-primary/70 capitalize">{p.category}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.level === "hard" ? "bg-red-100 text-red-700" :
                            p.level === "medium" ? "bg-amber-100 text-amber-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {p.level}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-primary/70 max-w-[200px] truncate">
                          {p.district ? `${p.district}${p.province ? `, ${p.province}` : ""}` : p.location?.address || "—"}
                        </td>
                        {isSuperAdmin && (
                          <td className="px-4 py-3 text-sm text-primary/60">{p.organization}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-primary/10">
                  <p className="text-xs text-primary/50">
                    Showing {(pagination.page - 1) * 30 + 1}-{Math.min(pagination.page * 30, pagination.total)} of {pagination.total}
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
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                            currentPage === pageNum
                              ? "bg-accent text-primary font-bold"
                              : "border border-primary/15 hover:bg-primary/5"
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

      {/* ========== CUSTOMER STATS TABLE ========== */}
      {!loading && activeTab === "customers" && (
        <>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
              <p className="text-4xl mb-3">👥</p>
              <h3 className="text-lg font-semibold text-primary/70 mb-1">No Customers Found</h3>
              <p className="text-sm text-primary/50">No customer pickup history yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredCustomers.map((c, idx) => (
                <div
                  key={c.customerId}
                  className="bg-white rounded-2xl border border-primary/10 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Rank + Avatar */}
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

                    {/* Stats */}
                    <div className="flex flex-wrap gap-2 sm:ml-auto">
                      <div className="px-3 py-1.5 rounded-xl bg-primary/[0.04] text-center min-w-[70px]">
                        <p className="text-lg font-bold text-primary">{c.totalPickups}</p>
                        <p className="text-[10px] text-primary/50 font-medium uppercase">Total</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-center min-w-[70px]">
                        <p className="text-lg font-bold text-emerald-600">{c.completed}</p>
                        <p className="text-[10px] text-emerald-600/70 font-medium uppercase">Done</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-red-50 text-center min-w-[70px]">
                        <p className="text-lg font-bold text-red-500">{c.cancelled}</p>
                        <p className="text-[10px] text-red-500/70 font-medium uppercase">Cancel</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-blue-50 text-center min-w-[70px]">
                        <p className="text-lg font-bold text-blue-600">{c.active}</p>
                        <p className="text-[10px] text-blue-600/70 font-medium uppercase">Active</p>
                      </div>
                    </div>
                  </div>

                  {/* Category breakdown + last pickup */}
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
                    {c.lastPickupAt && (
                      <span className="text-[10px] text-primary/40 ml-auto">
                        Last pickup: {new Date(c.lastPickupAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ========== DRIVER STATS TABLE ========== */}
      {!loading && activeTab === "drivers" && (
        <>
          {filteredDrivers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
              <p className="text-4xl mb-3">🚛</p>
              <h3 className="text-lg font-semibold text-primary/70 mb-1">No Drivers Found</h3>
              <p className="text-sm text-primary/50">No driver pickup history yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredDrivers.map((d, idx) => (
                <div
                  key={d.driverId}
                  className="bg-white rounded-2xl border border-primary/10 p-5 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/admin-dashboard/drivers/${d.driverId}`)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Rank + Avatar */}
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

                    {/* Stats */}
                    <div className="flex flex-wrap gap-2 sm:ml-auto">
                      <div className="px-3 py-1.5 rounded-xl bg-primary/[0.04] text-center min-w-[70px]">
                        <p className="text-lg font-bold text-primary">{d.totalPickups}</p>
                        <p className="text-[10px] text-primary/50 font-medium uppercase">Total</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-center min-w-[70px]">
                        <p className="text-lg font-bold text-emerald-600">{d.completed}</p>
                        <p className="text-[10px] text-emerald-600/70 font-medium uppercase">Done</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-red-50 text-center min-w-[70px]">
                        <p className="text-lg font-bold text-red-500">{d.cancelled}</p>
                        <p className="text-[10px] text-red-500/70 font-medium uppercase">Cancel</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-blue-50 text-center min-w-[70px]">
                        <p className="text-lg font-bold text-blue-600">{d.active}</p>
                        <p className="text-[10px] text-blue-600/70 font-medium uppercase">Active</p>
                      </div>
                    </div>
                  </div>

                  {/* Category breakdown + completion rate */}
                  <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-primary/5">
                    <div className="flex gap-1.5">
                      {d.categories.recyclable > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                          {d.categories.recyclable} recyclable
                        </span>
                      )}
                      {d.categories["non-recyclable"] > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                          {d.categories["non-recyclable"]} non-recyclable
                        </span>
                      )}
                      {d.categories.both > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                          {d.categories.both} mixed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      {d.totalPickups > 0 && (
                        <span className="text-[10px] text-primary/40">
                          {((d.completed / d.totalPickups) * 100).toFixed(0)}% completion
                        </span>
                      )}
                      {d.lastPickupAt && (
                        <span className="text-[10px] text-primary/40">
                          Last: {new Date(d.lastPickupAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                          })}
                        </span>
                      )}
                      <svg className="w-4 h-4 text-primary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default History;
