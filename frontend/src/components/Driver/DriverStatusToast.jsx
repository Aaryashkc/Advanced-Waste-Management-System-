import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSocket } from "../../utils/socket";
import useAuthStore from "../../stores/useAuthStore";
import api from "../../utils/api";

export default function DriverStatusToast() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [activePickup, setActivePickup] = useState(null);
  const [loading, setLoading] = useState(true);

  // Don't show toast on the actual task flow pages
  const isTaskPage = location.pathname.includes("/task-route") || location.pathname.includes("/task-flow");

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "driver") return;

    const fetchActiveTask = async () => {
      try {
        setLoading(true);
        const res = await api.get("/pickups/active");
        if (res.data.pickup) {
          setActivePickup(res.data.pickup);
        }
      } catch (err) {
        console.error("Failed to fetch active task", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveTask();
  }, [user, isAuthenticated]);

  useEffect(() => {
    const socket = getSocket();

    const onStatusUpdate = (data) => {
      // If we receive an update for a task that is in progress, track it locally.
      const activeStatuses = ["EN_ROUTE", "ARRIVED", "COLLECTING"];
      if (activeStatuses.includes(data.status)) {
        setActivePickup(data);
      } else if (data.status === "COMPLETED" || data.status === "CANCELLED") {
        setActivePickup(null);
      }
    };

    socket.on("pickup:statusUpdate", onStatusUpdate);
    return () => {
      socket.off("pickup:statusUpdate", onStatusUpdate);
    };
  }, []);

  if (!isAuthenticated || user?.role !== "driver") return null;
  if (isTaskPage || !activePickup) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div 
        onClick={() => navigate(`/task-route/${activePickup.id}`)} // Or task flow depending on status
        className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-2 border-primary overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform"
      >
        <div className="px-4 py-3 bg-[var(--accent)]/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
            </span>
            <span className="text-xs font-bold tracking-wide text-primary">
              ACTIVE TASK IN PROGRESS
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold text-primary/60">
            {activePickup.status.replace("_", " ")}
          </span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">
              Click to resume task flow
            </p>
            <p className="text-xs text-primary/60 mt-0.5">
              Pickup ID: {activePickup.id?.toString().slice(-6).toUpperCase()}
            </p>
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
