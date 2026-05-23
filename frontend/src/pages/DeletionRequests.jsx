import React, { useCallback, useEffect, useState } from "react";
import useAuthStore from "../stores/useAuthStore";
import api from "../utils/api";
import PaginationControls from "../components/shared/PaginationControls";
import { AdminEmptyState, AdminErrorState, ListSkeleton } from "../components/shared/AdminListStates";
import { ClipboardList } from "lucide-react";

const DeletionRequests = ({ onUpdate }) => {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const url = isSuperAdmin
        ? `/super-admin/deletion-requests?page=${page}&limit=10${filter ? `&status=${filter}` : ""}`
        : `/org-admin/deletion-requests?page=${page}&limit=10`;
      const res = await api.get(url);
      setRequests(res.data.data || []);
      setPagination(res.data.pagination || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch requests");
    }
    setIsLoading(false);
  }, [filter, isSuperAdmin, page]);

  useEffect(() => {
    const timer = setTimeout(fetchRequests, 0);
    return () => clearTimeout(timer);
  }, [fetchRequests]);

  const handleFilterChange = (nextFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  const handleReview = async (action) => {
    const previousRequests = requests;
    const nextStatus = action === "approved" ? "approved" : "rejected";
    setSubmitting(true);
    setRequests(prev => prev.map(r => r._id === reviewTarget._id ? { ...r, status: nextStatus, reviewNote } : r));
    try {
      await api.put(`/super-admin/deletion-requests/${reviewTarget._id}`, { action, reviewNote });
      setReviewTarget(null); setReviewNote("");
      fetchRequests();
      if (onUpdate) onUpdate();
    } catch (err) {
      setRequests(previousRequests);
      alert(err.response?.data?.message || "Failed to review request");
    }
    setSubmitting(false);
  };

  const statusColors = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">📋 Deletion Requests</h1>
          <p className="text-sm text-primary/60 mt-1">{isSuperAdmin ? "Review and approve/reject deletion requests from admins" : "Track your submitted deletion requests"}</p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-1 bg-primary/5 rounded-xl p-1">
            {["pending", "approved", "rejected", ""].map(f => (
              <button key={f} onClick={() => handleFilterChange(f)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filter === f ? "bg-white text-primary shadow-sm" : "text-primary/50 hover:text-primary"}`}>
                {f || "All"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {isSuperAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-primary/10 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">⏳</div>
            <div><p className="text-xs text-primary/50 uppercase tracking-wider font-medium">Pending</p><p className="text-2xl font-bold text-amber-600">{requests.filter(r => r.status === "pending").length}</p></div>
          </div>
          <div className="bg-white rounded-2xl border border-primary/10 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">✅</div>
            <div><p className="text-xs text-primary/50 uppercase tracking-wider font-medium">Approved</p><p className="text-2xl font-bold text-green-600">{requests.filter(r => r.status === "approved").length}</p></div>
          </div>
          <div className="bg-white rounded-2xl border border-primary/10 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-2xl">❌</div>
            <div><p className="text-xs text-primary/50 uppercase tracking-wider font-medium">Rejected</p><p className="text-2xl font-bold text-red-600">{requests.filter(r => r.status === "rejected").length}</p></div>
          </div>
        </div>
      )}

      {/* Request Cards */}
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <AdminErrorState message={error} onRetry={fetchRequests} />
      ) : requests.length === 0 ? (
        <AdminEmptyState icon={ClipboardList} title="No deletion requests found" message={isSuperAdmin ? "Requests from organization admins will appear here." : "Submitted deletion requests will appear here."} />
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r._id} className="bg-white rounded-2xl border border-primary/10 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{r.type === "vehicle" ? "🚛" : "👤"}</span>
                    <h3 className="text-lg font-bold text-primary">{r.targetName}</h3>
                    <span className={`px-3 py-0.5 rounded-full text-xs font-semibold uppercase ${statusColors[r.status]}`}>{r.status}</span>
                    <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-primary/5 text-primary/60">{r.type}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-primary/70"><span className="font-medium">Reason:</span> {r.reason}</p>
                    <p className="text-primary/50">
                      Requested by <strong>{r.requestedBy?.name}</strong> ({r.requestedBy?.email})
                      {r.orgId?.name && <> · Org: <strong>{r.orgId.name}</strong></>}
                      {" · "}{new Date(r.createdAt).toLocaleDateString()}
                    </p>
                    {r.status !== "pending" && r.reviewedBy && (
                      <p className="text-primary/50">
                        Reviewed by <strong>{r.reviewedBy.name}</strong>
                        {r.reviewNote && <> — "{r.reviewNote}"</>}
                        {" · "}{r.reviewedAt && new Date(r.reviewedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                {isSuperAdmin && r.status === "pending" && (
                  <button onClick={() => { setReviewTarget(r); setReviewNote(""); }} className="px-4 py-2 text-sm font-semibold text-primary bg-accent rounded-xl hover:brightness-110 transition whitespace-nowrap">
                    Review
                  </button>
                )}
              </div>
            </div>
          ))}
          <PaginationControls
            pagination={pagination}
            onPageChange={setPage}
            itemLabel="requests"
          />
        </div>
      )}

      {/* ===== Review Modal ===== */}
      {reviewTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative">
            <button onClick={() => setReviewTarget(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">✕</button>
            <h2 className="text-xl font-bold text-primary mb-4">Review Deletion Request</h2>

            <div className="space-y-3 mb-6">
              <div className="p-4 rounded-xl bg-primary/3 border border-primary/10 space-y-2">
                <div className="flex items-center gap-2"><span className="text-lg">{reviewTarget.type === "vehicle" ? "🚛" : "👤"}</span><strong className="text-primary">{reviewTarget.targetName}</strong><span className="text-xs text-primary/50 uppercase">({reviewTarget.type})</span></div>
                <p className="text-sm text-primary/70"><strong>Reason:</strong> {reviewTarget.reason}</p>
                <p className="text-sm text-primary/50">From: {reviewTarget.requestedBy?.name} · {reviewTarget.orgId?.name} · {new Date(reviewTarget.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-primary/70 mb-1">Review Note (optional)</label>
              <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2} placeholder="Add a note..." className="w-full px-4 py-2.5 rounded-xl border border-primary/15 focus:outline-none focus:ring-2 focus:ring-accent resize-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => handleReview("approved")} disabled={submitting} className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition disabled:opacity-50">
                {submitting ? "..." : "✅ Approve & Delete"}
              </button>
              <button onClick={() => handleReview("rejected")} disabled={submitting} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition disabled:opacity-50">
                {submitting ? "..." : "❌ Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeletionRequests;
