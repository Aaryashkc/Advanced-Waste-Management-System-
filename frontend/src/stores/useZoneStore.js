import { create } from 'zustand';
import api from '../utils/api';
import useAuthStore from './useAuthStore';

const useZoneStore = create((set, get) => ({
  zones: [],
  trucks: [],
  drivers: [],
  organizations: [],
  isLoading: false,
  isSubmitting: false,
  error: null,

  // Fetch zones (schedules) — scoped by role automatically on backend
  fetchZones: async (orgId = null) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (orgId) params.append('orgId', orgId);
      const res = await api.get(`/schedule?${params.toString()}`);
      set({ zones: res.data.data || [], isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch zones', isLoading: false });
    }
  },

  // Create zone (schedule)
  createZone: async (data) => {
    set({ isSubmitting: true });
    try {
      const user = useAuthStore.getState().user;
      // For admin, orgId comes from their account; for super_admin they pass it explicitly
      const payload = { ...data };
      if (user?.role === 'admin' && !payload.orgId) {
        payload.orgId = user.orgId;
      }
      await api.post('/schedule', payload);
      set({ isSubmitting: false });
      await get().fetchZones();
      return { success: true };
    } catch (error) {
      set({ isSubmitting: false });
      return { success: false, error: error.response?.data?.message || 'Failed to create zone' };
    }
  },

  // Update zone
  updateZone: async (zoneId, data) => {
    set({ isSubmitting: true });
    try {
      await api.put(`/schedule/${zoneId}`, data);
      set({ isSubmitting: false });
      await get().fetchZones();
      return { success: true };
    } catch (error) {
      set({ isSubmitting: false });
      return { success: false, error: error.response?.data?.message || 'Failed to update zone' };
    }
  },

  // Delete zone (soft delete)
  deleteZone: async (zoneId) => {
    try {
      await api.delete(`/schedule/${zoneId}`);
      await get().fetchZones();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to delete zone' };
    }
  },

  // Fetch trucks for dropdown (org scoped)
  fetchTrucks: async () => {
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin'
        ? '/super-admin/vehicles'
        : '/org-admin/trucks';
      const res = await api.get(url);
      set({ trucks: res.data.data || [] });
    } catch (error) {
      console.error('Failed to fetch trucks:', error);
    }
  },

  // Fetch drivers for dropdown (org scoped)
  fetchDrivers: async () => {
    try {
      const user = useAuthStore.getState().user;
      const url = user?.role === 'super_admin'
        ? '/super-admin/drivers'
        : '/org-admin/drivers';
      const res = await api.get(url);
      set({ drivers: res.data.data || [] });
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
    }
  },

  // Fetch organizations (super_admin only)
  fetchOrganizations: async () => {
    try {
      const res = await api.get('/super-admin/organizations');
      set({ organizations: res.data.organizations || [] });
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  },

  // Load all dropdown data at once
  fetchDropdownData: async () => {
    const user = useAuthStore.getState().user;
    const tasks = [get().fetchTrucks(), get().fetchDrivers()];
    if (user?.role === 'super_admin') {
      tasks.push(get().fetchOrganizations());
    }
    await Promise.all(tasks);
  },
}));

export default useZoneStore;
