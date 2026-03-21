import { create } from "zustand";
import api from "../utils/api";

const useUploadStore = create((set,) => ({
  lastUpload: null,
  loading: false,
  uploadProgress: 0,
  error: null,

  uploadWasteImage: async (file, category, level) => {
    set({ loading: true, error: null, uploadProgress: 0 });
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("category", category);
      formData.append("level", level);

      const response = await api.post("/user/upload-waste", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (ev) => {
          const pct = ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0;
          set({ uploadProgress: pct });
        },
      });

      const raw = response.data?.data ?? response.data;
      const data = {
        id: raw.id,
        url: raw.url ?? raw.secure_url,
        publicId: raw.publicId ?? raw.public_id,
        resource_type: raw.resource_type,
        created_at: raw.created_at ?? raw.uploadedAt,
        uploadedAt: raw.uploadedAt,
        category: raw.category,
        level: raw.level,
        expiresAt: raw.expiresAt,
      };
      set({
        lastUpload: data,
        loading: false,
        uploadProgress: 100,
        error: null,
      });
      return { success: true, data };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Upload failed";
      set({
        loading: false,
        uploadProgress: 0,
        error: message,
        lastUpload: null,
      });
      return { success: false, error: message };
    }
  },

  clearLastUpload: () => set({ lastUpload: null }),
  clearError: () => set({ error: null }),
  resetUploadState: () =>
    set({ lastUpload: null, error: null, uploadProgress: 0 }),
}));

export default useUploadStore;
