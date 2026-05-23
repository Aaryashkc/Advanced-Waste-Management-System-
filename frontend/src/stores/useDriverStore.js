import { create } from 'zustand';
import api from '../utils/api';
import useAuthStore from './useAuthStore';
import { isAbortError } from '../utils/requests';

const useDriverStore = create((set, get) => ({
  drivers: [],
  pagination: null,
  isLoading: false,
  error: null,
  lastParams: { page: 1, limit: 10 },

  fetchDrivers: async (params = {}) => {
    const { signal, ...queryParams } = params;
    const nextParams = { ...get().lastParams, ...queryParams, limit: params.limit || 10 };
    set({ isLoading: true, error: null });
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin' ? '/super-admin/drivers' : '/org-admin/drivers';
      const query = new URLSearchParams();
      if (nextParams.page) query.set("page", nextParams.page);
      if (nextParams.limit) query.set("limit", nextParams.limit);
      const res = await api.get(`${url}?${query.toString()}`, {
        signal,
      });
      set({
        drivers: res.data.data,
        pagination: res.data.pagination || null,
        lastParams: nextParams,
        isLoading: false,
      });
    } catch (error) {
      if (isAbortError(error)) return;
      set({ error: error.response?.data?.message || 'Failed to fetch drivers', isLoading: false });
    }
  },

  addDriver: async (data) => {
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin' ? '/super-admin/drivers' : '/org-admin/drivers/create';
      await api.post(url, data);
      get().fetchDrivers({ page: 1 });
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
