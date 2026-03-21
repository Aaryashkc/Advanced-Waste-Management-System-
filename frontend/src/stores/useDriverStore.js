import { create } from 'zustand';
import axios from 'axios';
import useAuthStore from './useAuthStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const useDriverStore = create((set, get) => ({
  drivers: [],
  isLoading: false,
  error: null,

  fetchDrivers: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin' ? `${API_URL}/super-admin/drivers` : `${API_URL}/org-admin/drivers`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      set({ drivers: res.data.data, isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch drivers', isLoading: false });
    }
  },

  addDriver: async (data) => {
    try {
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin' ? `${API_URL}/super-admin/drivers` : `${API_URL}/org-admin/drivers/create`;
      await axios.post(url, data, { headers: { Authorization: `Bearer ${token}` } });
      get().fetchDrivers();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to add driver' };
    }
  },

  updateDriver: async (driverId, data) => {
    try {
      const token = useAuthStore.getState().token;
      await axios.put(`${API_URL}/super-admin/drivers/${driverId}`, data, { headers: { Authorization: `Bearer ${token}` } });
      get().fetchDrivers();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to update driver' };
    }
  },

  deleteDriver: async (driverId) => {
    try {
      const token = useAuthStore.getState().token;
      await axios.delete(`${API_URL}/super-admin/drivers/${driverId}`, { headers: { Authorization: `Bearer ${token}` } });
      get().fetchDrivers();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to delete driver' };
    }
  },

  requestDeletion: async (type, targetId, reason) => {
    try {
      const token = useAuthStore.getState().token;
      await axios.post(`${API_URL}/org-admin/deletion-requests`, { type, targetId, reason }, { headers: { Authorization: `Bearer ${token}` } });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to submit request' };
    }
  }
}));

export default useDriverStore;
