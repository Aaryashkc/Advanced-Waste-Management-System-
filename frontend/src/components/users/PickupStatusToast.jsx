import { useEffect, useState, useRef } from "react";
import { getSocket } from "../../utils/socket";

const STATUS_LABELS = {
  ACCEPTED: { emoji: "✅", text: "Your pickup has been accepted!", color: "bg-green-600" },
  EN_ROUTE: { emoji: "🚛", text: "Driver is on the way", color: "bg-blue-600" },
  ARRIVED: { emoji: "📍", text: "Driver has arrived", color: "bg-amber-500" },
  COLLECTING: { emoji: "♻️", text: "Collecting your waste", color: "bg-purple-600" },
  COMPLETED: { emoji: "🎉", text: "Collection complete!", color: "bg-green-600" },
};

const PROGRESS = {
  ACCEPTED: 10,
  EN_ROUTE: 30,
  ARRIVED: 55,
  COLLECTING: 80,
  COMPLETED: 100,
};

/**
 * Persistent floating toast for customers.
 * Listens for `pickup:accepted` and `pickup:statusUpdate` socket events
 * and shows the current driver status until task completes.
 */
export default function PickupStatusToast() {
  const [status, setStatus] = useState(null);
  const [driverName, setDriverName] = useState(null);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const dismissTimerRef = useRef(null);

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setStatus(null);
      setDriverName(null);
    }, 400);
  };

  const showToast = (newStatus, driver) => {
    // Clear any pending auto-dismiss
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    setStatus(newStatus);
    if (driver) setDriverName(driver);
    setVisible(true);
    setExiting(false);

    // Auto-dismiss after COMPLETED
    if (newStatus === "COMPLETED") {
      dismissTimerRef.current = setTimeout(dismiss, 6000);
    }
  };

  useEffect(() => {
    const socket = getSocket();

    // When the customer's pickup is accepted by a driver
    const onAccepted = (data) => {
      showToast("ACCEPTED", data.driverName || data.driverInfo?.name || null);
    };

    // When the driver updates their status during the pickup
    const onStatusUpdate = (data) => {
      showToast(data.status, data.driverInfo?.name || null);
    };

    socket.on("pickup:accepted", onAccepted);
    socket.on("pickup:statusUpdate", onStatusUpdate);

    return () => {
      socket.off("pickup:accepted", onAccepted);
      socket.off("pickup:statusUpdate", onStatusUpdate);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  if (!visible || !status) return null;

  const info = STATUS_LABELS[status] || { emoji: "📋", text: status, color: "bg-gray-600" };
  const progress = PROGRESS[status] || 0;

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] max-w-sm w-full transition-all duration-400 ${
        exiting ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
      }`}
      style={{ animation: exiting ? "none" : "slideUpToast 0.4s ease-out" }}
    >
      <div className={`${info.color} text-white rounded-2xl shadow-2xl overflow-hidden`}>
        {/* Main content */}
        <div className="px-5 py-4 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">{info.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight">{info.text}</p>
            {driverName && (
              <p className="text-xs text-white/80 mt-0.5">Driver: {driverName}</p>
            )}
          </div>
          <button
            onClick={dismiss}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        {status !== "COMPLETED" && (
          <div className="h-1.5 bg-white/20">
            <div
              className="h-full bg-white/60 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
