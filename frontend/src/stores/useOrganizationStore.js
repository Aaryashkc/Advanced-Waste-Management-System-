import { create } from 'zustand';
import axios from 'axios';
import useAuthStore from './useAuthStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const useOrganizationStore = create((set, get) => ({
  organizations: [],
  isLoading: false,
  error: null,

  fetchOrganizations: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const res = await axios.get(`${API_URL}/super-admin/organizations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ organizations: res.data.organizations || [], isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch organizations', isLoading: false });
    }
  },

  createOrganization: async (data) => {
    try {
      const token = useAuthStore.getState().token;
      await axios.post(`${API_URL}/super-admin/organizations`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      get().fetchOrganizations();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to create organization' };
    }
  },

  updateOrganization: async (orgId, data) => {
    try {
      const token = useAuthStore.getState().token;
      await axios.put(`${API_URL}/super-admin/organizations/${orgId}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      get().fetchOrganizations();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to update organization' };
    }
  },

  addAdmin: async (orgId, adminData) => {
    try {
      const token = useAuthStore.getState().token;
      await axios.post(`${API_URL}/super-admin/organizations/${orgId}/admins`, adminData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      get().fetchOrganizations();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to add admin' };
    }
  }
}));

export default useOrganizationStore;
