import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const PickupStats = () => {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/super-admin/pickup-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error("Failed to fetch pickup stats:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[var(--primary)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-12 text-center text-[var(--primary)]/40">Failed to load pickup stats.</div>;
  }

  const statusDoughnut = {
    labels: ["Completed", "Active", "Cancelled", "Expired"],
    datasets: [{
      data: [data.completedPickups, data.activePickups, data.cancelledPickups, data.expiredPickups],
      backgroundColor: ["#10b981", "#3b82f6", "#ef4444", "#9ca3af"],
      borderWidth: 0,
    }],
  };

  const topDrivers = data.driverStats.slice(0, 10);
  const driverBarData = {
    labels: topDrivers.map(d => d.driverName),
    datasets: [{
      label: "Completed Pickups",
      data: topDrivers.map(d => d.count),
      backgroundColor: "#10b981",
      borderRadius: 8,
    }],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--primary)] tracking-tight">Pickup Statistics</h1>
        <p className="text-sm text-[var(--primary)]/60 mt-1">Overview of all special pickups completed by drivers</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 text-center">
          <p className="text-3xl font-bold text-[var(--primary)]">{data.totalPickups}</p>
          <p className="text-xs text-[var(--primary)]/50 font-medium mt-1 uppercase tracking-wider">Total</p>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{data.completedPickups}</p>
          <p className="text-xs text-[var(--primary)]/50 font-medium mt-1 uppercase tracking-wider">Completed</p>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 text-center">
          <p className="text-3xl font-bold text-blue-600">{data.activePickups}</p>
          <p className="text-xs text-[var(--primary)]/50 font-medium mt-1 uppercase tracking-wider">Active</p>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 text-center">
          <p className="text-3xl font-bold text-red-500">{data.cancelledPickups}</p>
          <p className="text-xs text-[var(--primary)]/50 font-medium mt-1 uppercase tracking-wider">Cancelled</p>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 text-center">
          <p className="text-3xl font-bold text-gray-400">{data.expiredPickups}</p>
          <p className="text-xs text-[var(--primary)]/50 font-medium mt-1 uppercase tracking-wider">Expired</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-6">
          <h3 className="text-sm font-bold text-[var(--primary)] uppercase tracking-wider mb-4">Pickup Status Distribution</h3>
          <div className="h-64">
            <Doughnut data={statusDoughnut} options={{ responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { position: "bottom", labels: { padding: 16, usePointStyle: true } } } }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-6">
          <h3 className="text-sm font-bold text-[var(--primary)] uppercase tracking-wider mb-4">Top Drivers by Completed Pickups</h3>
          <div className="h-64">
            <Bar data={driverBarData} options={{ responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } }, y: { grid: { display: false } } } }} />
          </div>
        </div>
      </div>

      {/* Driver Leaderboard */}
      <div className="bg-white rounded-2xl border border-[var(--primary)]/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--primary)]/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--primary)] uppercase tracking-wider">Driver Pickup Leaderboard</h3>
          <span className="text-xs text-[var(--primary)]/40">{data.driverStats.length} drivers</span>
        </div>
        {data.driverStats.length === 0 ? (
          <div className="p-12 text-center text-[var(--primary)]/40">No completed pickups yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[var(--primary)]/[0.03]">
                  <th className="px-5 py-3 text-xs font-bold text-[var(--primary)]/60 uppercase tracking-wider">#</th>
                  <th className="px-5 py-3 text-xs font-bold text-[var(--primary)]/60 uppercase tracking-wider">Driver</th>
                  <th className="px-5 py-3 text-xs font-bold text-[var(--primary)]/60 uppercase tracking-wider">Total Completed</th>
                  <th className="px-5 py-3 text-xs font-bold text-[var(--primary)]/60 uppercase tracking-wider">Recyclable</th>
                  <th className="px-5 py-3 text-xs font-bold text-[var(--primary)]/60 uppercase tracking-wider">Non-Recyclable</th>
                  <th className="px-5 py-3 text-xs font-bold text-[var(--primary)]/60 uppercase tracking-wider">Mixed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--primary)]/5">
                {data.driverStats.map((d, i) => (
                  <tr key={d.driverId} className="hover:bg-[var(--primary)]/[0.02] transition">
                    <td className="px-5 py-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "bg-yellow-100 text-yellow-700" :
                        i === 1 ? "bg-gray-200 text-gray-700" :
                        i === 2 ? "bg-amber-100 text-amber-700" :
                        "bg-[var(--primary)]/5 text-[var(--primary)]/50"
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)]/30 flex items-center justify-center text-xs font-bold text-[var(--primary)]">
                          {d.driverName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="font-semibold text-[var(--primary)]">{d.driverName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-lg font-bold text-green-600">{d.count}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--primary)]/70">{d.categories?.recyclable || 0}</td>
                    <td className="px-5 py-3 text-sm text-[var(--primary)]/70">{d.categories?.["non-recyclable"] || 0}</td>
                    <td className="px-5 py-3 text-sm text-[var(--primary)]/70">{d.categories?.both || 0}</td>
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

export default PickupStats;
