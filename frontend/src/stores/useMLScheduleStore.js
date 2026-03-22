import { create } from "zustand";
import api from "../utils/api";

const useMLScheduleStore = create((set, get) => ({
    schedules: [],
    currentSchedule: null,
    prediction: null,
    publicSchedule: null,
    mlHealth: null,
    mlAnalytics: null,
    driverAssignments: [],
    loading: false,
    error: null,

    // Fetch public schedule for customers
    fetchPublicSchedule: async () => {
        set({ loading: true, error: null });
        try {
            const response = await api.get("/ml-schedule/public");
            set({ publicSchedule: response.data.data, loading: false });
        } catch (error) {
            set({
                error: error.response?.data?.message || "Failed to fetch schedule",
                loading: false,
            });
        }
    },

    // Generate a full ML schedule for a date
    generateSchedule: async (date, unavailableDrivers = []) => {
        set({ loading: true, error: null });
        try {
            const response = await api.post("/ml-schedule/generate", {
                date,
                unavailableDrivers,
            });
            const schedule = response.data.data;
            set({
                currentSchedule: schedule,
                loading: false,
            });
            return schedule;
        } catch (error) {
            console.error("Failed to generate ML schedule:", error);
            set({
                error: error.response?.data?.message || "Failed to generate schedule. Is the ML service running?",
                loading: false,
            });
            return null;
        }
    },

    // Fetch all ML schedules (history)
    fetchSchedules: async (filters = {}) => {
        set({ loading: true, error: null });
        try {
            const params = new URLSearchParams();
            if (filters.status) params.append("status", filters.status);
            if (filters.page) params.append("page", filters.page);
            if (filters.limit) params.append("limit", filters.limit);

            const response = await api.get(`/ml-schedule?${params.toString()}`);
            set({
                schedules: response.data.data || [],
                loading: false,
            });
        } catch (error) {
            console.error("Failed to fetch ML schedules:", error);
            set({
                error: error.response?.data?.message || "Failed to fetch schedules",
                loading: false,
            });
        }
    },

    // Fetch a single schedule by ID
    fetchScheduleById: async (id) => {
        set({ loading: true, error: null });
        try {
            const response = await api.get(`/ml-schedule/${id}`);
            set({
                currentSchedule: response.data.data,
                loading: false,
            });
        } catch (error) {
            console.error("Failed to fetch ML schedule:", error);
            set({
                error: error.response?.data?.message || "Failed to fetch schedule",
                loading: false,
            });
        }
    },

    // Confirm a draft schedule for dispatch
    confirmSchedule: async (id) => {
        set({ loading: true, error: null });
        try {
            const response = await api.post(`/ml-schedule/${id}/confirm`);
            set({
                currentSchedule: response.data.data,
                loading: false,
            });
            // Refresh the list
            get().fetchSchedules();
            return response.data.data;
        } catch (error) {
            console.error("Failed to confirm ML schedule:", error);
            set({
                error: error.response?.data?.message || "Failed to confirm schedule",
                loading: false,
            });
            return null;
        }
    },

    // Predict waste for a single district
    predictDistrict: async (district, date) => {
        set({ loading: true, error: null });
        try {
            const response = await api.post("/ml-schedule/predict", { district, date });
            set({
                prediction: response.data.data,
                loading: false,
            });
            return response.data.data;
        } catch (error) {
            console.error("Failed to predict waste:", error);
            set({
                error: error.response?.data?.message || "Failed to predict waste volume",
                loading: false,
            });
            return null;
        }
    },

    // Check ML service health
    checkMLHealth: async () => {
        try {
            const response = await api.get("/ml-schedule/health");
            set({ mlHealth: response.data.data });
            return response.data.data;
        } catch (error) {
            set({ mlHealth: { status: "offline" } });
            return { status: "offline" };
        }
    },

    // Fetch driver's ML assignments for today
    fetchDriverAssignments: async () => {
        set({ loading: true, error: null });
        try {
            const response = await api.get("/ml-schedule/driver-assignments");
            set({
                driverAssignments: response.data.data || [],
                loading: false,
            });
        } catch (error) {
            console.error("Failed to fetch driver assignments:", error);
            set({
                error: error.response?.data?.message || "Failed to fetch assignments",
                loading: false,
            });
        }
    },

    // Fetch ML analytics for reports
    fetchMLAnalytics: async () => {
        set({ loading: true, error: null });
        try {
            const response = await api.get("/ml-schedule/analytics");
            set({ mlAnalytics: response.data.data, loading: false });
        } catch (error) {
            set({
                error: error.response?.data?.message || "Failed to fetch analytics",
                loading: false,
            });
        }
    },

    // Redispatch a skipped district
    redispatchDistrict: async (scheduleId, districtName) => {
        set({ loading: true, error: null });
        try {
            const response = await api.post(`/ml-schedule/${scheduleId}/redispatch`, {
                district: districtName,
            });
            set({
                currentSchedule: response.data.data,
                loading: false,
            });
            return response.data;
        } catch (error) {
            console.error("Failed to redispatch district:", error);
            set({
                error: error.response?.data?.message || "Failed to redispatch district",
                loading: false,
            });
            return null;
        }
    },

    // Clear current schedule
    clearCurrentSchedule: () => set({ currentSchedule: null, prediction: null }),

    // Clear error
    clearError: () => set({ error: null }),
}));

export default useMLScheduleStore;
