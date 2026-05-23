import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, ClipboardCheck, Calendar, Bell, User } from "lucide-react";
import { getSocket } from "../../utils/socket";
import useAuthStore from "../../stores/useAuthStore";
import useMLScheduleStore from "../../stores/useMLScheduleStore";
import api from "../../utils/api";
import { isAbortError } from "../../utils/requests";

const NAV_ITEMS = [
  { to: "/driver-dashboard", label: "Home", Icon: Home },
  { to: "/accept-task", label: "Requests", Icon: ClipboardCheck },
  { to: "/driver-ml-assignments", label: "Schedule", Icon: Calendar },
  { to: "/driver-notifications", label: "Alerts", Icon: Bell },
  { to: "/profile", label: "Profile", Icon: User },
];

async function fetchUnreadCount(signal) {
  const res = await api.get("/notifications/unread-count", { signal });
  return res.data.count || 0;
}

export default function DriverNavbar() {
  const { token } = useAuthStore();
  const { driverAssignments } = useMLScheduleStore();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const isTaskPage = location.pathname.includes("/task-route") || location.pathname.includes("/task-flow");

  useEffect(() => {
    if (!token) return undefined;

    const controller = new AbortController();
    fetchUnreadCount(controller.signal)
      .then(setUnreadCount)
      .catch((error) => {
        if (!isAbortError(error)) console.error("Failed to fetch unread notifications:", error);
      });

    const socket = getSocket();
    const onNew = () => setUnreadCount((prev) => prev + 1);
    const onCounts = (data) => {
      if (typeof data?.notifications === "number") setUnreadCount(data.notifications);
      else {
        fetchUnreadCount()
          .then(setUnreadCount)
          .catch((error) => {
            if (!isAbortError(error)) console.error("Failed to fetch unread notifications:", error);
          });
      }
    };
    const onSchedule = () => {
      fetchUnreadCount()
        .then(setUnreadCount)
        .catch((error) => {
          if (!isAbortError(error)) console.error("Failed to fetch unread notifications:", error);
        });
    };

    socket.on("notification:new", onNew);
    socket.on("notification:counts", onCounts);
    socket.on("schedule:confirmed", onSchedule);

    return () => {
      controller.abort();
      socket.off("notification:new", onNew);
      socket.off("notification:counts", onCounts);
      socket.off("schedule:confirmed", onSchedule);
    };
  }, [token]);

  if (isTaskPage) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-primary/8 safe-area-bottom shadow-[0_-2px_20px_rgba(0,0,0,0.06)]">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to === "/driver-dashboard" && location.pathname === "/driver-dashboard");

          const scheduleCount = item.label === "Schedule" ? driverAssignments.length : 0;
          const alertCount = item.label === "Alerts" ? unreadCount : 0;
          const badgeCount = scheduleCount || alertCount;
          const badgeColor = item.label === "Schedule" ? "bg-blue-500" : "bg-red-500";

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="relative flex flex-col items-center justify-center py-2 px-3 min-w-[56px] group"
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-[#354f52]" />
              )}

              {/* Icon */}
              <span className={`transition-all duration-200 ${
                isActive
                  ? "text-[#354f52] scale-110"
                  : "text-primary/35 group-hover:text-primary/55"
              }`}>
                <item.Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              </span>

              {/* Badge */}
              {badgeCount > 0 && (
                <span className={`absolute top-0.5 right-0.5 min-w-[18px] h-[18px] rounded-full ${badgeColor} flex items-center justify-center text-white text-[9px] font-bold px-1 ring-2 ring-white`}>
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}

              {/* Label */}
              <span className={`text-[10px] mt-1 font-semibold tracking-wide transition-colors duration-200 ${
                isActive ? "text-[#354f52]" : "text-primary/35 group-hover:text-primary/55"
              }`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>

      <style>{`
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}</style>
    </nav>
  );
}
