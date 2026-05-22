/**
 * Singleton Socket.IO client with robust reconnection.
 * Usage:
 *   import { getSocket, disconnectSocket } from '../utils/socket';
 *   const socket = getSocket();
 *   socket.on('pickup:accepted', handler);
 */
import { io } from "socket.io-client";
import { API_ORIGIN } from "./api";

const SOCKET_URL = API_ORIGIN;

let socket = null;

/** Read the current JWT from persisted Zustand store */
function getToken() {
    try {
        const raw = localStorage.getItem("auth-storage");
        if (raw) return JSON.parse(raw)?.state?.token || null;
    } catch (_) { }
    return null;
}

/** Lazily creates and returns the socket singleton. */
export function getSocket() {
    const token = getToken();

    if (!token) {
        console.warn("[socket] No auth token — socket will not authenticate");
    }

    if (socket) {
        socket.auth = { token };
        if (socket.disconnected) socket.connect();
        return socket;
    }

    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        randomizationFactor: 0.3,
        autoConnect: true,
        timeout: 10000,
    });

    socket.on("connect", () => {
        console.log("[socket] Connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
        console.error("[socket] Connection error:", err.message);
        // If auth error, try refreshing the token on next attempt
        if (err.message?.includes("Authentication") || err.message?.includes("token")) {
            const freshToken = getToken();
            if (freshToken && socket.auth?.token !== freshToken) {
                socket.auth = { token: freshToken };
            }
        }
    });

    socket.on("disconnect", (reason) => {
        console.log("[socket] Disconnected:", reason);
        // If the server disconnected us, try to reconnect
        if (reason === "io server disconnect") {
            socket.connect();
        }
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
