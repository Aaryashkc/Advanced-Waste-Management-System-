import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSocket } from "../../utils/socket";
import useAuthStore from "../../stores/useAuthStore";
import api from "../../utils/api";
import { isAbortError } from "../../utils/requests";

const STATUS_DISPLAY = {
  EN_ROUTE: { label: "En Route", color: "bg-blue-500" },
  ARRIVED: { label: "Arrived", color: "bg-amber-500" },
  COLLECTING: { label: "Collecting", color: "bg-purple-500" },
};

export default function DriverStatusToast() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [activePickup, setActivePickup] = useState(null);
  const [loading, setLoading] = useState(true);

  // Don't show toast on the actual task flow pages
  const isTaskPage = location.pathname.includes("/task-route") || location.pathname.includes("/task-flow");

  // Fetch active task on mount and when location changes
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "driver") return;

    const controller = new AbortController();
    const fetchActiveTask = async () => {
      try {
        setLoading(true);
        const res = await api.get("/pickups/active", { signal: controller.signal });
        if (res.data.pickup) {
          setActivePickup(res.data.pickup);
        } else {
          setActivePickup(null);
        }
      } catch (err) {
        if (isAbortError(err)) return;
        // 404 means no active pickup
        if (err.response?.status !== 404) {
          console.error("Failed to fetch active task", err);
        }
        setActivePickup(null);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveTask();
    return () => controller.abort();
  }, [user, isAuthenticated, location.pathname]);

  // Listen for real-time status updates
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "driver") return;

    const socket = getSocket();

    const onStatusUpdate = (data) => {
      const activeStatuses = ["EN_ROUTE", "ARRIVED", "COLLECTING"];
      if (activeStatuses.includes(data.status)) {
        setActivePickup(prev => ({
          ...(prev || {}),
          ...data,
          id: data.id || data.pickupId || data._id || prev?.id,
          status: data.status,
        }));
      } else if (data.status === "COMPLETED" || data.status === "CANCELLED") {
        setActivePickup(null);
      }
    };

    // Also listen for new accepted pickups (driver accepted)
    const onAccepted = (data) => {
      if (data.driverId === user?._id || data.driverInfo?.id === user?._id) {
        setActivePickup(data);
      }
    };

    socket.on("pickup:statusUpdate", onStatusUpdate);
    socket.on("pickup:accepted", onAccepted);

    return () => {
      socket.off("pickup:statusUpdate", onStatusUpdate);
      socket.off("pickup:accepted", onAccepted);
    };
  }, [isAuthenticated, user]);

  if (!isAuthenticated || user?.role !== "driver") return null;
  if (isTaskPage || !activePickup || loading) return null;

  const statusInfo = STATUS_DISPLAY[activePickup.status] || { label: activePickup.status?.replace("_", " "), color: "bg-primary" };
  const pickupIdDisplay = (activePickup.id || activePickup._id)?.toString().slice(-6).toUpperCase();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div
        onClick={() => navigate(`/task-route/${activePickup.id || activePickup._id}`)}
        className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-2 border-primary overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform"
        style={{ animation: "slideUpToast 0.4s ease-out" }}
      >
        <div className="px-4 py-3 bg-accent/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
            </span>
            <span className="text-xs font-bold tracking-wide text-primary">
              ACTIVE TASK IN PROGRESS
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">
              Click to resume task flow
            </p>
            {pickupIdDisplay && (
              <p className="text-xs text-primary/60 mt-0.5">
                Pickup ID: {pickupIdDisplay}
              </p>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
