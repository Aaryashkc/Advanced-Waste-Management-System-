import { create } from 'zustand';
import axios from 'axios';
import useAuthStore from './useAuthStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const useOrganizationStore = create((set, get) => ({
  organizations: [],
  currentOrg: null,
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

  fetchOrgDetail: async (orgId) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;
      const isMyOrg = orgId === "mine" || user?.role === "admin";
      const url = isMyOrg
        ? `${API_URL}/org-admin/organization`
        : `${API_URL}/super-admin/organizations/${orgId}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ currentOrg: res.data.data, isLoading: false });
      return res.data.data;
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch organization details', isLoading: false });
      return null;
    }
  },

  clearCurrentOrg: () => set({ currentOrg: null }),

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
      const user = useAuthStore.getState().user;
      const isMyOrg = orgId === "mine" || user?.role === "admin";
      const url = isMyOrg
        ? `${API_URL}/org-admin/organization`
        : `${API_URL}/super-admin/organizations/${orgId}`;
      const res = await axios.put(url, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (isMyOrg) {
        set({ currentOrg: res.data.data || res.data.organization || null });
      } else {
        get().fetchOrganizations();
      }
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
