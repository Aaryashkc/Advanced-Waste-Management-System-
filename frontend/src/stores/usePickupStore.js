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
 *  estimate       — null | { estimatedPrice, priceBreakdown, distanceKm, ... }
 *  estimateLoading — bool
 *  estimateError  — string | null
 */
const usePickupStore = create((set, get) => ({
    currentPickup: null,
    loading: false,
    error: null,

    // Estimate state
    estimate: null,
    estimateLoading: false,
    estimateError: null,

    /**
     * Get a price/route estimate BEFORE creating the pickup.
     * POST /api/pickups/estimate
     */
    estimatePickup: async (locationData, extras = {}) => {
        set({ estimateLoading: true, estimateError: null, estimate: null });
        try {
            const body = {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                category: extras.category || "non-recyclable",
                level: extras.level || "easy",
                area: extras.area || null,
            };
            const res = await api.post("/pickups/estimate", body);
            set({ estimate: res.data, estimateLoading: false });
            return { success: true, data: res.data };
        } catch (err) {
            const message = err.response?.data?.message || err.message || "Failed to get estimate";
            set({ estimateLoading: false, estimateError: message });
            return { success: false, error: message };
        }
    },

    clearEstimate: () => set({ estimate: null, estimateError: null, estimateLoading: false }),

    restoreEstimateFromPickup: (pickup) => set({
        estimate: pickup ? {
            success: true,
            estimatedPrice: pickup.estimatedPrice,
            priceBreakdown: pickup.priceBreakdown,
            currency: pickup.currency,
            distanceKm: pickup.routeDistanceKm,
            durationMinutes: pickup.routeDurationMinutes,
            routeGeometry: pickup.routeGeometry,
            depotLocation: pickup.depotLocation,
        } : null,
        estimateError: null,
        estimateLoading: false,
    }),

    /**
     * Create a pickup request (now includes pricing data from the estimate).
     * POST /api/pickups
     */
    createPickup: async (locationData, extras = {}) => {
        set({ loading: true, error: null });
        try {
            const { estimate } = get();

            const body = {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                address: locationData.address || null,
                category: extras.category || "non-recyclable",
                level: extras.level || "easy",
                wasteUploadId: extras.wasteUploadId || null,
                area: extras.area || null,
                // Pricing data from estimate
                estimatedPrice: estimate?.estimatedPrice || null,
                priceBreakdown: estimate?.priceBreakdown || null,
                routeDistanceKm: estimate?.distanceKm || null,
                routeDurationMinutes: estimate?.durationMinutes || null,
                routeGeometry: estimate?.routeGeometry || null,
                depotLocation: estimate?.depotLocation || null,
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

    resetPickup: () => set({ currentPickup: null, loading: false, error: null, estimate: null, estimateError: null }),
}));

export default usePickupStore;
