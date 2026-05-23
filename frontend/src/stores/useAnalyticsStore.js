import { create } from 'zustand';
import api from '../utils/api';
import useAuthStore from './useAuthStore'; // Import the main auth store
import { isAbortError } from '../utils/requests';

const useAnalyticsStore = create((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchAnalytics: async (config = {}) => {
    set({ isLoading: true, error: null });
    try {
      // Get the token securely from the auth store instead of raw localStorage
      const authState = useAuthStore.getState();
      const user = authState.user;
      if (!authState.token || !user?.role) {
        set({
          error: 'You must be logged in to view analytics',
          isLoading: false
        });
        return;
      }

      const endpoint = user?.role === 'super_admin' ? '/super-admin/analytics' : '/org-admin/analytics';

      const response = await api.get(endpoint, config);

      set({
        data: response.data.data,
        isLoading: false
      });
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Failed to fetch analytics:', error);
      set({
        error: error.response?.data?.message || 'Failed to load analytics data',
        isLoading: false
      });
    }
  }
}));

export default useAnalyticsStore;
