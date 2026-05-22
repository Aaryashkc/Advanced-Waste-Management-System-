import { create } from 'zustand';
import api from '../utils/api';
import useAuthStore from './useAuthStore';

const useDriverStore = create((set, get) => ({
  drivers: [],
  isLoading: false,
  error: null,

  fetchDrivers: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin' ? '/super-admin/drivers' : '/org-admin/drivers';
      const res = await api.get(url);
      set({ drivers: res.data.data, isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch drivers', isLoading: false });
    }
  },

  addDriver: async (data) => {
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin' ? '/super-admin/drivers' : '/org-admin/drivers/create';
      await api.post(url, data);
      get().fetchDrivers();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to add driver' };
    }
  },

  updateDriver: async (driverId, data) => {
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin'
        ? `/super-admin/drivers/${driverId}`
        : `/org-admin/drivers/${driverId}`;
      await api.put(url, data);
      get().fetchDrivers();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to update driver' };
    }
  },

  deleteDriver: async (driverId) => {
    try {
      await api.delete(`/super-admin/drivers/${driverId}`);
      get().fetchDrivers();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to delete driver' };
    }
  },

  requestDeletion: async (type, targetId, reason) => {
    try {
      await api.post('/org-admin/deletion-requests', { type, targetId, reason });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to submit request' };
    }
  }
}));

export default useDriverStore;
