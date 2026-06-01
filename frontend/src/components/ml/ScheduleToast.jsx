import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "../../utils/socket";
import useAuthStore from "../../stores/useAuthStore";
import { CheckCircle, Truck, AlertTriangle, MapPin, X } from "lucide-react";

/**
 * Global toast component for ML schedule events.
 * - Drivers: "schedule:confirmed" → your schedule is ready
 * - Drivers: "assignment:completed" → you completed an area
 * - Admins: "schedule:area-completed" → a driver completed an area
 * - Admins: "driverless-trucks-alert" → trucks without drivers
 */
export default function ScheduleToast() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]); // max 3
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const socket = getSocket();
    const role = user.role;

    // === Driver events ===
    if (role === "driver") {
      const onScheduleConfirmed = (data) => {
        addToast({
          type: "dispatch",
          title: "Schedule Dispatched",
          message: data.message || `Your schedule for ${data.dayName || "today"} has been confirmed`,
          action: () => navigate("/driver-ml-assignments"),
          actionLabel: "View Schedule",
        });
      };

      const onAssignmentCompleted = (data) => {
        addToast({
          type: "success",
          title: "Collection Completed",
          message: data.message || `${data.area} marked as completed`,
        });
      };

      socket.on("schedule:confirmed", onScheduleConfirmed);
      socket.on("assignment:completed", onAssignmentCompleted);
      socket.on("schedule:updated", () => {
        // Silently noted — could refresh in background
      });

      return () => {
        socket.off("schedule:confirmed", onScheduleConfirmed);
        socket.off("assignment:completed", onAssignmentCompleted);
        socket.off("schedule:updated");
      };
    }

    // === Admin/Super Admin events ===
    if (role === "admin" || role === "super_admin") {
      const onAreaCompleted = (data) => {
        addToast({
          type: "success",
          title: "Area Completed",
          message: `${data.driverName} completed collection at ${data.area}${data.allCompleted ? " — All done!" : ""}`,
          action: () => navigate("/admin-dashboard/ml-schedule"),
          actionLabel: "View Schedule",
        });
      };

      const onDriverlessAlert = (data) => {
        addToast({
          type: "warning",
          title: "Trucks Without Drivers",
          message: data.message || `${data.trucks?.length || 0} truck(s) have no assigned driver`,
          action: () => navigate("/admin-dashboard/drivers"),
          actionLabel: "Assign Drivers",
        });
      };

      socket.on("schedule:area-completed", onAreaCompleted);
      socket.on("driverless-trucks-alert", onDriverlessAlert);

      return () => {
        socket.off("schedule:area-completed", onAreaCompleted);
        socket.off("driverless-trucks-alert", onDriverlessAlert);
      };
    }
  }, [isAuthenticated, user, addToast, navigate]);

  if (toasts.length === 0) return null;

  const ICONS = {
    dispatch: <Truck size={20} className="text-white shrink-0" />,
    success: <CheckCircle size={20} className="text-white shrink-0" />,
    warning: <AlertTriangle size={20} className="text-white shrink-0" />,
    info: <MapPin size={20} className="text-white shrink-0" />,
  };

  const BG = {
    dispatch: "bg-primary",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    info: "bg-blue-500",
  };

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${BG[toast.type] || BG.info} rounded-2xl shadow-xl overflow-hidden pointer-events-auto`}
          style={{ animation: "slideInRight 0.3s ease-out" }}
        >
          <div className="px-4 py-3.5 flex items-start gap-3">
            {ICONS[toast.type] || ICONS.info}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{toast.title}</p>
              <p className="text-xs text-white/80 mt-0.5 leading-relaxed">{toast.message}</p>
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action();
                    removeToast(toast.id);
                  }}
                  className="mt-2 text-xs font-bold text-white/90 underline underline-offset-2 hover:text-white transition"
                >
                  {toast.actionLabel || "View"}
                </button>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/50 hover:text-white transition shrink-0 mt-0.5"
            >
              <X size={16} />
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-0.5 bg-white/20">
            <div
              className="h-full bg-white/50"
              style={{ animation: "shrinkWidth 6s linear forwards" }}
            />
          </div>
        </div>
      ))}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
