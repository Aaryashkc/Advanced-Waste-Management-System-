import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../stores/useAuthStore";
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
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

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
        <div className="w-10 h-10 border-4 border-primary/20 border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-12 text-center text-primary/40">Failed to load pickup stats.</div>;
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
        <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">Pickup Statistics</h1>
        <p className="text-sm text-primary/60 mt-1">Overview of all special pickups completed by drivers</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl border border-primary/10 p-5 text-center">
          <p className="text-3xl font-bold text-primary">{data.totalPickups}</p>
          <p className="text-xs text-primary/50 font-medium mt-1 uppercase tracking-wider">Total</p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{data.completedPickups}</p>
          <p className="text-xs text-primary/50 font-medium mt-1 uppercase tracking-wider">Completed</p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-5 text-center">
          <p className="text-3xl font-bold text-blue-600">{data.activePickups}</p>
          <p className="text-xs text-primary/50 font-medium mt-1 uppercase tracking-wider">Active</p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-5 text-center">
          <p className="text-3xl font-bold text-red-500">{data.cancelledPickups}</p>
          <p className="text-xs text-primary/50 font-medium mt-1 uppercase tracking-wider">Cancelled</p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-5 text-center">
          <p className="text-3xl font-bold text-gray-400">{data.expiredPickups}</p>
          <p className="text-xs text-primary/50 font-medium mt-1 uppercase tracking-wider">Expired</p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-5 text-center">
          <p className="text-3xl font-bold text-emerald-600">{data.completionRate || 0}%</p>
          <p className="text-xs text-primary/50 font-medium mt-1 uppercase tracking-wider">Success Rate</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-primary/10 p-6">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Pickup Status Distribution</h3>
          <div className="h-64">
            <Doughnut data={statusDoughnut} options={{ responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { position: "bottom", labels: { padding: 16, usePointStyle: true } } } }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-6">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Top Drivers by Completed Pickups</h3>
          <div className="h-64">
            <Bar data={driverBarData} options={{ responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } }, y: { grid: { display: false } } } }} />
          </div>
        </div>
      </div>

      {/* Daily Trend + Category Breakdown */}
      {(data.dailyTrend?.length > 0 || data.categoryDistribution?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.dailyTrend?.length > 0 && (
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Daily Pickup Trend (14 Days)</h3>
              <div className="h-64">
                <Line
                  data={{
                    labels: data.dailyTrend.map(d => d.date?.slice(5)),
                    datasets: [
                      {
                        label: "Total",
                        data: data.dailyTrend.map(d => d.total),
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(59,130,246,0.08)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                      },
                      {
                        label: "Completed",
                        data: data.dailyTrend.map(d => d.completed),
                        borderColor: "#10b981",
                        backgroundColor: "rgba(16,185,129,0.08)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 12 } } },
                    scales: {
                      x: { grid: { display: false } },
                      y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
                    },
                  }}
                />
              </div>
            </div>
          )}
          {data.categoryDistribution?.length > 0 && (
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Category Breakdown</h3>
              <div className="h-64">
                <Doughnut
                  data={{
                    labels: data.categoryDistribution.map(c => c.category || "Unknown"),
                    datasets: [{
                      data: data.categoryDistribution.map(c => c.count),
                      backgroundColor: ["#10b981", "#ef4444", "#8b5cf6"],
                      borderWidth: 0,
                    }],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "bottom", labels: { padding: 16, usePointStyle: true } } } }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Driver Leaderboard */}
      <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-primary/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Driver Pickup Leaderboard</h3>
          <span className="text-xs text-primary/40">{data.driverStats.length} drivers</span>
        </div>
        {data.driverStats.length === 0 ? (
          <div className="p-12 text-center text-primary/40">No completed pickups yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-primary/[0.03]">
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">#</th>
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Driver</th>
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Completed</th>
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Recyclable</th>
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Non-Recyclable</th>
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Mixed</th>
                  <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Avg Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {data.driverStats.map((d, i) => (
                  <tr key={d.driverId} className="hover:bg-primary/[0.02] transition">
                    <td className="px-5 py-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "bg-yellow-100 text-yellow-700" :
                        i === 1 ? "bg-gray-200 text-gray-700" :
                        i === 2 ? "bg-amber-100 text-amber-700" :
                        "bg-primary/5 text-primary/50"
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)]/30 flex items-center justify-center text-xs font-bold text-primary">
                          {d.driverName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="font-semibold text-primary">{d.driverName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-lg font-bold text-green-600">{d.count}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-primary/70">{d.categories?.recyclable || 0}</td>
                    <td className="px-5 py-3 text-sm text-primary/70">{d.categories?.["non-recyclable"] || 0}</td>
                    <td className="px-5 py-3 text-sm text-primary/70">{d.categories?.both || 0}</td>
                    <td className="px-5 py-3 text-sm text-primary/70">
                      {d.avgResponseMs ? `${Math.round(d.avgResponseMs / 1000)}s` : "--"}
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

export default PickupStats;
