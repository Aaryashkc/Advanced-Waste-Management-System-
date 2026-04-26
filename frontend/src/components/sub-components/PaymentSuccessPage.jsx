import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Receipt, Smartphone, Hash, Calendar, Loader2, MapPin, Tag } from "lucide-react";
import api from "../../utils/api";

/**
 * eSewa redirects the customer's browser here after a successful payment
 * (the backend's /api/payments/esewa/success handler issues a 302 to
 * `${FRONTEND_URL}/payment-success?pickupId=...`).
 *
 * We fetch both the pickup + the latest payment record so the customer
 * sees a full receipt with the eSewa reference id.
 */
export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pickupId = params.get("pickupId");

  const [loading, setLoading] = useState(true);
  const [pickup, setPickup] = useState(null);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    localStorage.removeItem("pending-pickup-payment");
    if (!pickupId) {
      setError("Missing pickup reference.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [pRes, payRes] = await Promise.all([
          api.get(`/pickups/${pickupId}`),
          api.get(`/payments/pickup/${pickupId}`),
        ]);
        if (cancelled) return;
        setPickup(pRes.data?.pickup || null);
        setPayment(payRes.data?.payment || null);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load payment details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pickupId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ed] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#296200]">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm font-bold">Loading receipt…</p>
        </div>
      </div>
    );
  }

  const amount = payment?.amount ?? pickup?.estimatedPrice;
  const currency = pickup?.currency || "NPR";
  const refId = payment?.esewaRefId;
  const paidAt = payment?.paidAt ? new Date(payment.paidAt) : null;
  const loc = pickup?.location || {};

  return (
    <div className="min-h-screen bg-[#f7f4ed] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-3xl shadow-lg border border-primary/8 overflow-hidden max-w-lg w-full">
        {/* Green header band */}
        <div className="bg-gradient-to-br from-[#296200] to-[#3a8a00] px-8 py-10 text-center">
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1.5">Payment Successful!</h1>
          <p className="text-white/85 text-sm font-medium">
            Your eSewa payment has been confirmed
          </p>
        </div>

        {/* Body */}
        <div className="p-7 space-y-5">
          {/* Big amount card */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 p-5 text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 mb-1">
              Amount Paid
            </p>
            <p className="text-4xl font-extrabold text-emerald-900">
              {currency} {amount ?? "—"}
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-emerald-300">
              <Smartphone size={12} className="text-emerald-700" />
              <span className="text-[11px] font-bold text-emerald-800">PAID VIA eSEWA</span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-2.5 text-xs font-semibold text-amber-800">
              {error}
            </div>
          )}

          {/* Receipt details */}
          <div className="rounded-2xl border border-primary/10 overflow-hidden">
            <div className="px-5 py-3 bg-primary/5 border-b border-primary/10 flex items-center gap-2">
              <Receipt size={14} className="text-primary/70" />
              <p className="text-xs font-extrabold text-primary/70 uppercase tracking-wider">
                Transaction Details
              </p>
            </div>
            <div className="divide-y divide-primary/5">
              {refId && (
                <DetailRow
                  icon={<Hash size={14} />}
                  label="eSewa Ref ID"
                  value={<span className="font-mono">{refId}</span>}
                />
              )}
              {pickupId && (
                <DetailRow
                  icon={<Hash size={14} />}
                  label="Pickup ID"
                  value={<span className="font-mono">{pickupId.slice(-8).toUpperCase()}</span>}
                />
              )}
              {paidAt && (
                <DetailRow
                  icon={<Calendar size={14} />}
                  label="Paid At"
                  value={paidAt.toLocaleString()}
                />
              )}
              {pickup?.category && (
                <DetailRow
                  icon={<Tag size={14} />}
                  label="Category"
                  value={<span className="capitalize">{pickup.category}</span>}
                />
              )}
              {(loc.address || loc.latitude) && (
                <DetailRow
                  icon={<MapPin size={14} />}
                  label="Location"
                  value={loc.address || `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`}
                />
              )}
            </div>
          </div>

          <p className="text-center text-xs text-primary/55 font-medium">
            A copy of this receipt is available in your pickup history.
            The driver will not collect cash for this pickup.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate("/customer-dashboard")}
              className="flex-1 py-3 bg-[#296200] text-white font-extrabold rounded-2xl hover:bg-[#245400] active:scale-[0.97] transition-all shadow-md shadow-[#296200]/20 text-sm"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate("/schedule")}
              className="flex-1 py-3 border-2 border-primary/20 text-primary font-extrabold rounded-2xl hover:bg-primary/5 active:scale-[0.97] transition-all text-sm"
            >
              View History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="px-5 py-3.5 flex items-center justify-between gap-3">
      <span className="text-xs text-primary/60 font-semibold flex items-center gap-2 shrink-0">
        <span className="text-primary/50">{icon}</span>
        {label}
      </span>
      <span className="text-sm font-bold text-primary text-right truncate max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
