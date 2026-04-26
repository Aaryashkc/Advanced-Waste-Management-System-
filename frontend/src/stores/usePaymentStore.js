import { create } from "zustand";
import api from "../utils/api";

/**
 * usePaymentStore — initiates payments and (for eSewa) redirects the
 * customer's browser to eSewa's hosted checkout via an auto-submitting form.
 *
 * Security note: the signed form fields are produced by the backend. The
 * frontend never sees the eSewa secret and never computes signatures.
 */
const usePaymentStore = create((set) => ({
  loading: false,
  error: null,
  lastPayment: null,

  /**
   * Initiate a payment for an existing pickup.
   * For eSewa: auto-submits a hidden form to eSewa's hosted checkout.
   * For cash:  resolves immediately.
   */
  initiatePayment: async ({ pickupId, method }) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post("/payments/initiate", { pickupId, method });
      set({ loading: false, lastPayment: res.data.payment });

      if (method === "esewa") {
        // Build a hidden form and submit it to eSewa's checkout URL.
        // The browser is redirected; eSewa will later redirect back to our
        // success/failure URLs which the backend handles.
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

      return { success: true, payment: res.data.payment };
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to initiate payment";
      set({ loading: false, error: message });
      return { success: false, error: message };
    }
  },

  fetchPaymentByPickup: async (pickupId) => {
    try {
      const res = await api.get(`/payments/pickup/${pickupId}`);
      return { success: true, payment: res.data.payment };
    } catch (err) {
      return { success: false, error: err.response?.data?.message };
    }
  },

  // Driver-only: confirm cash collected after a completed pickup
  markCashCollected: async (pickupId) => {
    try {
      const res = await api.post(`/payments/${pickupId}/cash-collected`);
      return { success: true, payment: res.data.payment };
    } catch (err) {
      return { success: false, error: err.response?.data?.message };
    }
  },

  reset: () => set({ loading: false, error: null, lastPayment: null }),
}));

export default usePaymentStore;
