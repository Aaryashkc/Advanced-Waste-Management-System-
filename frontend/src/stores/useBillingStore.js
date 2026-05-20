import { create } from "zustand";
import api from "../utils/api";

const useBillingStore = create((set, get) => ({
  bills: [],
  summary: null,
  history: [],
  loading: false,
  error: null,

  // Admin state
  adminBills: [],
  billingAccounts: [],
  accountDetails: {},
  adminSummary: null,
  defaulters: [],
  adminPagination: null,
  adminLoading: false,
  accountDetailsLoading: {},

  // Config state
  billingConfigs: [],
  activeFees: { customerFee: 500, adminFee: 1000 },
  defaults: { customerFee: 500, adminFee: 1000 },
  configLoading: false,

  // ── Customer / Admin: fetch my bills ──
  fetchMyBills: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get("/billing/my-bills");
      set({
        bills: res.data.bills,
        summary: res.data.summary,
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err.response?.data?.message || "Failed to fetch bills",
      });
    }
  },

  // ── Customer / Admin: pay a bill ──
  // For eSewa: auto-submits a hidden form to eSewa's hosted checkout (browser redirect).
  // For cash: resolves immediately and refetches bills.
  payBill: async (billingId, method) => {
    try {
      const res = await api.post(`/billing/pay/${billingId}`, { method });

      if (method === "esewa" && res.data.actionUrl) {
        // Build a hidden form and submit to eSewa checkout
        const { actionUrl, formFields } = res.data;
        const form = document.createElement("form");
        form.method = "POST";
        form.action = actionUrl;
        form.style.display = "none";
        Object.entries(formFields).forEach(([name, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return { success: true, redirecting: true };
      }

      // Cash payment — update local state and refetch
      set((state) => ({
        bills: state.bills.map((b) =>
          b._id === billingId ? res.data.bill : b
        ),
      }));
      get().fetchMyBills();
      return { success: true, bill: res.data.bill };
    } catch (err) {
      return {
        success: false,
        error:
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Payment failed",
      };
    }
  },

  // ── Customer / Admin: payment history ──
  fetchPaymentHistory: async () => {
    try {
      const res = await api.get("/billing/history");
      set({ history: res.data.history });
    } catch (err) {
      console.error("Failed to fetch payment history:", err);
    }
  },

  // ── Admin dashboard: billing overview (supports billedRole filter) ──
  fetchBillingOverview: async (params = {}) => {
    set({ adminLoading: true });
    try {
      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/billing/admin/overview?${query}`);
      set({
        adminBills: res.data.bills,
        billingAccounts: res.data.accounts || [],
        adminSummary: res.data.summary,
        defaulters: res.data.defaulters,
        adminPagination: res.data.pagination,
        adminLoading: false,
      });
    } catch (err) {
      set({ adminLoading: false });
      console.error("Failed to fetch billing overview:", err);
    }
  },

  fetchBillingAccountDetails: async (customerId, params = {}) => {
    if (!customerId) return { success: false, error: "Missing account id" };
    set((state) => ({
      accountDetailsLoading: { ...state.accountDetailsLoading, [customerId]: true },
    }));
    try {
      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/billing/admin/accounts/${customerId}?${query}`);
      set((state) => ({
        accountDetails: {
          ...state.accountDetails,
          [customerId]: res.data,
        },
        accountDetailsLoading: { ...state.accountDetailsLoading, [customerId]: false },
      }));
      return { success: true, ...res.data };
    } catch (err) {
      set((state) => ({
        accountDetailsLoading: { ...state.accountDetailsLoading, [customerId]: false },
      }));
      return {
        success: false,
        error: err.response?.data?.message || "Failed to fetch account details",
      };
    }
  },

  // ── Admin dashboard: waive a bill ──
  waiveBill: async (billingId, notes, params = {}) => {
    try {
      await api.put(`/billing/admin/${billingId}/waive`, { notes });
      get().fetchBillingOverview(params);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || "Failed to waive bill",
      };
    }
  },

  // ── Super admin: generate bills ──
  confirmCashPayment: async (billingId, params = {}) => {
    try {
      await api.put(`/billing/admin/${billingId}/confirm-cash`);
      get().fetchBillingOverview(params);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || "Failed to confirm cash payment",
      };
    }
  },

  generateBills: async (params = {}) => {
    try {
      const res = await api.post("/billing/admin/generate");
      get().fetchBillingOverview(params);
      return { success: true, ...res.data };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || "Failed to generate bills",
      };
    }
  },

  // ── Config: fetch billing configs ──
  fetchBillingConfig: async () => {
    set({ configLoading: true });
    try {
      const res = await api.get("/billing/config");
      const defaultFees = { customerFee: 500, adminFee: 1000 };
      set({
        billingConfigs: res.data.configs || [],
        activeFees: res.data.activeFees || defaultFees,
        defaults: res.data.defaults || defaultFees,
        configLoading: false,
      });
    } catch (err) {
      set({ configLoading: false });
      console.error("Failed to fetch billing config:", err);
    }
  },

  // ── Config: update billing fees ──
  updateBillingConfig: async ({ orgId, customerMonthlyFee, adminMonthlyFee }) => {
    try {
      const res = await api.put("/billing/config", {
        orgId,
        customerMonthlyFee,
        adminMonthlyFee,
      });
      // Refetch so UI shows updated values immediately
      await get().fetchBillingConfig();
      return { success: true, config: res.data.config };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || "Failed to update config",
      };
    }
  },
}));

export default useBillingStore;
