import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAuthStore from "../stores/useAuthStore";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const STATUS_COLORS = {
  COMPLETED: "bg-green-100 text-green-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  EN_ROUTE: "bg-indigo-100 text-indigo-700",
  ARRIVED: "bg-purple-100 text-purple-700",
  COLLECTING: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  PENDING: "bg-yellow-100 text-yellow-700",
};

const DriverDetail = () => {
  const { driverId } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const baseUrl = user?.role === "super_admin"
          ? `${API_URL}/super-admin/drivers/${driverId}/detail`
          : `${API_URL}/org-admin/drivers/${driverId}/detail`;
        const res = await fetch(baseUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error("Failed to fetch driver detail:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [driverId, token, user?.role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-12 text-center text-primary/40">Driver not found.</div>;
  }

  const { driver, stats, recentPickups } = data;

  const categoryData = {
    labels: ["Recyclable", "Non-Recyclable", "Mixed"],
    datasets: [{
      data: [stats.byCategory.recyclable, stats.byCategory.nonRecyclable, stats.byCategory.mixed],
      backgroundColor: ["#10b981", "#ef4444", "#8b5cf6"],
      borderWidth: 0,
    }],
  };

  const levelData = {
    labels: ["Easy (L1)", "Medium (L2)", "Hard (L3)"],
    datasets: [{
      label: "Pickups",
      data: [stats.byLevel.easy, stats.byLevel.medium, stats.byLevel.hard],
      backgroundColor: ["#3b82f6", "#f59e0b", "#ef4444"],
      borderRadius: 8,
    }],
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/admin-dashboard/drivers")} className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center hover:bg-primary/10 transition">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">{driver.name}</h1>
          <p className="text-sm text-primary/50">{driver.email} &middot; {driver.phone || "No phone"}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${driver.isAvailable ? "bg-green-50 border border-green-200 text-green-700" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
          <span className={`w-2 h-2 rounded-full ${driver.isAvailable ? "bg-green-500" : "bg-amber-500"}`} />
          {driver.isAvailable ? "Available" : "Busy"}
        </div>
      </div>

      {/* Info Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-primary/10 p-5">
          <p className="text-xs text-primary/50 uppercase tracking-wider font-medium mb-1">Organization</p>
          <p className="text-lg font-bold text-primary">{driver.organization?.name || "N/A"}</p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-5">
          <p className="text-xs text-primary/50 uppercase tracking-wider font-medium mb-1">Assigned Truck</p>
          {driver.truck ? (
            <div>
              <p className="text-lg font-bold text-primary">{driver.truck.licensePlate}</p>
              <p className="text-xs text-primary/40">{driver.truck.capacity} kg &middot; {driver.truck.dutyType}</p>
            </div>
          ) : (
            <p className="text-lg font-bold text-red-500">No Truck</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-5">
          <p className="text-xs text-primary/50 uppercase tracking-wider font-medium mb-1">Total Pickups</p>
          <p className="text-3xl font-bold text-primary">{stats.totalPickups}</p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-5">
          <p className="text-xs text-primary/50 uppercase tracking-wider font-medium mb-1">Completed</p>
          <p className="text-3xl font-bold text-green-600">{stats.completedPickups}</p>
          <p className="text-xs text-primary/40 mt-1">
            {stats.totalPickups > 0 ? `${((stats.completedPickups / stats.totalPickups) * 100).toFixed(0)}% completion rate` : "No pickups yet"}
          </p>
        </div>
      </div>

      {/* Active Pickup Alert */}
      {stats.activePickup && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
            </span>
            <p className="font-bold text-amber-800">Active Pickup in Progress</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[stats.activePickup.status]}`}>{stats.activePickup.status}</span>
          </div>
          <p className="text-sm text-amber-700 mt-2">
            {stats.activePickup.location?.address || `${stats.activePickup.location?.latitude?.toFixed(4)}, ${stats.activePickup.location?.longitude?.toFixed(4)}`}
            {" "}&middot; {stats.activePickup.category}
          </p>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-primary/10 p-6">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Pickups by Category</h3>
          <div className="h-56">
            <Doughnut data={categoryData} options={{ responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { position: "bottom", labels: { padding: 16, usePointStyle: true } } } }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-6">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Pickups by Difficulty</h3>
          <div className="h-56">
            <Bar data={levelData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } }, x: { grid: { display: false } } } }} />
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-primary/10 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.byCategory.recyclable}</p>
          <p className="text-xs text-primary/50 font-medium mt-1">Recyclable</p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{stats.byCategory.nonRecyclable}</p>
          <p className="text-xs text-primary/50 font-medium mt-1">Non-Recyclable</p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.byCategory.mixed}</p>
          <p className="text-xs text-primary/50 font-medium mt-1">Mixed</p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.cancelledPickups}</p>
          <p className="text-xs text-primary/50 font-medium mt-1">Cancelled</p>
        </div>
      </div>

      {/* Recent Pickups Table */}
      <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-primary/10">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Recent Pickups</h3>
        </div>
        {recentPickups.length === 0 ? (
          <div className="p-12 text-center text-primary/40">No pickups yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-primary/3">
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Level</th>
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {recentPickups.map((p) => (
                  <tr key={p.id} className="hover:bg-primary/2 transition">
                    <td className="px-5 py-3 text-sm text-primary/70">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}>{p.status}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-primary/70 capitalize">{p.category}</td>
                    <td className="px-5 py-3 text-sm text-primary/70 capitalize">{p.level}</td>
                    <td className="px-5 py-3 text-sm text-primary/70">
                      {p.area || p.location?.address || `${p.location?.latitude?.toFixed(3)}, ${p.location?.longitude?.toFixed(3)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverDetail;
