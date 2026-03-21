import { create } from 'zustand';
import axios from 'axios';
import useAuthStore from './useAuthStore'; // Import the main auth store

// Ensure exact base URL from your env/config. Assuming standard setup.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const useAnalyticsStore = create((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchAnalytics: async () => {
    set({ isLoading: true, error: null });
    try {
      // Get the token securely from the auth store instead of raw localStorage
      const authState = useAuthStore.getState();
      const token = authState.token; 
      const user = authState.user;
      
      const endpoint = user?.role === 'super_admin' ? '/super-admin/analytics' : '/org-admin/analytics';

      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      set({
        data: response.data.data,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      set({
        error: error.response?.data?.message || 'Failed to load analytics data',
        isLoading: false
      });
    }
  }
}));

export default useAnalyticsStore;
