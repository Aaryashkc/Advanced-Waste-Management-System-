import { create } from "zustand";
import api from "../utils/api";

const useAreaStore = create((set, get) => ({
  areas: [],
  loading: false,
  error: null,

  fetchAreas: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get("/areas");
      set({ areas: response.data.data || [], loading: false });
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
      await get().fetchAreas();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || "Failed to create area" };
    }
  },

  updateArea: async (id, data) => {
    try {
      await api.put(`/areas/${id}`, data);
      await get().fetchAreas();
      return { success: true };
    } catch (error) {
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
