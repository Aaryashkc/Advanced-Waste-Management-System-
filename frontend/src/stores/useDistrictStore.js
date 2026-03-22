import { create } from "zustand";
import api from "../utils/api";

const useDistrictStore = create((set, get) => ({
  districts: [],
  loading: false,
  error: null,

  fetchDistricts: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get("/districts");
      set({ districts: response.data.data || [], loading: false });
    } catch (error) {
      set({
        error: error.response?.data?.message || "Failed to fetch districts",
        loading: false,
      });
    }
  },

  createDistrict: async (data) => {
    try {
      await api.post("/districts", data);
      await get().fetchDistricts();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || "Failed to create district" };
    }
  },

  updateDistrict: async (id, data) => {
    try {
      await api.put(`/districts/${id}`, data);
      await get().fetchDistricts();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || "Failed to update district" };
    }
  },

  deleteDistrict: async (id) => {
    try {
      await api.delete(`/districts/${id}`);
      await get().fetchDistricts();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || "Failed to delete district" };
    }
  },
}));

export default useDistrictStore;
