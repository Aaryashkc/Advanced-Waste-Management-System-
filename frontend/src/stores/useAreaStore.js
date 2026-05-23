import { create } from "zustand";
import api from "../utils/api";

const useAreaStore = create((set, get) => ({
  areas: [],
  pagination: null,
  loading: false,
  error: null,
  lastParams: { page: 1, limit: 10 },

  fetchAreas: async (params = {}) => {
    const nextParams = { ...get().lastParams, ...params, limit: params.limit || 10 };
    set({ loading: true, error: null });
    try {
      const query = new URLSearchParams();
      if (nextParams.page) query.set("page", nextParams.page);
      if (nextParams.limit) query.set("limit", nextParams.limit);
      if (nextParams.orgId) query.set("orgId", nextParams.orgId);
      const response = await api.get(`/areas?${query.toString()}`);
      set({
        areas: response.data.data || [],
        pagination: response.data.pagination || null,
        lastParams: nextParams,
        loading: false,
      });
    } catch (error) {
      set({
        error: error.response?.data?.message || "Failed to fetch areas",
        loading: false,
      });
    }
  },

  createArea: async (data) => {
    try {
      await api.post("/areas", data);
      await get().fetchAreas({ page: 1 });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || "Failed to create area" };
    }
  },

  updateArea: async (id, data, options = {}) => {
    let previousAreas = null;
    if (options.optimistic) {
      previousAreas = get().areas;
      set((state) => ({
        areas: state.areas.map((area) =>
          area._id === id ? { ...area, ...data } : area
        ),
      }));
    }
    try {
      await api.put(`/areas/${id}`, data);
      await get().fetchAreas();
      return { success: true };
    } catch (error) {
      if (previousAreas) set({ areas: previousAreas });
      return { success: false, error: error.response?.data?.message || "Failed to update area" };
    }
  },

  deleteArea: async (id) => {
    try {
      await api.delete(`/areas/${id}`);
      await get().fetchAreas();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || "Failed to delete area" };
    }
  },
}));

export default useAreaStore;
