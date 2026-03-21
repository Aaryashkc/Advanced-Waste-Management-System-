import { create } from "zustand";
import api from "../utils/api";

const useScheduleStore = create((set, get) => ({
    schedules: [],
    locations: [],
    drivers: [],
    loading: false,
    error: null,

    fetchSchedules: async (filters = {}) => {
        set({ loading: true, error: null });
        try {
            // Build query string from filters
            const params = new URLSearchParams();
            if (filters.city) params.append("city", filters.city);
            if (filters.area) params.append("area", filters.area);
            if (filters.day) params.append("day", filters.day);

            const response = await api.get(`/schedule?${params.toString()}`);
            set({ schedules: response.data.data || [], loading: false });
        } catch (error) {
            console.error("Failed to fetch schedules:", error);
            set({
                error: error.response?.data?.message || "Failed to fetch schedules",
                loading: false
            });
        }
    },

    fetchLocations: async () => {
        // Keep loading true if already loading, else set it? 
        // Usually separate loading states or global loading. 
        // Let's use the same loading for simplicity but be careful not to flicker.
        // If we call these in parallel, we might want to handle it.
        // For now, simple overrides.
        // set({ loading: true, error: null }); 
        try {
            const response = await api.get("/location");
            set({ locations: response.data || [] });
        } catch (error) {
            console.error("Failed to fetch locations:", error);
            set({ error: error.response?.data?.message || "Failed to fetch locations" });
        }
    },

    fetchDrivers: async () => {
        try {
            const response = await api.get("/driver");
            set({ drivers: response.data.data || [] });
        } catch (error) {
            console.error("Failed to fetch drivers:", error);
            set({ error: error.response?.data?.message || "Failed to fetch drivers" });
        }
    },

    // Helper to fetch all initial data
    fetchAllData: async () => {
        set({ loading: true, error: null });
        try {
            await Promise.all([
                get().fetchSchedules(),
                get().fetchLocations(),
                get().fetchDrivers()
            ]);
            set({ loading: false });
        } catch (error) {
            set({ loading: false, error: "Failed to load initial data" });
        }
    }
}));

export default useScheduleStore;
