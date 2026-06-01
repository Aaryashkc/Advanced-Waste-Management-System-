import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Wallet,
  Calendar,
  History,
  Ban,
  DollarSign,
} from "lucide-react";
import useBillingStore from "../../stores/useBillingStore";
import useAuthStore from "../../stores/useAuthStore";
import { themeColor } from "../../utils/themeColors";

const DASHBOARD_BG =
  "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=1920&auto=format&fit=crop";

const STATUS_CONFIG = {
  UNPAID: { color: themeColor("warning"), bg: "bg-amber-500/15", border: "border-amber-500/30", label: "Unpaid", icon: Clock },
  CASH_PENDING: { color: themeColor("info"), bg: "bg-blue-500/15", border: "border-blue-500/30", label: "Cash Pending", icon: Wallet },
  OVERDUE: { color: themeColor("danger"), bg: "bg-red-500/15", border: "border-red-500/30", label: "Overdue", icon: AlertTriangle },
  PAID: { color: themeColor("successStrong"), bg: "bg-emerald-500/15", border: "border-emerald-500/30", label: "Paid", icon: CheckCircle2 },
  WAIVED: { color: themeColor("violet"), bg: "bg-violet-500/15", border: "border-violet-500/30", label: "Waived", icon: Ban },
};

function formatPeriod(month, year) {
  const d = new Date(year, month - 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function BillingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { bills, summary, loading, error, fetchMyBills, payBill } = useBillingStore();
  const [activeTab, setActiveTab] = useState("bills"); // "bills" | "history"
  const [payingId, setPayingId] = useState(null);
  const [payMethod, setPayMethod] = useState(null);
  const [paymentNotice, setPaymentNotice] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchMyBills({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchMyBills]);

  useEffect(() => {
    const refetch = () => fetchMyBills();
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, 60000);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [fetchMyBills]);

  // Handle eSewa redirect query params
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      queueMicrotask(() => {
        setPaymentNotice({ type: "success", message: "eSewa payment successful! Your bill has been marked as paid." });
        setActiveTab("history");
      });
      fetchMyBills();
      // Clean up URL params
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("payment");
      nextParams.delete("billingId");
      setSearchParams(nextParams, { replace: true });
    } else if (payment === "failed") {
      const reason = searchParams.get("reason");
      queueMicrotask(() => {
        setPaymentNotice({ type: "error", message: `eSewa payment failed${reason ? ` (${reason.replace(/_/g, " ")})` : ""}. Please try again.` });
      });
      fetchMyBills();
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("payment");
      nextParams.delete("reason");
      setSearchParams(nextParams, { replace: true });
    }
  }, [fetchMyBills, searchParams, setSearchParams]);

  const handlePay = async (billingId, method) => {
    setPayingId(billingId);
    setPayMethod(method);
    const result = await payBill(billingId, method);
    // For eSewa, browser will redirect — don't clear state
    if (result.redirecting) return;
    setPayingId(null);
    setPayMethod(null);
    if (!result.success) {
      alert(result.error || "Payment failed");
    }
  };

  const unpaidBills = useMemo(
    () => bills.filter((b) => ["UNPAID", "OVERDUE", "CASH_PENDING"].includes(b.status)),
    [bills]
  );
  const paidBills = useMemo(
    () => bills.filter((b) => b.status === "PAID" || b.status === "WAIVED"),
    [bills]
  );

  return (
    <div className="relative min-h-screen font-['Outfit',sans-serif] bg-black">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${DASHBOARD_BG})` }}
      />
      <div className="fixed inset-0 z-0 bg-black/90 backdrop-blur-xs" />

      <div className="relative z-10 pt-24 pb-20">
        {/* Header */}
        <section className="pb-6 px-6 md:px-16 lg:px-24">
          <button
            onClick={() => navigate(user?.role === "admin" ? "/admin-dashboard" : "/customer-dashboard")}
            className="flex items-center gap-2 text-white/50 hover:text-white mb-6 transition text-sm"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>

          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block text-white/50 text-xs font-semibold tracking-widest uppercase mb-3">
              Billing
            </span>
            <h1 className="font-bold text-white text-3xl sm:text-4xl tracking-tight mb-3">
              Monthly Bills
            </h1>
            <p className="text-white/50 text-base max-w-xl mx-auto">
              Manage your monthly subscription payments for scheduled waste collection.
            </p>
          </div>
        </section>

        {/* Summary Cards */}
        {summary && (
          <section className="pb-6 px-6 md:px-16 lg:px-24">
            <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard
                icon={Receipt}
                label="Total Bills"
                value={summary.total}
                accent={themeColor("info")}
              />
              <SummaryCard
                icon={CheckCircle2}
                label="Paid"
                value={summary.paid}
                accent={themeColor("successStrong")}
              />
              <SummaryCard
                icon={Clock}
                label="Unpaid"
                value={summary.unpaid}
                accent={themeColor("warning")}
              />
              <SummaryCard
                icon={DollarSign}
                label="Amount Due"
                value={`NPR ${(summary.totalDue || 0).toLocaleString()}`}
                accent={themeColor("danger")}
              />
            </div>
          </section>
        )}

        {/* Payment Notice */}
        {paymentNotice && (
          <section className="pb-4 px-6 md:px-16 lg:px-24">
            <div className="max-w-4xl mx-auto">
              <div
                className={`flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 ${
                  paymentNotice.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  {paymentNotice.type === "success" ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <AlertTriangle size={20} />
                  )}
                  <p className="text-sm font-semibold">{paymentNotice.message}</p>
                </div>
                <button
                  onClick={() => setPaymentNotice(null)}
                  className="text-white/40 hover:text-white transition text-lg leading-none"
                >
                  &times;
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Tabs */}
        <section className="px-6 md:px-16 lg:px-24">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-1.5 mb-6">
              {[
                { key: "bills", label: "Current Bills", Icon: Wallet },
                { key: "history", label: "Payment History", Icon: History },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === tab.key
                      ? "bg-white/15 text-white"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <tab.Icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="px-6 md:px-16 lg:px-24">
          <div className="max-w-4xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="text-red-300">{error}</p>
              </div>
            ) : activeTab === "bills" ? (
              /* ── Current Bills ── */
              unpaidBills.length > 0 ? (
                <div className="space-y-4">
                  {unpaidBills.map((bill) => (
                    <BillCard
                      key={bill._id}
                      bill={bill}
                      onPay={handlePay}
                      payingId={payingId}
                      payMethod={payMethod}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title={bills.length === 0 ? "No bills issued yet" : "All caught up!"}
                  message={
                    bills.length === 0
                      ? "Monthly bills will appear here after they are generated by billing management."
                      : "You have no pending bills. Great job keeping up with payments."
                  }
                />
              )
            ) : (
              /* ── Payment History ── */
              paidBills.length > 0 ? (
                <div className="space-y-3">
                  {paidBills.map((bill) => (
                    <HistoryRow key={bill._id} bill={bill} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={History}
                  title="No payment history"
                  message="Your payment records will appear here after you pay your first bill."
                />
              )
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, accent }) {
  const IconComponent = icon;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center hover:bg-white/10 transition-all">
      <div
        className="w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center"
        style={{ backgroundColor: `${accent}20` }}
      >
        <IconComponent size={18} style={{ color: accent }} />
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-white/40 text-xs mt-0.5">{label}</p>
    </div>
  );
}

function BillCard({ bill, onPay, payingId, payMethod }) {
  const config = STATUS_CONFIG[bill.status] || STATUS_CONFIG.UNPAID;
  const isPaying = payingId === bill._id;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-white font-semibold text-lg">
            {formatPeriod(bill.billingMonth, bill.billingYear)}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-white/40 text-sm flex items-center gap-1">
              <Calendar size={13} />
              Due: {new Date(bill.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">
            NPR {bill.amount.toLocaleString()}
          </p>
          <span
            className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${config.bg} ${config.border}`}
            style={{ color: config.color }}
          >
            <config.icon size={12} />
            {config.label}
          </span>
        </div>
      </div>

      {/* Pay Buttons */}
      {(bill.status === "UNPAID" || bill.status === "OVERDUE") && (
        <div className="flex gap-3 pt-3 border-t border-white/10">
          <button
            onClick={() => onPay(bill._id, "esewa")}
            disabled={isPaying}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CreditCard size={16} />
            {isPaying && payMethod === "esewa" ? "Processing..." : "Pay with eSewa"}
          </button>
          <button
            onClick={() => onPay(bill._id, "cash")}
            disabled={isPaying}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wallet size={16} />
            {isPaying && payMethod === "cash" ? "Processing..." : "Pay Cash"}
          </button>
        </div>
      )}
      {bill.status === "CASH_PENDING" && (
        <div className="pt-3 border-t border-white/10">
          <p className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-200">
            Cash payment submitted. Waiting for admin confirmation.
          </p>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ bill }) {
  const config = STATUS_CONFIG[bill.status] || STATUS_CONFIG.PAID;
  return (
    <div className="flex items-center justify-between gap-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-5 py-4 hover:bg-white/10 transition-all">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <config.icon size={18} style={{ color: config.color }} />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">
            {formatPeriod(bill.billingMonth, bill.billingYear)}
          </p>
          <p className="text-white/40 text-xs mt-0.5">
            {bill.paidAt
              ? `Paid on ${new Date(bill.paidAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`
              : bill.status === "WAIVED"
              ? "Waived by admin"
              : ""}
            {bill.paymentMethod && ` via ${bill.paymentMethod}`}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-white font-bold">NPR {bill.amount.toLocaleString()}</p>
        <span
          className="text-xs font-semibold"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, message }) {
  const IconComponent = icon;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-4">
        <IconComponent size={32} className="text-white/30" />
      </div>
      <p className="text-white/60 font-semibold text-lg mb-1">{title}</p>
      <p className="text-sm text-white/40 max-w-md">{message}</p>
    </div>
  );
}

export default BillingPage;
