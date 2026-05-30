import { create } from "zustand";
import api from "../utils/api";
import { isAbortError } from "../utils/requests";

const useUserStore = create((set, get) => ({
  users: [],
  stats: null,
  pagination: null,
  isLoading: false,
  error: null,

  fetchUsers: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const query = new URLSearchParams();
      if (params.search) query.set("search", params.search);
      if (params.role) query.set("role", params.role);
      if (params.status) query.set("status", params.status);
      if (params.page) query.set("page", params.page);
      query.set("limit", params.limit || 10);

      const basePath = params.scope === "org" ? "/org-admin/users" : "/super-admin/users";
      const res = await api.get(`${basePath}?${query.toString()}`, {
        signal: params.signal,
      });
      set({
        users: res.data.users,
        stats: res.data.stats,
        pagination: res.data.pagination,
        isLoading: false,
      });
    } catch (err) {
      if (isAbortError(err)) return;
      set({
        isLoading: false,
        error: err.response?.data?.message || "Failed to fetch users",
      });
    }
  },

  updateUser: async (userId, data, options = {}) => {
    let previousUsers = null;
    if (options.optimistic) {
      previousUsers = get().users;
      set((state) => ({
        users: state.users.map((u) =>
          u.id === userId ? { ...u, ...data } : u
        ),
      }));
    }
    try {
      const basePath = options.scope === "org" ? "/org-admin/users" : "/super-admin/users";
      const res = await api.put(`${basePath}/${userId}`, data);
      if (res.data.success) {
        // Update user in local state
        set((state) => ({
          users: state.users.map((u) =>
            u.id === userId ? { ...u, ...res.data.user } : u
          ),
        }));
        return { success: true };
      }
      if (previousUsers) set({ users: previousUsers });
      return { success: false, error: res.data.message };
    } catch (err) {
      if (previousUsers) set({ users: previousUsers });
      return {
        success: false,
        error: err.response?.data?.message || "Failed to update user",
      };
    }
  },
}));

export default useUserStore;
