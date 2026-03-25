import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useOrganizationStore from "../stores/useOrganizationStore";
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

const TABS = [
  { id: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "trucks", label: "Trucks", icon: "M8 17h8M8 17v-4m8 4v-4m-8 0h8m-8 0H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-3" },
  { id: "drivers", label: "Drivers", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { id: "areas", label: "Areas", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" },
  { id: "admins", label: "Admins", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
];

const StatCard = ({ label, value, color = "var(--primary)", sub }) => (
  <div className="bg-white rounded-2xl border border-primary/10 p-5">
    <p className="text-xs text-primary/50 uppercase tracking-wider font-medium mb-1">{label}</p>
    <p className="text-3xl font-bold" style={{ color }}>{value}</p>
    {sub && <p className="text-xs text-primary/40 mt-1">{sub}</p>}
  </div>
);

const OrgDetail = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { currentOrg, isLoading, fetchOrgDetail, clearCurrentOrg } = useOrganizationStore();
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchOrgDetail(orgId);
    return () => clearCurrentOrg();
  }, [orgId]);

  if (isLoading || !currentOrg) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // Backend sends flat structure: { _id, name, location, admins, trucks, drivers, areas, stats }
  const admins = currentOrg.admins || [];
  const trucks = currentOrg.trucks || [];
  const drivers = currentOrg.drivers || [];
  const areas = currentOrg.areas || [];
  const stats = currentOrg.stats || {};
  const org = { name: currentOrg.name, location: currentOrg.location, _id: currentOrg._id, createdAt: currentOrg.createdAt };

  const trucksWithDrivers = trucks.filter(t => t.assignedDriver);
  const trucksWithoutDrivers = trucks.filter(t => !t.assignedDriver);

  // Chart data
  const resourceDoughnutData = {
    labels: ["Trucks w/ Driver", "Trucks w/o Driver", "Available Drivers"],
    datasets: [{
      data: [trucksWithDrivers.length, trucksWithoutDrivers.length, stats.availableDrivers || 0],
      backgroundColor: ["#10b981", "#ef4444", "#3b82f6"],
      borderWidth: 0,
    }],
  };

  const capacityBarData = {
    labels: trucks.map(t => t.licensePlate || "N/A"),
    datasets: [{
      label: "Capacity (kg)",
      data: trucks.map(t => t.capacity || 0),
      backgroundColor: trucks.map(t => t.assignedDriver ? "#10b981" : "#ef4444"),
      borderRadius: 8,
    }],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, title: { display: true, text: "Truck Capacities", font: { size: 14, weight: "bold" } } },
    scales: { y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } }, x: { grid: { display: false } } },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom", labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 } } },
    cutout: "65%",
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/admin-dashboard/organizations")} className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center hover:bg-primary/10 transition">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">{org?.name}</h1>
          <p className="text-sm text-primary/50">{org?.location?.address || "No address set"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-primary/3 p-1 rounded-xl overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white text-primary shadow-sm"
                : "text-primary/50 hover:text-primary"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="Total Trucks" value={stats.totalTrucks || 0} color="#0ea5e9" />
            <StatCard label="Trucks Ready" value={stats.trucksWithDrivers || 0} color="#10b981" sub="Has assigned driver" />
            <StatCard label="No Driver" value={stats.trucksWithoutDrivers || 0} color="#ef4444" sub="Needs attention" />
            <StatCard label="Total Drivers" value={stats.totalDrivers || 0} color="#8b5cf6" />
            <StatCard label="Areas" value={stats.totalAreas || 0} color="#f59e0b" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Resource Distribution</h3>
              <div className="h-64">
                <Doughnut data={resourceDoughnutData} options={doughnutOptions} />
              </div>
            </div>
            {trucks.length > 0 && (
              <div className="bg-white rounded-2xl border border-primary/10 p-6">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Truck Capacities</h3>
                <div className="h-64">
                  <Bar data={capacityBarData} options={barOptions} />
                </div>
                <p className="text-xs text-primary/40 mt-2 text-center">
                  <span className="inline-block w-3 h-3 rounded bg-green-500 mr-1 align-middle" /> Has driver
                  <span className="inline-block w-3 h-3 rounded bg-red-500 ml-3 mr-1 align-middle" /> No driver
                </p>
              </div>
            )}
          </div>

          {/* Quick Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-primary/10 p-5">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">Admins ({admins.length})</h3>
              {admins.length === 0 ? (
                <p className="text-sm text-primary/40">No admins assigned</p>
              ) : (
                <div className="space-y-2">
                  {admins.map(a => (
                    <div key={a._id} className="flex items-center gap-3 p-2 rounded-lg bg-primary/2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                        {a.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary">{a.name}</p>
                        <p className="text-xs text-primary/40">{a.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 p-5">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">Total Capacity</h3>
              <p className="text-4xl font-bold text-primary">{(stats.totalCapacity || 0).toLocaleString()} <span className="text-base font-medium text-primary/40">kg</span></p>
              <p className="text-xs text-primary/40 mt-1">Combined fleet capacity across {trucks.length} truck{trucks.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "trucks" && (
        <div className="space-y-4">
          {trucks.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-primary/10 text-center text-primary/40">No trucks assigned to this organization.</div>
          ) : (
            <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-primary/3 border-b border-primary/10">
                      <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">License Plate</th>
                      <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Capacity</th>
                      <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Type</th>
                      <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Assigned Driver</th>
                      <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {trucks.map(truck => (
                      <tr key={truck.id} className="hover:bg-primary/2 transition">
                        <td className="px-5 py-4">
                          <span className="font-bold text-primary">{truck.licensePlate}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-primary/70">{truck.capacity} kg</td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-lg bg-primary/5 text-xs font-semibold text-primary/70 capitalize">{truck.truckType || "standard"}</span>
                        </td>
                        <td className="px-5 py-4">
                          {truck.assignedDriver ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700">
                                {truck.assignedDriver.name?.charAt(0)?.toUpperCase() || "D"}
                              </div>
                              <span className="text-sm font-medium text-primary">{truck.assignedDriver.name || "Driver"}</span>
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-red-50 text-xs font-bold text-red-500">No Driver</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${truck.assignedDriver ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {truck.assignedDriver ? "Ready" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "drivers" && (
        <div className="space-y-4">
          {drivers.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-primary/10 text-center text-primary/40">No drivers in this organization.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {drivers.map(driver => (
                <div key={driver.id} className="bg-white rounded-2xl border border-primary/10 p-5 hover:shadow-md transition">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-lg font-bold text-purple-700 shrink-0">
                      {driver.name?.charAt(0)?.toUpperCase() || "D"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-primary truncate">{driver.name || "Unknown"}</h3>
                      <p className="text-xs text-primary/40 truncate">{driver.email}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-primary/50">Phone</span>
                      <span className="font-medium text-primary">{driver.phone || "N/A"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-primary/50">Status</span>
                      <span className={`font-medium ${driver.isAvailable ? "text-green-600" : "text-amber-600"}`}>{driver.isAvailable ? "Available" : "Unavailable"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-primary/50">Assigned Truck</span>
                      {driver.assignedTruck ? (
                        <span className="px-2 py-0.5 rounded-lg bg-green-50 text-xs font-bold text-green-700">{driver.assignedTruck.licensePlate}</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-xs font-bold text-amber-600">Unassigned</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "areas" && (
        <div className="space-y-4">
          {areas.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-primary/10 text-center text-primary/40">No areas assigned to this organization.</div>
          ) : (
            <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-primary/3 border-b border-primary/10">
                      <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Area Name</th>
                      <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Province</th>
                      <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Type</th>
                      <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {areas.map(d => (
                      <tr key={d._id} className="hover:bg-primary/2 transition">
                        <td className="px-5 py-4 font-bold text-primary">{d.name}</td>
                        <td className="px-5 py-4 text-sm text-primary/70">{d.province || "N/A"}</td>
                        <td className="px-5 py-4">
                          <span className="px-2.5 py-1 rounded-lg bg-primary/5 text-xs font-semibold text-primary/70 capitalize">{d.type || "N/A"}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${d.isActive !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {d.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "admins" && (
        <div className="space-y-4">
          {admins.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-primary/10 text-center text-primary/40">No admins in this organization.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {admins.map(admin => (
                <div key={admin._id} className="bg-white rounded-2xl border border-primary/10 p-5 hover:shadow-md transition">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700 shrink-0">
                      {admin.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-primary truncate">{admin.name}</h3>
                      <p className="text-xs text-primary/40 truncate">{admin.email}</p>
                      {admin.phone && <p className="text-xs text-primary/40">{admin.phone}</p>}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-primary/5">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-xs font-bold text-blue-600 uppercase">Admin</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrgDetail;
