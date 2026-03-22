import React, { useEffect, useState } from "react";
import useAdminStore from "../stores/useAdminStore";
import useAuthStore from "../stores/useAuthStore";

const Admins = () => {
  const { admins, orgName, isLoading, error, fetchAdmins, createAdmin, updateAdmin, deleteAdmin } = useAdminStore();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [showAdd, setShowAdd] = useState(false);
  const [editAdmin, setEditAdmin] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [editForm, setEditForm] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name || !form.email || !form.password) { setFormError("Name, email, and password are required"); return; }
    setSubmitting(true);
    const result = await createAdmin(form);
    setSubmitting(false);
    if (result.success) { setShowAdd(false); setForm({ name: "", email: "", phone: "", password: "" }); }
    else setFormError(result.error);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    const result = await updateAdmin(editAdmin.id, editForm);
    setSubmitting(false);
    if (result.success) setEditAdmin(null);
    else setFormError(result.error);
  };

  const openEdit = (a) => {
    setEditAdmin(a);
    setEditForm({ name: a.name, email: a.email, phone: a.phone });
    setFormError("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary)]">👥 Admin Management</h1>
          <p className="text-sm text-[var(--primary)]/60 mt-1">Manage admins for <strong>{orgName}</strong></p>
        </div>
        <button onClick={() => { setShowAdd(true); setFormError(""); }} className="px-5 py-2.5 bg-[var(--accent)] text-[var(--primary)] font-semibold rounded-xl shadow-sm hover:shadow-md hover:brightness-110 transition-all flex items-center gap-2">
          <span className="text-lg">+</span> Add Admin
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl">👥</div>
          <div>
            <p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Total Admins</p>
            <p className="text-2xl font-bold text-[var(--primary)]">{admins.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">🏢</div>
          <div>
            <p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Organization</p>
            <p className="text-lg font-bold text-[var(--primary)]">{orgName}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 bg-white/50 rounded-2xl border border-[var(--primary)]/10">
          <div className="w-8 h-8 border-4 border-[var(--primary)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 rounded-2xl border border-red-200 text-red-600 text-center font-medium">{error}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--primary)]/10 bg-[var(--primary)]/[0.03]">
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Phone</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Joined</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-[var(--primary)]/40">No admins found. Add your first admin!</td></tr>
                ) : admins.map(a => (
                  <tr key={a.id} className="border-b border-[var(--primary)]/5 hover:bg-[var(--accent)]/5 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                          {a.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <span className="font-semibold text-[var(--primary)]">{a.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--primary)]/70">{a.email}</td>
                    <td className="px-5 py-3.5 text-[var(--primary)]/70">{a.phone || "—"}</td>
                    <td className="px-5 py-3.5 text-[var(--primary)]/50 text-sm">{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openEdit(a)} className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] bg-[var(--primary)]/5 rounded-lg hover:bg-[var(--primary)]/10 transition">Edit</button>
                        {isSuperAdmin && (
                          <button onClick={() => { setDeleteTarget(a); setFormError(""); }} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Add Admin Modal ===== */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setShowAdd(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-6">Add New Admin</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Full Name</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Hari Bahadur" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="admin@example.com" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="98XXXXXXXX" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Password</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--accent)] text-[var(--primary)] font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
                {submitting ? "Creating..." : "Create Admin"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Delete Admin Modal ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setDeleteTarget(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">&#x2715;</button>
            <h2 className="text-xl font-bold text-red-600 mb-2">Delete Admin</h2>
            <p className="text-sm text-[var(--primary)]/60 mb-4">Admin: <strong>{deleteTarget.name}</strong></p>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">This will permanently delete this admin from the database. This action cannot be undone.</p>
              </div>
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button
                onClick={async () => {
                  setSubmitting(true);
                  const result = await deleteAdmin(deleteTarget.id);
                  setSubmitting(false);
                  if (result.success) setDeleteTarget(null);
                  else setFormError(result.error);
                }}
                disabled={submitting}
                className="w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition disabled:opacity-50"
              >
                {submitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Edit Admin Modal ===== */}
      {editAdmin && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setEditAdmin(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-6">Edit Admin — {editAdmin.name}</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Full Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Phone</label>
                <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--accent)] text-[var(--primary)] font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admins;
