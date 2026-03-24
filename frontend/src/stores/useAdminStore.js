import { create } from 'zustand';
import axios from 'axios';
import useAuthStore from './useAuthStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const useAdminStore = create((set, get) => ({
  admins: [],
  orgName: "",
  orgGroups: null,
  isLoading: false,
  error: null,

  fetchAdmins: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const res = await axios.get(`${API_URL}/org-admin/admins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({
        admins: res.data.data,
        orgName: res.data.orgName || "",
        orgGroups: res.data.orgGroups || null,
        isLoading: false
      });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch admins', isLoading: false });
    }
  },

  createAdmin: async (data) => {
    try {
      const token = useAuthStore.getState().token;
      await axios.post(`${API_URL}/org-admin/admins`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      get().fetchAdmins();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to create admin' };
    }
  },

  updateAdmin: async (adminId, data) => {
    try {
      const token = useAuthStore.getState().token;
      await axios.put(`${API_URL}/org-admin/admins/${adminId}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      get().fetchAdmins();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to update admin' };
    }
  },

  deleteAdmin: async (adminId) => {
    try {
      const token = useAuthStore.getState().token;
      await axios.delete(`${API_URL}/super-admin/admins/${adminId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      get().fetchAdmins();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to delete admin' };
    }
  }
}));

export default useAdminStore;
