import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../utils/api";
import { getSocket } from "../utils/socket";
import useAuthStore from "../stores/useAuthStore";

const EMPTY_COUNTS = {
  alerts: 0,
  clients: 0,
  org_admin: 0,
  driver: 0,
  deletions: 0,
};

function normalizeCount(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function appliesToCurrentAdmin(notification, user) {
  if (!notification || !user) return true;
  if (Array.isArray(notification.targetRoles) && !notification.targetRoles.includes(user.role)) {
    return false;
  }
  if (user.role === "admin" && notification.orgId) {
    const notificationOrg = String(notification.orgId?._id || notification.orgId);
    const userOrg = String(user.orgId?._id || user.orgId || "");
    return notificationOrg === userOrg;
  }
  return true;
}

export function useAdminNotificationCounts() {
  const { user, token } = useAuthStore();
  const [counts, setCounts] = useState(EMPTY_COUNTS);

  const totalUnread = useMemo(
    () => Object.values(counts).reduce((sum, count) => sum + normalizeCount(count), 0),
    [counts]
  );

  const fetchCounts = useCallback(async () => {
    if (!token || !user) return;

    try {
      const deletionCountUrl =
        user.role === "super_admin"
          ? "/super-admin/deletion-requests/pending-count"
          : "/org-admin/deletion-requests/pending-count";

      const [alertsRes, clientsRes, orgAdminRes, driverRes, deletionsRes] = await Promise.all([
        api.get("/notifications/unread-count"),
        api.get("/contact/unread-count"),
        api.get("/internal-messages/org_admin/unread-count"),
        api.get("/internal-messages/driver/unread-count"),
        api.get(deletionCountUrl),
      ]);

      setCounts({
        alerts: normalizeCount(alertsRes.data.count),
        clients: normalizeCount(clientsRes.data.count),
        org_admin: normalizeCount(orgAdminRes.data.count),
        driver: normalizeCount(driverRes.data.count),
        deletions: normalizeCount(deletionsRes.data.count),
      });
    } catch (err) {
      console.error("Failed to fetch notification counts:", err);
    }
  }, [token, user]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    if (!token || !user) return;

    const socket = getSocket();

    const increment = (key) => {
      setCounts((prev) => ({ ...prev, [key]: normalizeCount(prev[key]) + 1 }));
    };

    const onSystemNotification = (notification) => {
      if (appliesToCurrentAdmin(notification, user)) increment("alerts");
    };

    const onContactMessage = () => increment("clients");
    const onContactCount = (count) => {
      setCounts((prev) => ({ ...prev, clients: normalizeCount(count) }));
    };

    const onInternalMessage = (message) => {
      if (message?.type === "org_admin" || message?.type === "driver") {
        increment(message.type);
      } else {
        fetchCounts();
      }
    };

    const onInternalCounts = (nextCounts) => {
      setCounts((prev) => ({
        ...prev,
        ...(typeof nextCounts?.org_admin === "number" ? { org_admin: nextCounts.org_admin } : {}),
        ...(typeof nextCounts?.driver === "number" ? { driver: nextCounts.driver } : {}),
      }));
    };

    const onNotificationCounts = (nextCounts) => {
      if (!nextCounts || typeof nextCounts !== "object") {
        fetchCounts();
        return;
      }

      setCounts((prev) => ({
        ...prev,
        ...(typeof nextCounts.alerts === "number" ? { alerts: nextCounts.alerts } : {}),
        ...(typeof nextCounts.notifications === "number" ? { alerts: nextCounts.notifications } : {}),
        ...(typeof nextCounts.clients === "number" ? { clients: nextCounts.clients } : {}),
        ...(typeof nextCounts.org_admin === "number" ? { org_admin: nextCounts.org_admin } : {}),
        ...(typeof nextCounts.driver === "number" ? { driver: nextCounts.driver } : {}),
        ...(typeof nextCounts.deletions === "number" ? { deletions: nextCounts.deletions } : {}),
      }));
    };

    const onDeletionRequest = () => increment("deletions");
    const onDeletionCounts = (nextCounts) => {
      if (typeof nextCounts?.deletions === "number") {
        setCounts((prev) => ({ ...prev, deletions: nextCounts.deletions }));
      } else {
        fetchCounts();
      }
    };

    socket.on("notification:new", onSystemNotification);
    socket.on("notification:counts", onNotificationCounts);
    socket.on("new_contact_message", onContactMessage);
    socket.on("update_unread_count", onContactCount);
    socket.on("internal-message:new", onInternalMessage);
    socket.on("internal-message:counts", onInternalCounts);
    socket.on("deletion-request:new", onDeletionRequest);
    socket.on("deletion-request:counts", onDeletionCounts);
    socket.on("connect", fetchCounts);

    return () => {
      socket.off("notification:new", onSystemNotification);
      socket.off("notification:counts", onNotificationCounts);
      socket.off("new_contact_message", onContactMessage);
      socket.off("update_unread_count", onContactCount);
      socket.off("internal-message:new", onInternalMessage);
      socket.off("internal-message:counts", onInternalCounts);
      socket.off("deletion-request:new", onDeletionRequest);
      socket.off("deletion-request:counts", onDeletionCounts);
      socket.off("connect", fetchCounts);
    };
  }, [fetchCounts, token, user]);

  return { counts, totalUnread, refreshCounts: fetchCounts };
}
