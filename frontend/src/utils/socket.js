/**
 * Singleton Socket.IO client.
 * Usage:
 *   import { getSocket, disconnectSocket } from '../utils/socket';
 *   const socket = getSocket();
 *   socket.on('pickup:accepted', handler);
 */
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL.replace("/api", "")
    : "http://localhost:5001";

let socket = null;

/** Lazily creates and returns the socket singleton. */
export function getSocket() {
    if (socket && socket.connected) return socket;

    // Read JWT from the persisted Zustand auth store
    let token = null;
    try {
        const raw = localStorage.getItem("auth-storage");
        if (raw) token = JSON.parse(raw)?.state?.token;
    } catch (_) { }

    if (!token) {
        console.warn("[socket] No auth token — socket will not authenticate");
    }

    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        autoConnect: true,
    });

    socket.on("connect", () => {
        console.log("[socket] Connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
        console.error("[socket] Connection error:", err.message);
    });

    socket.on("disconnect", (reason) => {
        console.log("[socket] Disconnected:", reason);
    });

    return socket;
}

/** Cleanly closes the socket (call on logout). */
export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
