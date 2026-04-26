import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  History,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import useBillingStore from "../stores/useBillingStore";
import useAuthStore from "../stores/useAuthStore";

const STATUS_CONFIG = {
  UNPAID: { label: "Unpaid", icon: Clock, badge: "bg-amber-50 text-amber-700 border-amber-200/60", accent: "text-amber-600", iconBg: "bg-amber-100" },
  OVERDUE: { label: "Overdue", icon: AlertTriangle, badge: "bg-red-50 text-red-700 border-red-200/60", accent: "text-red-600", iconBg: "bg-red-100" },
  PAID: { label: "Paid", icon: CheckCircle2, badge: "bg-green-50 text-green-700 border-green-200/60", accent: "text-green-600", iconBg: "bg-green-100" },
  WAIVED: { label: "Waived", icon: Ban, badge: "bg-violet-50 text-violet-700 border-violet-200/60", accent: "text-violet-600", iconBg: "bg-violet-100" },
};

function formatPeriod(month, year) {
  const d = new Date(year, month - 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function AdminBilling() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { bills, summary, loading, error, fetchMyBills, payBill } = useBillingStore();
  const [activeTab, setActiveTab] = useState("current");
  const [payingId, setPayingId] = useState(null);
  const [payMethod, setPayMethod] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    fetchMyBills();
  }, [fetchMyBills]);

  useEffect(() => {
    const refetch = () => fetchMyBills();
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchMyBills]);

  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      setNotice({ type: "success", text: "Payment received. This month now shows paid for admins in your organization." });
      setActiveTab("history");
      fetchMyBills();
      searchParams.delete("payment");
      searchParams.delete("billingId");
      setSearchParams(searchParams, { replace: true });
    } else if (payment === "failed") {
      const reason = searchParams.get("reason");
      setNotice({ type: "error", text: `Payment failed${reason ? ` (${reason.replace(/_/g, " ")})` : ""}. Please try again.` });
      fetchMyBills();
      searchParams.delete("payment");
      searchParams.delete("reason");
      setSearchParams(searchParams, { replace: true });
    }
  }, [fetchMyBills, searchParams, setSearchParams]);

  const handlePay = async (billingId, method) => {
    setPayingId(billingId);
    setPayMethod(method);
    const result = await payBill(billingId, method);
    if (result.redirecting) return;
    setPayingId(null);
    setPayMethod(null);
    if (!result.success) {
      setNotice({ type: "error", text: result.error || "Payment failed. Please try again." });
    } else {
      setNotice({ type: "success", text: "Payment marked paid for your organization admins." });
      setActiveTab("history");
    }
  };

  const openBills = bills.filter((bill) => bill.status === "UNPAID" || bill.status === "OVERDUE");
  const resolvedBills = bills.filter((bill) => bill.status === "PAID" || bill.status === "WAIVED");
  const nextBill = openBills[0];
  const orgName = user?.orgId?.name || user?.organization?.name || "Your Organization";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight">Admin Billing</h2>
          <p className="text-sm text-primary/50 mt-1">
            Pay and track monthly admin subscription bills for {orgName}.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-primary/10 bg-white px-4 py-2 text-sm font-semibold text-primary/70">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Shared org admin billing
        </div>
      </div>

      {notice && (
        <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
          notice.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-current/60 hover:text-current">
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Receipt} label="Total Bills" value={summary?.total || 0} color="text-primary" bg="bg-primary/8" />
        <SummaryCard icon={CheckCircle2} label="Paid" value={summary?.paid || 0} color="text-green-600" bg="bg-green-100" />
        <SummaryCard icon={Clock} label="Open" value={summary?.unpaid || 0} color="text-amber-600" bg="bg-amber-100" />
        <SummaryCard icon={DollarSign} label="Amount Due" value={`NPR ${(summary?.totalDue || 0).toLocaleString()}`} color="text-red-600" bg="bg-red-100" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.5fr)]">
        <section className="rounded-2xl border border-primary/10 bg-white p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary">Current Admin Bill</h3>
              <p className="text-xs text-primary/45">One paid admin bill covers all admins in this org for the month.</p>
            </div>
          </div>

          {loading ? (
            <Loader />
          ) : error ? (
            <ErrorState message={error} />
          ) : nextBill ? (
            <CurrentBill bill={nextBill} payingId={payingId} payMethod={payMethod} onPay={handlePay} />
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title={bills.length === 0 ? "No admin bills issued yet" : "No pending admin bills"}
              message={bills.length === 0 ? "Generated monthly admin bills will appear here." : "Your organization admins are paid up for the visible billing periods."}
            />
          )}
        </section>

        <section className="rounded-2xl border border-primary/10 bg-white overflow-hidden">
          <div className="flex gap-1 border-b border-primary/10 bg-primary/[0.03] p-1.5">
            {[
              { id: "current", label: "Open Bills", icon: Wallet },
              { id: "history", label: "Payment History", icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-white text-primary shadow-sm"
                    : "text-primary/45 hover:text-primary"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {loading ? (
              <Loader />
            ) : error ? (
              <ErrorState message={error} />
            ) : activeTab === "current" ? (
              openBills.length > 0 ? (
                <div className="space-y-3">
                  {openBills.map((bill) => (
                    <BillRow key={bill._id} bill={bill} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={CheckCircle2} title="All clear" message="There are no unpaid admin bills right now." />
              )
            ) : resolvedBills.length > 0 ? (
              <div className="space-y-3">
                {resolvedBills.map((bill) => (
                  <BillRow key={bill._id} bill={bill} />
                ))}
              </div>
            ) : (
              <EmptyState icon={History} title="No history yet" message="Paid and waived admin bills will appear here." />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CurrentBill({ bill, payingId, payMethod, onPay }) {
  const config = STATUS_CONFIG[bill.status] || STATUS_CONFIG.UNPAID;
  const isPaying = payingId === bill._id;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary/50">Billing Period</p>
            <p className="mt-1 text-2xl font-bold text-primary">{formatPeriod(bill.billingMonth, bill.billingYear)}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary/45">
              <Calendar className="h-4 w-4" />
              Due {new Date(bill.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase ${config.badge}`}>
            <config.icon className="h-3.5 w-3.5" />
            {config.label}
          </span>
        </div>
        <div className="mt-6">
          <p className="text-sm font-semibold text-primary/45">Amount</p>
          <p className="text-4xl font-bold text-primary">NPR {bill.amount.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onPay(bill._id, "esewa")}
          disabled={isPaying}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <CreditCard className="h-4 w-4" />
          {isPaying && payMethod === "esewa" ? "Processing..." : "Pay with eSewa"}
        </button>
        <button
          type="button"
          onClick={() => onPay(bill._id, "cash")}
          disabled={isPaying}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/15 bg-white px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary/5 disabled:opacity-50"
        >
          <Wallet className="h-4 w-4" />
          {isPaying && payMethod === "cash" ? "Processing..." : "Pay Cash"}
        </button>
      </div>
    </div>
  );
}

function BillRow({ bill }) {
  const config = STATUS_CONFIG[bill.status] || STATUS_CONFIG.UNPAID;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.iconBg}`}>
          <config.icon className={`h-5 w-5 ${config.accent}`} />
        </div>
        <div>
          <p className="text-sm font-bold text-primary">{formatPeriod(bill.billingMonth, bill.billingYear)}</p>
          <p className="text-xs text-primary/45">
            {bill.paidAt
              ? `Paid ${new Date(bill.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : `Due ${new Date(bill.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
            {bill.paymentMethod ? ` via ${bill.paymentMethod}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <p className="text-sm font-bold text-primary">NPR {bill.amount.toLocaleString()}</p>
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${config.badge}`}>
          {config.label}
        </span>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-4">
      <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-4.5 w-4.5 ${color}`} />
      </div>
      <p className="text-xl font-bold text-primary">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase text-primary/40">{label}</p>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <AlertTriangle className="mb-3 h-10 w-10 text-red-400" />
      <p className="text-sm font-medium text-red-600">{message}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5">
        <Icon className="h-7 w-7 text-primary/25" />
      </div>
      <p className="text-base font-bold text-primary/70">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-primary/40">{message}</p>
    </div>
  );
}
