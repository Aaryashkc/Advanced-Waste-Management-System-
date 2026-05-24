import axios from 'axios';
import { reportFrontendError } from './errorReporting.js';
import { API_BASE_URL, API_ORIGIN, ML_API_BASE_URL } from './apiConfig.js';

export { API_BASE_URL, API_ORIGIN, ML_API_BASE_URL };

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const mlApi = axios.create({
  baseURL: ML_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    config.metadata = { startedAt: performance.now() };
    
    // Try to get token from Zustand store first, fallback to localStorage for backward compatibility
    let token = null;
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        token = parsed?.state?.token;
      }
    } catch {
      // Fallback to old localStorage key
      token = localStorage.getItem('accessToken');
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    reportFrontendError(error, { source: 'api-request' });
    return Promise.reject(error);
  }
);

mlApi.interceptors.request.use(
  (config) => {
    config.metadata = { startedAt: performance.now() };
    let token = null;
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        token = parsed?.state?.token;
      }
    } catch {
      token = localStorage.getItem('accessToken');
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    reportFrontendError(error, {
      source: 'api-response',
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      durationMs: error.config?.metadata?.startedAt
        ? Math.round(performance.now() - error.config.metadata.startedAt)
        : undefined,
      responseMessage: error.response?.data?.message,
    });
    
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage
      localStorage.removeItem('auth-storage');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login' && window.location.pathname !== '/otp-verification') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

mlApi.interceptors.response.use(
  (response) => response,
  (error) => {
    reportFrontendError(error, {
      source: 'ml-api-response',
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      durationMs: error.config?.metadata?.startedAt
        ? Math.round(performance.now() - error.config.metadata.startedAt)
        : undefined,
      responseMessage: error.response?.data?.message,
    });
    return Promise.reject(error);
  }
);

// Auth API methods
export const authAPI = {
  /**
   * Request OTP for login
   * @param {string} email - User email
   * @param {string} phone - User phone (optional)
   * @returns {Promise} - API response
   */
  requestOTP: async (email, phone = null) => {
    const payload = {};
    if (email) payload.email = email;
    if (phone) payload.phone = phone;
    
    const response = await api.post('/auth/request-otp', payload);
    return response.data;
  },

  /**
   * Verify OTP and login
   * @param {string} otp - 6-digit OTP code
   * @param {string} email - User email
   * @param {string} phone - User phone (optional)
   * @returns {Promise} - API response with token and user data
   */
  verifyOTP: async (otp, email, phone = null) => {
    const payload = { otp };
    if (email) payload.email = email;
    if (phone) payload.phone = phone;
    
    const response = await api.post('/auth/verify-otp', payload);
    return response.data;
  },

  /**
   * Register new user (password-based)
   * @param {object} userData - User registration data
   * @returns {Promise} - API response
   */
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  /**
   * Login with password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise} - API response
   */
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  /**
   * Get current authenticated user
   * @returns {Promise} - API response with user data
   */
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export default api;

