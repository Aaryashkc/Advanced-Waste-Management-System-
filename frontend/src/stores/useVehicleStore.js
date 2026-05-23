import { create } from 'zustand';
import api from '../utils/api';
import useAuthStore from './useAuthStore';
import { isAbortError } from '../utils/requests';

const useVehicleStore = create((set, get) => ({
  vehicles: [],
  pagination: null,
  isLoading: false,
  error: null,
  lastParams: { page: 1, limit: 10 },

  fetchVehicles: async (params = {}) => {
    const { signal, ...queryParams } = params;
    const nextParams = { ...get().lastParams, ...queryParams, limit: params.limit || 10 };
    set({ isLoading: true, error: null });
    try {
      const user = useAuthStore.getState().user;
      const isSuperAdmin = user?.role === 'super_admin';
      const url = isSuperAdmin ? '/super-admin/vehicles' : '/org-admin/trucks';
      const query = new URLSearchParams();
      if (nextParams.page) query.set("page", nextParams.page);
      if (nextParams.limit) query.set("limit", nextParams.limit);
      const res = await api.get(`${url}?${query.toString()}`, {
        signal,
      });
      set({
        vehicles: res.data.data,
        pagination: res.data.pagination || null,
        lastParams: nextParams,
        isLoading: false,
      });
    } catch (error) {
      if (isAbortError(error)) return;
      set({ error: error.response?.data?.message || 'Failed to fetch vehicles', isLoading: false });
    }
  },

  addVehicle: async (data) => {
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin' ? '/super-admin/vehicles' : '/org-admin/trucks';
      await api.post(url, data);
      get().fetchVehicles({ page: 1 });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to add vehicle' };
    }
  },

  updateVehicle: async (vehicleId, data, options = {}) => {
    let previousVehicles = null;
    if (options.optimistic) {
      previousVehicles = get().vehicles;
      set((state) => ({
        vehicles: state.vehicles.map((v) =>
          v.id === vehicleId ? { ...v, ...data } : v
        ),
      }));
    }
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin'
        ? `/super-admin/vehicles/${vehicleId}`
        : `/org-admin/trucks/${vehicleId}`;
      await api.put(url, data);
      get().fetchVehicles();
      return { success: true };
    } catch (error) {
      if (previousVehicles) set({ vehicles: previousVehicles });
      return { success: false, error: error.response?.data?.message || 'Failed to update vehicle' };
    }
  },

  deleteVehicle: async (vehicleId) => {
    try {
      await api.delete(`/super-admin/vehicles/${vehicleId}`);
      get().fetchVehicles();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to delete vehicle' };
    }
  },

  unassignDriverFromTruck: async (truckId) => {
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin'
        ? `/super-admin/vehicles/${truckId}/unassign-driver`
        : `/org-admin/trucks/${truckId}/unassign-driver`;
      await api.post(url, {});
      get().fetchVehicles();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to unassign driver' };
    }
  },

  assignDriverToTruck: async (driverId, truckId) => {
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin'
        ? '/super-admin/assign-driver-truck'
        : '/org-admin/assign-driver-truck';
      await api.post(url, { driverId, truckId });
      get().fetchVehicles();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to assign driver' };
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

export default useVehicleStore;
