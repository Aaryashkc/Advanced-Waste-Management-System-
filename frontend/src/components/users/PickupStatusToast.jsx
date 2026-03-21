import { useEffect, useState } from "react";
import { getSocket } from "../../utils/socket";

const STATUS_LABELS = {
  EN_ROUTE: { emoji: "🚛", text: "Driver is on the way", color: "bg-blue-600" },
  ARRIVED: { emoji: "📍", text: "Driver has arrived", color: "bg-amber-500" },
  COLLECTING: { emoji: "♻️", text: "Collecting your waste", color: "bg-purple-600" },
  COMPLETED: { emoji: "✅", text: "Collection complete!", color: "bg-green-600" },
};

/**
 * Persistent floating toast for customers.
 * Listens for `pickup:statusUpdate` socket events and shows
 * the current driver status until task completes.
 */
export default function PickupStatusToast() {
  const [status, setStatus] = useState(null);
  const [driverName, setDriverName] = useState(null);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const onStatusUpdate = (data) => {
      setStatus(data.status);
      setDriverName(data.driverInfo?.name || null);
      setVisible(true);
      setExiting(false);

      // Auto-dismiss after COMPLETED
      if (data.status === "COMPLETED") {
        setTimeout(() => {
          setExiting(true);
          setTimeout(() => {
            setVisible(false);
            setStatus(null);
          }, 400);
        }, 5000);
      }
    };

    socket.on("pickup:statusUpdate", onStatusUpdate);
    return () => socket.off("pickup:statusUpdate", onStatusUpdate);
  }, []);

  if (!visible || !status) return null;

  const info = STATUS_LABELS[status] || { emoji: "📋", text: status, color: "bg-gray-600" };

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] max-w-sm transition-all duration-400 ${
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
            onClick={() => {
              setExiting(true);
              setTimeout(() => { setVisible(false); setStatus(null); }, 400);
            }}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar for non-completed */}
        {status !== "COMPLETED" && (
          <div className="h-1 bg-white/20">
            <div
              className="h-full bg-white/60 transition-all duration-500"
              style={{
                width:
                  status === "EN_ROUTE" ? "25%" :
                  status === "ARRIVED" ? "50%" :
                  status === "COLLECTING" ? "75%" : "100%",
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUpToast {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
