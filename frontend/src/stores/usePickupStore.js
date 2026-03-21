import { create } from "zustand";
import api from "../utils/api";

/**
 * usePickupStore — manages the customer's active pickup request lifecycle.
 *
 * State
 * ─────
 *  currentPickup  — null | { id, status, location, driverInfo, ... }
 *  loading        — bool
 *  error          — string | null
 *
 * Actions
 * ───────
 *  createPickup(locationData, extras?) — POST /api/pickups
 *  cancelPickup(id)                    — POST /api/pickups/:id/cancel
 *  fetchPickup(id)                     — GET  /api/pickups/:id
 *  setPickupFromSocket(data)           — called by Searching.jsx on WS events
 *  resetPickup()                       — clear all state
 */
const usePickupStore = create((set, get) => ({
    currentPickup: null,
    loading: false,
    error: null,

    createPickup: async (locationData, extras = {}) => {
        set({ loading: true, error: null });
        try {
            const body = {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                address: locationData.address || null,
                category: extras.category || "non-recyclable",
                level: extras.level || "easy",
                wasteUploadId: extras.wasteUploadId || null,
            };

            const res = await api.post("/pickups", body);
            const pickup = res.data.pickup;

            set({ currentPickup: pickup, loading: false });
            return { success: true, pickup };
        } catch (err) {
            const message = err.response?.data?.message || err.message || "Failed to create pickup";
            set({ loading: false, error: message });
            return { success: false, error: message };
        }
    },

    cancelPickup: async (id) => {
        set({ loading: true, error: null });
        try {
            await api.post(`/pickups/${id}/cancel`);
            set({ currentPickup: null, loading: false });
            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || err.message || "Failed to cancel pickup";
            set({ loading: false, error: message });
            return { success: false, error: message };
        }
    },

    fetchPickup: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await api.get(`/pickups/${id}`);
            set({ currentPickup: res.data.pickup, loading: false });
            return { success: true, pickup: res.data.pickup };
        } catch (err) {
            const message = err.response?.data?.message || err.message || "Failed to fetch pickup";
            set({ loading: false, error: message });
            return { success: false, error: message };
        }
    },

    /** Called by socket event listeners to sync real-time driver assignment */
    setPickupFromSocket: (data) => {
        const current = get().currentPickup;
        if (!current || current.id !== data.id) return;
        set({ currentPickup: { ...current, ...data } });
    },

    resetPickup: () => set({ currentPickup: null, loading: false, error: null }),
}));

export default usePickupStore;
