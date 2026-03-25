import { useEffect, useState } from "react";
import usePricingStore from "../stores/usePricingStore";
import useAuthStore from "../stores/useAuthStore";
import { DollarSign, Save, RefreshCw } from "lucide-react";

const PricingConfig = () => {
  const { config, loading, error, saving, fetchPricingConfig, updatePricingConfig } = usePricingStore();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [form, setForm] = useState(null);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    fetchPricingConfig();
  }, [fetchPricingConfig]);

  useEffect(() => {
    if (config) {
      setForm({
        recyclable: config.categoryBase?.recyclable ?? 500,
        nonRecyclable: config.categoryBase?.nonRecyclable ?? 800,
        mixed: config.categoryBase?.mixed ?? 1000,
        easy: config.levelMultiplier?.easy ?? 1.0,
        medium: config.levelMultiplier?.medium ?? 2.5,
        hard: config.levelMultiplier?.hard ?? 5.0,
        distanceRatePerKm: config.distanceRatePerKm ?? 50,
        minimumCharge: config.minimumCharge ?? 500,
      });
    }
  }, [config]);

  const handleChange = (field, value) => {
    if (!isSuperAdmin) return;
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaveMsg("");
  };

  const handleSave = async () => {
    if (!isSuperAdmin || !form) return;
    const result = await updatePricingConfig({
      categoryBase: {
        recyclable: Number(form.recyclable),
        nonRecyclable: Number(form.nonRecyclable),
        mixed: Number(form.mixed),
      },
      levelMultiplier: {
        easy: Number(form.easy),
        medium: Number(form.medium),
        hard: Number(form.hard),
      },
      distanceRatePerKm: Number(form.distanceRatePerKm),
      minimumCharge: Number(form.minimumCharge),
    });
    if (result.success) {
      setSaveMsg("Pricing updated successfully!");
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-primary/70 font-['Poppins',sans-serif]">Loading pricing config...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-600">{error}</p>
        <button onClick={fetchPricingConfig} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary font-['Outfit',sans-serif] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            Pricing Configuration
          </h1>
          <p className="mt-1 text-sm text-primary/60 font-['Poppins',sans-serif]">
            {isSuperAdmin ? "Manage pickup pricing rates" : "View current pickup pricing rates (read-only)"}
          </p>
        </div>
        {config?.updatedAt && (
          <p className="text-xs text-primary/40 font-['Poppins',sans-serif]">
            Last updated: {new Date(config.updatedAt).toLocaleString()}
            {config.updatedBy?.name && ` by ${config.updatedBy.name}`}
          </p>
        )}
      </div>

      {/* Category Base Rates */}
      <section className="rounded-2xl border border-primary/15 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="font-['Outfit',sans-serif] text-lg font-semibold text-primary mb-4">
          Category Base Rates
        </h2>
        <p className="text-xs text-primary/50 mb-4 font-['Poppins',sans-serif]">
          Base price in NPR for each waste category before multipliers are applied.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <PriceField
            label="Recyclable"
            tag="BIO"
            value={form.recyclable}
            onChange={(v) => handleChange("recyclable", v)}
            readOnly={!isSuperAdmin}
            color="green"
          />
          <PriceField
            label="Non-Recyclable"
            tag="NON"
            value={form.nonRecyclable}
            onChange={(v) => handleChange("nonRecyclable", v)}
            readOnly={!isSuperAdmin}
            color="red"
          />
          <PriceField
            label="Mixed"
            tag="MIX"
            value={form.mixed}
            onChange={(v) => handleChange("mixed", v)}
            readOnly={!isSuperAdmin}
            color="amber"
          />
        </div>
      </section>

      {/* Level Multipliers */}
      <section className="rounded-2xl border border-primary/15 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="font-['Outfit',sans-serif] text-lg font-semibold text-primary mb-4">
          Level Multipliers
        </h2>
        <p className="text-xs text-primary/50 mb-4 font-['Poppins',sans-serif]">
          Multiplier applied to the base rate based on waste difficulty level.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MultiplierField
            label="Easy"
            desc="< 1,000 kg"
            value={form.easy}
            onChange={(v) => handleChange("easy", v)}
            readOnly={!isSuperAdmin}
          />
          <MultiplierField
            label="Medium"
            desc="1,000 – 5,000 kg"
            value={form.medium}
            onChange={(v) => handleChange("medium", v)}
            readOnly={!isSuperAdmin}
          />
          <MultiplierField
            label="Hard"
            desc="> 5,000 kg"
            value={form.hard}
            onChange={(v) => handleChange("hard", v)}
            readOnly={!isSuperAdmin}
          />
        </div>
      </section>

      {/* Distance & Minimum */}
      <section className="rounded-2xl border border-primary/15 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="font-['Outfit',sans-serif] text-lg font-semibold text-primary mb-4">
          Distance & Minimum Charge
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-primary/10 bg-[#f7f5ef] p-4">
            <label className="block text-xs uppercase tracking-wider text-primary/50 font-semibold mb-2">
              Rate per Kilometer (NPR)
            </label>
            <input
              type="number"
              min="0"
              value={form.distanceRatePerKm}
              onChange={(e) => handleChange("distanceRatePerKm", e.target.value)}
              readOnly={!isSuperAdmin}
              className={`w-full px-4 py-3 rounded-xl border border-primary/20 text-primary text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                !isSuperAdmin ? "bg-gray-50 cursor-not-allowed" : "bg-white"
              }`}
            />
          </div>
          <div className="rounded-xl border border-primary/10 bg-[#f7f5ef] p-4">
            <label className="block text-xs uppercase tracking-wider text-primary/50 font-semibold mb-2">
              Minimum Charge (NPR)
            </label>
            <input
              type="number"
              min="0"
              value={form.minimumCharge}
              onChange={(e) => handleChange("minimumCharge", e.target.value)}
              readOnly={!isSuperAdmin}
              className={`w-full px-4 py-3 rounded-xl border border-primary/20 text-primary text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                !isSuperAdmin ? "bg-gray-50 cursor-not-allowed" : "bg-white"
              }`}
            />
          </div>
        </div>
      </section>

      {/* Formula Preview */}
      <section className="rounded-2xl border border-primary/10 bg-[linear-gradient(120deg,#f3f9ed,#f9f5ec)] p-5 sm:p-6 shadow-sm">
        <h3 className="font-['Outfit',sans-serif] text-base font-semibold text-primary mb-3">
          Pricing Formula
        </h3>
        <div className="bg-white/80 rounded-xl border border-primary/10 p-4 font-mono text-sm text-primary/80">
          <p>total = max(minimumCharge, categoryBase × levelMultiplier + distance × ratePerKm)</p>
          <p className="mt-2 text-xs text-primary/50">
            Example: Non-recyclable + Medium + 10 km = max({form.minimumCharge}, {form.nonRecyclable} × {form.medium} + 10 × {form.distanceRatePerKm}) = <strong>NPR {Math.max(Number(form.minimumCharge), Number(form.nonRecyclable) * Number(form.medium) + 10 * Number(form.distanceRatePerKm))}</strong>
          </p>
        </div>
      </section>

      {/* Save Button */}
      {isSuperAdmin && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all shadow-sm ${
              saving ? "bg-gray-400 cursor-not-allowed" : "bg-primary hover:opacity-95 active:scale-95"
            }`}
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {saveMsg && (
            <span className="text-sm font-medium text-green-600">{saveMsg}</span>
          )}
          {error && (
            <span className="text-sm font-medium text-red-600">{error}</span>
          )}
        </div>
      )}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

function PriceField({ label, tag, value, onChange, readOnly, color }) {
  const colorMap = {
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const tagStyle = colorMap[color] || colorMap.green;

  return (
    <div className="rounded-xl border border-primary/10 bg-[#f7f5ef] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${tagStyle}`}>
          {tag}
        </span>
        <span className="text-sm font-semibold text-primary">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-primary/50">NPR</span>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          className={`flex-1 px-3 py-2 rounded-lg border border-primary/15 text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 ${
            readOnly ? "bg-gray-50 cursor-not-allowed" : "bg-white"
          }`}
        />
      </div>
    </div>
  );
}

function MultiplierField({ label, desc, value, onChange, readOnly }) {
  return (
    <div className="rounded-xl border border-primary/10 bg-[#f7f5ef] p-4">
      <div className="mb-2">
        <span className="text-sm font-semibold text-primary">{label}</span>
        <span className="ml-2 text-xs text-primary/40">{desc}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-primary/50">×</span>
        <input
          type="number"
          min="0"
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          className={`flex-1 px-3 py-2 rounded-lg border border-primary/15 text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 ${
            readOnly ? "bg-gray-50 cursor-not-allowed" : "bg-white"
          }`}
        />
      </div>
    </div>
  );
}

export default PricingConfig;
