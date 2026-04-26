import { Banknote, Smartphone, CheckCircle2, Clock, XCircle } from "lucide-react";

/**
 * Driver-facing payment status banner.
 * Tells the driver clearly: was it pre-paid online, or do they need to collect cash?
 */
export default function PaymentBadge({ pickup, compact = false }) {
  if (!pickup) return null;
  const method = pickup.paymentMethod || "cash";
  const status = pickup.paymentStatus || "UNPAID";
  const amount = pickup.estimatedPrice;
  const currency = pickup.currency || "NPR";

  const isEsewa = method === "esewa";
  const isPaid = status === "PAID";
  const isFailed = status === "FAILED";
  const isPending = status === "PENDING";

  // Determine theme & message
  let theme, Icon, title, message;

  if (isEsewa && isPaid) {
    theme = { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-900", icon: "text-emerald-700" };
    Icon = CheckCircle2;
    title = "PAID ONLINE — eSewa";
    message = "Customer has already paid. Do NOT collect cash.";
  } else if (isEsewa && isPending) {
    theme = { bg: "bg-amber-100", border: "border-amber-400", text: "text-amber-900", icon: "text-amber-700" };
    Icon = Clock;
    title = "eSewa Payment Pending";
    message = "Awaiting gateway verification. Do not collect cash yet — confirm in app.";
  } else if (isEsewa && isFailed) {
    theme = { bg: "bg-red-100", border: "border-red-400", text: "text-red-900", icon: "text-red-700" };
    Icon = XCircle;
    title = "eSewa Payment FAILED";
    message = "Online payment failed. Collect cash on delivery.";
  } else {
    // cash (default)
    Icon = isPaid ? CheckCircle2 : Banknote;
    theme = isPaid
      ? { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-900", icon: "text-emerald-700" }
      : { bg: "bg-orange-100", border: "border-orange-400", text: "text-orange-900", icon: "text-orange-700" };
    title = isPaid ? "CASH RECEIVED" : "CASH ON DELIVERY";
    message = isPaid
      ? "Cash has been confirmed and the payment is now recorded."
      : `Collect ${currency} ${amount ?? "--"} from the customer, then tap Cash Received.`;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border-2 ${theme.bg} ${theme.border} px-3 py-2`}>
        <Icon size={16} className={theme.icon} />
        <div className="leading-tight">
          <p className={`text-[10px] font-extrabold uppercase tracking-wider ${theme.text}`}>{title}</p>
          <p className={`text-xs font-bold ${theme.text}`}>{currency} {amount ?? "—"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border-2 ${theme.bg} ${theme.border} p-4 flex items-start gap-3 shadow-sm`}>
      <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 border ${theme.border}`}>
        {isEsewa ? <Smartphone size={20} className={theme.icon} /> : <Icon size={20} className={theme.icon} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className={`text-xs font-extrabold uppercase tracking-wider ${theme.text}`}>{title}</p>
          <p className={`text-sm font-extrabold ${theme.text}`}>{currency} {amount ?? "—"}</p>
        </div>
        <p className={`text-xs font-semibold ${theme.text}`}>{message}</p>
      </div>
    </div>
  );
}
