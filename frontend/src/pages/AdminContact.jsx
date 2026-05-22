import { createElement, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Mail, MessageSquare, RefreshCw, Send, Trash2 } from "lucide-react";
import api from "../utils/api";
import useAuthStore from "../stores/useAuthStore";

export default function AdminContact() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === "super_admin";
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/contact/messages");
      setMessages(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load contact messages");
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) fetchMessages();
    else setLoading(false);
  }, [fetchMessages, isSuperAdmin]);

  const markRead = async (id) => {
    setMarkingId(id);
    try {
      await api.put(`/contact/${id}/read`);
      setMessages((items) => items.map((item) => item._id === id ? { ...item, status: "read" } : item));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to mark message as read");
    } finally {
      setMarkingId(null);
    }
  };

  const deleteMessage = async (id) => {
    const confirmed = window.confirm("Delete this contact message permanently?");
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);
    try {
      await api.delete(`/contact/${id}`);
      setMessages((items) => items.filter((item) => item._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete contact message");
    } finally {
      setDeletingId(null);
    }
  };

  const unread = messages.filter((message) => message.status === "unread").length;

  const submitComplaint = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitted(false);

    if (!form.subject.trim() || !form.message.trim()) {
      setError("Subject and message are required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/contact/admin-submit", {
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSubmitted(true);
      setForm({ subject: "", message: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Contact Support</h1>
          <p className="text-sm text-primary/50 mt-1">
            Send complaints, organization issues, or dashboard support requests to the super admin team.
          </p>
        </div>

        <div className="rounded-xl border border-primary/10 bg-white p-6 shadow-sm max-w-3xl">
          {submitted && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Message sent successfully.
            </div>
          )}
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={submitComplaint} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-primary/60 mb-1">Subject</label>
              <input
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                placeholder="What is this about?"
                className="w-full rounded-lg border border-primary/12 px-4 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary/60 mb-1">Message</label>
              <textarea
                rows={6}
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                placeholder="Describe the complaint or support issue..."
                className="w-full resize-none rounded-lg border border-primary/12 px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Contact Messages</h1>
          <p className="text-sm text-primary/50 mt-1">Review customer contact requests and support notes.</p>
        </div>
        <button
          onClick={fetchMessages}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={Mail} label="Total Messages" value={messages.length} />
        <SummaryCard icon={MessageSquare} label="Unread" value={unread} accent="text-amber-600" />
        <SummaryCard icon={CheckCircle2} label="Read" value={messages.length - unread} accent="text-emerald-600" />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-primary/10 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-primary/50">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <Mail className="h-8 w-8 text-primary/25 mb-3" />
            <p className="text-sm font-semibold text-primary/60">No contact messages yet</p>
          </div>
        ) : (
          <div className="divide-y divide-primary/8">
            {messages.map((message) => {
              const personName = message.userId?.name || message.name || "Unknown person";
              const personEmail = message.userId?.email || message.email || "";
              const role = message.userId?.role || message.role;
              const orgName = message.orgId?.name || message.orgName || "No organization";

              return (
                <div key={message._id} className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-primary">{message.subject || "Support request"}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${message.status === "unread" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {message.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-primary/5 px-2.5 py-1 font-medium text-primary/60">
                          Person: {personName}{role ? ` (${role.replace("_", " ")})` : ""}
                        </span>
                        <span className="rounded-full bg-primary/5 px-2.5 py-1 font-medium text-primary/60">
                          Org: {orgName}
                        </span>
                      </div>
                      {personEmail && <p className="text-sm text-primary/50 mt-2">{personEmail}</p>}
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-primary/75">{message.message}</p>
                      <p className="mt-3 text-xs text-primary/35">
                        {message.createdAt ? new Date(message.createdAt).toLocaleString() : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      {message.status === "unread" && (
                        <button
                          onClick={() => markRead(message._id)}
                          disabled={markingId === message._id || deletingId === message._id}
                          className="rounded-lg border border-primary/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                        >
                          {markingId === message._id ? "Saving..." : "Mark Read"}
                        </button>
                      )}
                      <button
                        onClick={() => deleteMessage(message._id)}
                        disabled={deletingId === message._id || markingId === message._id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === message._id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, accent = "text-primary" }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/40">{label}</p>
          <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/8">
          {createElement(Icon, { className: "h-5 w-5 text-primary/60" })}
        </span>
      </div>
    </div>
  );
}
