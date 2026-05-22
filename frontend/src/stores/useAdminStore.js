import { create } from 'zustand';
import api from '../utils/api';

const useAdminStore = create((set, get) => ({
  admins: [],
  orgName: "",
  orgGroups: null,
  pagination: null,
  isLoading: false,
  error: null,
  lastParams: { page: 1, limit: 10 },

  fetchAdmins: async (params = {}) => {
    const nextParams = { ...get().lastParams, ...params, limit: params.limit || 10 };
    set({ isLoading: true, error: null });
    try {
      const query = new URLSearchParams();
      if (nextParams.page) query.set("page", nextParams.page);
      if (nextParams.limit) query.set("limit", nextParams.limit);
      const res = await api.get(`/org-admin/admins?${query.toString()}`);
      set({
        admins: res.data.data,
        orgName: res.data.orgName || "",
        orgGroups: res.data.orgGroups || null,
        pagination: res.data.pagination || null,
        lastParams: nextParams,
        isLoading: false
      });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch admins', isLoading: false });
    }
  },

  createAdmin: async (data) => {
    try {
      await api.post('/org-admin/admins', data);
      get().fetchAdmins({ page: 1 });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to create admin' };
    }
  },

  updateAdmin: async (adminId, data) => {
    try {
      await api.put(`/org-admin/admins/${adminId}`, data);
      get().fetchAdmins();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to update admin' };
    }
  },

  deleteAdmin: async (adminId) => {
    try {
      await api.delete(`/super-admin/admins/${adminId}`);
      get().fetchAdmins();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to delete admin' };
    }
  }
}));

export default useAdminStore;
