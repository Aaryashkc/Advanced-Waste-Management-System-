import { create } from 'zustand';
import api from '../utils/api';
import useAuthStore from './useAuthStore';

const useVehicleStore = create((set, get) => ({
  vehicles: [],
  isLoading: false,
  error: null,

  fetchVehicles: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = useAuthStore.getState().user;
      const isSuperAdmin = user?.role === 'super_admin';
      const url = isSuperAdmin ? '/super-admin/vehicles' : '/org-admin/trucks';
      const res = await api.get(url);
      set({ vehicles: res.data.data, isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch vehicles', isLoading: false });
    }
  },

  addVehicle: async (data) => {
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin' ? '/super-admin/vehicles' : '/org-admin/trucks';
      await api.post(url, data);
      get().fetchVehicles();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to add vehicle' };
    }
  },

  updateVehicle: async (vehicleId, data) => {
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin'
        ? `/super-admin/vehicles/${vehicleId}`
        : `/org-admin/trucks/${vehicleId}`;
      await api.put(url, data);
      get().fetchVehicles();
      return { success: true };
    } catch (error) {
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
