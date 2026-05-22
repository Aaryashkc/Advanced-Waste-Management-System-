import { create } from 'zustand';
import api from '../utils/api';
import useAuthStore from './useAuthStore';

const useOrganizationStore = create((set, get) => ({
  organizations: [],
  currentOrg: null,
  isLoading: false,
  error: null,

  fetchOrganizations: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/super-admin/organizations');
      set({ organizations: res.data.organizations || [], isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch organizations', isLoading: false });
    }
  },

  fetchOrgDetail: async (orgId) => {
    set({ isLoading: true, error: null });
    try {
      const user = useAuthStore.getState().user;
      const isMyOrg = orgId === "mine" || user?.role === "admin";
      const url = isMyOrg
        ? '/org-admin/organization'
        : `/super-admin/organizations/${orgId}`;
      const res = await api.get(url);
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
      await api.post('/super-admin/organizations', data);
      get().fetchOrganizations();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to create organization' };
    }
  },

  updateOrganization: async (orgId, data) => {
    try {
      const user = useAuthStore.getState().user;
      const isMyOrg = orgId === "mine" || user?.role === "admin";
      const url = isMyOrg
        ? '/org-admin/organization'
        : `/super-admin/organizations/${orgId}`;
      const res = await api.put(url, data);
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
      await api.post(`/super-admin/organizations/${orgId}/admins`, adminData);
      get().fetchOrganizations();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to add admin' };
    }
  }
}));

export default useOrganizationStore;
