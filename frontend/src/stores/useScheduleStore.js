import { create } from "zustand";
import api from "../utils/api";

const useScheduleStore = create((set, get) => ({
    schedules: [],
    pagination: null,
    locations: [],
    drivers: [],
    loading: false,
    error: null,

    fetchSchedules: async (filters = {}) => {
        set({ loading: true, error: null });
        try {
            console.log('Fetching schedules with filters:', filters);
            // Build query string from filters
            const params = new URLSearchParams();
            if (filters.city) params.append("city", filters.city);
            if (filters.area) params.append("area", filters.area);
            if (filters.day) params.append("day", filters.day);
            params.append("page", filters.page || 1);
            params.append("limit", filters.limit || 10);

            const response = await api.get(`/schedule?${params.toString()}`);
            console.log('Schedules response:', response.data);
            const data = response.data?.data || response.data || [];
            set({ schedules: data, pagination: response.data?.pagination || null, loading: false });
        } catch (error) {
            console.error("Failed to fetch schedules:", error);
            set({
                error: error.response?.data?.message || error.message || "Failed to fetch schedules",
                loading: false
            });
        }
    },

    fetchLocations: async () => {
        try {
            console.log('Fetching locations...');
            const response = await api.get("/location");
            console.log('Locations response:', response.data);
            const data = response.data?.data || response.data || [];
            set({ locations: data });
        } catch (error) {
            console.error("Failed to fetch locations:", error);
            set({ error: error.response?.data?.message || error.message || "Failed to fetch locations" });
        }
    },

    fetchDrivers: async () => {
        try {
            console.log('Fetching drivers...');
            const response = await api.get("/driver");
            console.log('Drivers response:', response.data);
            const data = response.data?.data || response.data || [];
            set({ drivers: data });
        } catch (error) {
            console.error("Failed to fetch drivers:", error);
            set({ error: error.response?.data?.message || error.message || "Failed to fetch drivers" });
        }
    },

    // Helper to fetch all initial data
    fetchAllData: async () => {
        set({ loading: true, error: null });
        try {
            console.log('Fetching all schedule data...');
            await Promise.all([
                get().fetchSchedules(),
                get().fetchLocations(),
                get().fetchDrivers()
            ]);
            console.log('All data fetched successfully');
            set({ loading: false });
        } catch (error) {
            console.error("Failed to load initial data:", error);
            set({ loading: false, error: error.message || "Failed to load initial data" });
        }
    }
}));

export default useScheduleStore;
