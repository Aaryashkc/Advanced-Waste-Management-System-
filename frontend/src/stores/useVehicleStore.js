import { create } from 'zustand';
import axios from 'axios';
import useAuthStore from './useAuthStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const useVehicleStore = create((set, get) => ({
  vehicles: [],
  isLoading: false,
  error: null,

  fetchVehicles: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;
      const isSuperAdmin = user?.role === 'super_admin';
      const url = isSuperAdmin ? `${API_URL}/super-admin/vehicles` : `${API_URL}/org-admin/trucks`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      set({ vehicles: res.data.data, isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch vehicles', isLoading: false });
    }
  },

  addVehicle: async (data) => {
    try {
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin' ? `${API_URL}/super-admin/vehicles` : `${API_URL}/org-admin/trucks`;
      await axios.post(url, data, { headers: { Authorization: `Bearer ${token}` } });
      get().fetchVehicles();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to add vehicle' };
    }
  },

  updateVehicle: async (vehicleId, data) => {
    try {
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin'
        ? `${API_URL}/super-admin/vehicles/${vehicleId}`
        : `${API_URL}/org-admin/trucks/${vehicleId}`;
      await axios.put(url, data, { headers: { Authorization: `Bearer ${token}` } });
      get().fetchVehicles();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to update vehicle' };
    }
  },

  deleteVehicle: async (vehicleId) => {
    try {
      const token = useAuthStore.getState().token;
      await axios.delete(`${API_URL}/super-admin/vehicles/${vehicleId}`, { headers: { Authorization: `Bearer ${token}` } });
      get().fetchVehicles();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to delete vehicle' };
    }
  },

  unassignDriverFromTruck: async (truckId) => {
    try {
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin'
        ? `${API_URL}/super-admin/vehicles/${truckId}/unassign-driver`
        : `${API_URL}/org-admin/trucks/${truckId}/unassign-driver`;
      await axios.post(url, {}, { headers: { Authorization: `Bearer ${token}` } });
      get().fetchVehicles();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to unassign driver' };
    }
  },

  assignDriverToTruck: async (driverId, truckId) => {
    try {
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin'
        ? `${API_URL}/super-admin/assign-driver-truck`
        : `${API_URL}/org-admin/assign-driver-truck`;
      await axios.post(url, { driverId, truckId }, { headers: { Authorization: `Bearer ${token}` } });
      get().fetchVehicles();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to assign driver' };
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

export default useVehicleStore;
