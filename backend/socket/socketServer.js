import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { logger, metrics, reportError } from "../utils/observability.js";

let io = null;

export function driverOrgRoom(orgId) {
    return orgId ? `driver-org:${orgId}` : null;
}

/**
 * Initialise Socket.IO and attach it to the HTTP server.
 * Call once from server.js after creating the http server.
 */
export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.NODE_ENV === "production"
                ? (process.env.FRONTEND_URL || "http://localhost:5173")
                : true,
            credentials: true,
        },
        pingInterval: 25000,
        pingTimeout: 20000,
    });

    // ── JWT authentication middleware ──────────────────────────────────────────
    io.use(async (socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.split(" ")[1];

            if (!token) return next(new Error("Authentication required"));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select("name email role phone orgId");

            if (!user) return next(new Error("User not found"));

            socket.user = user; // attach user to socket for later use
            next();
        } catch (err) {
            metrics.increment("socket_auth_failures_total");
            next(new Error("Invalid or expired token"));
        }
    });

    // ── Connection handler ─────────────────────────────────────────────────────
    io.on("connection", (socket) => {
        const { _id, role, orgId } = socket.user;
        metrics.increment("socket_connections_total", { role, orgId });
        metrics.setGauge("socket_connection_count", io.engine.clientsCount);
        logger.info("Socket connected", {
            userId: _id,
            orgId,
            role,
            socketId: socket.id,
            connectionCount: io.engine.clientsCount,
        });

        // Every customer joins their personal room so the server can target them
        if (role === "customer_admin") {
            socket.join(`customer:${_id}`);
        }

        // Drivers join a personal room and, when scoped, an org room for pickup fanout.
        if (role === "driver") {
            socket.join(`driver:${_id}`);
            const orgDriverRoom = driverOrgRoom(orgId);
            if (orgDriverRoom) {
                socket.join(orgDriverRoom);
            }
        }

        // Add admins to a shared 'admins' room for notifications
        // Also add to org-specific room for scoped notifications
        if (role === "admin" || role === "super_admin") {
            socket.join("admins");
            if (orgId) {
                socket.join(`org:${orgId}`);
            }
            // Super admins join a dedicated room
            if (role === "super_admin") {
                socket.join("super_admins");
            }
        }

        socket.on("disconnect", () => {
            metrics.increment("socket_disconnections_total", { role, orgId });
            metrics.setGauge("socket_connection_count", io.engine.clientsCount);
            logger.info("Socket disconnected", {
                userId: _id,
                orgId,
                role,
                socketId: socket.id,
                connectionCount: io.engine.clientsCount,
            });
            // rooms are cleaned up automatically
        });
    });

    logger.info("Socket.IO initialised");
    return io;
}

/**
 * Returns the Socket.IO server instance.
 * Must be called after initSocket().
 */
export function getIO() {
    if (!io) throw new Error("Socket.IO not initialised — call initSocket() first");
    return io;
}

/**
 * Emit a notification event to admin rooms.
 * Use this when creating system notifications to push real-time updates.
 */
export function emitNotification(notification) {
    if (!io) return;
    try {
        io.to("admins").emit("notification:new", notification);
    } catch (error) {
        reportError(error, { source: "socket", event: "notification:new" });
    }
}

/**
 * Emit updated unread counts to all admins.
 */
export function emitUnreadCounts(counts) {
    if (!io) return;
    try {
        io.to("admins").emit("notification:counts", counts);
    } catch (error) {
        reportError(error, { source: "socket", event: "notification:counts" });
    }
}
