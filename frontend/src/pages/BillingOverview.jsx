import { useEffect, useState } from "react";
import {
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Ban,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Phone,
  Settings,
  Save,
  Users,
  UserCog,
} from "lucide-react";
import useBillingStore from "../stores/useBillingStore";
import useAuthStore from "../stores/useAuthStore";
import useOrganizationStore from "../stores/useOrganizationStore";

const STATUS_BADGE = {
  UNPAID: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200/60" },
  OVERDUE: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200/60" },
  PAID: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200/60" },
  WAIVED: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200/60" },
};

function formatPeriod(month, year) {
  const d = new Date(year, month - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function BillingOverview() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "super_admin";
  const { organizations, fetchOrganizations } = useOrganizationStore();

  const {
    adminBills,
    adminSummary,
    defaulters,
    adminPagination,
    adminLoading,
    fetchBillingOverview,
    waiveBill,
    generateBills,
    billingConfigs,
    activeFees,
    defaults,
    fetchBillingConfig,
    updateBillingConfig,
  } = useBillingStore();

  // ── Tabs: "customer" or "admin" ──
  const [roleTab, setRoleTab] = useState("customer_admin");
  const [filters, setFilters] = useState({ status: "", month: "", year: "" });
  const [showConfig, setShowConfig] = useState(false);

  // Fee form
  const [customerFeeInput, setCustomerFeeInput] = useState("");
  const [adminFeeInput, setAdminFeeInput] = useState("");
  const [feeOrgId, setFeeOrgId] = useState("global");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState(null);
  const [generatingBills, setGeneratingBills] = useState(false);
  const [generationMsg, setGenerationMsg] = useState(null);

  const currentOverviewParams = (extra = {}) => {
    const params = { billedRole: roleTab, ...extra };
    if (filters.status) params.status = filters.status;
    if (filters.month) params.month = filters.month;
    if (filters.year) params.year = filters.year;
    return params;
  };

  // Load data on mount + when roleTab changes
  useEffect(() => {
    fetchBillingConfig();
  }, [fetchBillingConfig]);

  useEffect(() => {
    if (isSuperAdmin) fetchOrganizations();
  }, [isSuperAdmin, fetchOrganizations]);

  useEffect(() => {
    fetchBillingOverview(currentOverviewParams());
  }, [roleTab, fetchBillingOverview]);

  const getConfigOrgId = (config) => String(config?.orgId?._id || config?.orgId || "");
  const currentFeeOrgId = isSuperAdmin
    ? feeOrgId
    : String(user?.orgId?._id || user?.orgId || "");
  const globalConfig = billingConfigs.find((config) => !config.orgId);
  const selectedOrgConfig =
    currentFeeOrgId === "global"
      ? globalConfig
      : billingConfigs.find((config) => getConfigOrgId(config) === currentFeeOrgId);
  const selectedOrg = organizations.find((org) => String(org._id) === currentFeeOrgId);
  const selectedFees = {
    customerFee:
      selectedOrgConfig?.customerMonthlyFee ??
      globalConfig?.customerMonthlyFee ??
      activeFees?.customerFee ??
      defaults?.customerFee ??
      500,
    adminFee:
      selectedOrgConfig?.adminMonthlyFee ??
      globalConfig?.adminMonthlyFee ??
      activeFees?.adminFee ??
      defaults?.adminFee ??
      1000,
  };
  const selectedScopeLabel =
    !isSuperAdmin
      ? "Your Organization"
      : currentFeeOrgId === "global"
      ? "Global Default"
      : selectedOrg?.name || selectedOrgConfig?.orgId?.name || "Selected Organization";
  const selectedScopeHasOwnConfig = currentFeeOrgId === "global" || Boolean(selectedOrgConfig);

  // Pre-fill fee inputs when selected config changes.
  useEffect(() => {
    setCustomerFeeInput(String(selectedFees.customerFee));
    setAdminFeeInput(String(selectedFees.adminFee));
  }, [selectedFees.customerFee, selectedFees.adminFee]);

  const applyFilters = () => {
    fetchBillingOverview(currentOverviewParams());
  };

  const handleWaive = async (billingId) => {
    const notes = window.prompt("Reason for waiving this bill (optional):");
    if (notes === null) return;
    await waiveBill(billingId, notes || undefined);
  };

  const goToPage = (page) => {
    fetchBillingOverview(currentOverviewParams({ page }));
  };

  const handleGenerateBills = async () => {
    setGeneratingBills(true);
    setGenerationMsg(null);
    const result = await generateBills(currentOverviewParams());
    setGeneratingBills(false);
    if (result.success) {
      setGenerationMsg({
        type: "success",
        text: result.message || "Monthly bills generated",
      });
    } else {
      setGenerationMsg({
        type: "error",
        text: result.error || "Failed to generate bills",
      });
    }
    setTimeout(() => setGenerationMsg(null), 5000);
  };

  const handleSaveConfig = async () => {
    const cFee = parseFloat(customerFeeInput);
    const aFee = parseFloat(adminFeeInput);
    if (isNaN(cFee) || cFee < 0 || isNaN(aFee) || aFee < 0) {
      setConfigMsg({ type: "error", text: "Enter valid non-negative amounts" });
      return;
    }
    setSavingConfig(true);
    const orgId = isSuperAdmin
      ? feeOrgId === "global" ? null : feeOrgId
      : user?.orgId;
    try {
      const result = await updateBillingConfig({
        orgId,
        customerMonthlyFee: cFee,
        adminMonthlyFee: aFee,
      });
      setSavingConfig(false);
      if (result.success) {
        setConfigMsg({
          type: "success",
          text: `Fees saved for ${isSuperAdmin ? selectedScopeLabel : "your organization"}. Generate bills to apply them to current unpaid bills.`,
        });
        fetchBillingOverview(currentOverviewParams());
      } else {
        setConfigMsg({ type: "error", text: result.error || "Failed to save" });
      }
    } catch (err) {
      setSavingConfig(false);
      setConfigMsg({ type: "error", text: "Failed to save configuration" });
    }
    setTimeout(() => setConfigMsg(null), 4000);
  };

  const summary = adminSummary || {};
  const roleLabel = roleTab === "customer_admin" ? "Customer" : "Admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight">Billing Management</h2>
          <p className="text-sm text-primary/50 mt-1">
            {isSuperAdmin
              ? "Review all bills across the platform, manage fees, and track defaulters."
              : "Review bills and payments for your organization."}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleGenerateBills}
            disabled={generatingBills}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
          >
            <Receipt size={16} />
            {generatingBills ? "Generating..." : "Generate Monthly Bills"}
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
              showConfig
                ? "bg-primary text-white"
                : "bg-primary/10 text-primary hover:bg-primary/15"
            }`}
          >
            <Settings size={16} />
            Fee Settings
          </button>
        </div>
      </div>

      {generationMsg && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${
          generationMsg.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {generationMsg.text}
        </div>
      )}

      {/* ── Fee Configuration Panel ── */}
      {showConfig && (
        <div className="bg-white rounded-2xl border border-primary/10 p-6 space-y-5">
          <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <Settings size={16} />
            Monthly Fee Configuration
          </h3>

          {/* Current selected fees */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-blue-50/60 border border-blue-200/40 px-4 py-3 text-center">
              <p className="text-[10px] font-medium text-primary/40 uppercase">Customer Fee</p>
              <p className="text-xl font-bold text-blue-700">NPR {selectedFees.customerFee.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-violet-50/60 border border-violet-200/40 px-4 py-3 text-center">
              <p className="text-[10px] font-medium text-primary/40 uppercase">Admin Fee</p>
              <p className="text-xl font-bold text-violet-700">NPR {selectedFees.adminFee.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/40 px-4 py-3 sm:col-span-2">
              <p className="text-[10px] font-medium text-primary/40 uppercase">Editing Scope</p>
              <p className="text-sm font-bold text-emerald-700 truncate">{selectedScopeLabel}</p>
              <p className="text-xs text-primary/45 mt-0.5">
                {selectedScopeHasOwnConfig ? "Uses its own saved fee settings" : "Currently inherits the global default"}
              </p>
            </div>
          </div>

          {/* Per-org configs if any */}
          {billingConfigs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {billingConfigs.map((c) => (
                <div
                  key={c._id}
                  className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-primary">{c.orgId?.name || "Global Default"}</span>
                  <span className="text-primary/50 ml-2">
                    Customer: NPR {c.customerMonthlyFee} | Admin: NPR {c.adminMonthlyFee}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Update fees form */}
          <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-primary/10">
            {isSuperAdmin && (
              <div>
                <label className="text-xs font-medium text-primary/50 uppercase tracking-wider block mb-1">Apply To</label>
                <select
                  value={feeOrgId}
                  onChange={(e) => setFeeOrgId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="global">Global Default</option>
                  {organizations.map((org) => (
                    <option key={org._id} value={org._id}>{org.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-primary/50 uppercase tracking-wider block mb-1">Customer Fee (NPR)</label>
              <input
                type="number"
                min="0"
                value={customerFeeInput}
                onChange={(e) => setCustomerFeeInput(e.target.value)}
                className="px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-32"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-primary/50 uppercase tracking-wider block mb-1">Admin Fee (NPR)</label>
              <input
                type="number"
                min="0"
                value={adminFeeInput}
                onChange={(e) => setAdminFeeInput(e.target.value)}
                className="px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-32"
              />
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              <Save size={16} />
              {savingConfig ? "Saving..." : "Save Fees"}
            </button>
          </div>

          {configMsg && (
            <p className={`text-sm font-medium ${configMsg.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {configMsg.text}
            </p>
          )}
        </div>
      )}

      {/* ── Role Tabs: Customer Bills vs Admin Bills ── */}
      <div className="flex gap-1 bg-white rounded-2xl border border-primary/10 p-1.5">
        <button
          onClick={() => setRoleTab("customer_admin")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            roleTab === "customer_admin"
              ? "bg-primary text-white shadow-md"
              : "text-primary/50 hover:text-primary/70 hover:bg-primary/5"
          }`}
        >
          <Users size={16} />
          Customer Bills
        </button>
        <button
          onClick={() => setRoleTab("admin")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            roleTab === "admin"
              ? "bg-primary text-white shadow-md"
              : "text-primary/50 hover:text-primary/70 hover:bg-primary/5"
          }`}
        >
          <UserCog size={16} />
          Admin Bills
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Receipt} label={`${roleLabel} Bills`} value={summary.totalBills || 0} color="text-primary" bg="bg-primary/8" />
        <StatCard icon={CheckCircle2} label="Paid" value={summary.paid || 0} color="text-green-600" bg="bg-green-100" />
        <StatCard icon={Clock} label="Unpaid" value={summary.unpaid || 0} color="text-amber-600" bg="bg-amber-100" />
        <StatCard icon={AlertTriangle} label="Overdue" value={summary.overdue || 0} color="text-red-600" bg="bg-red-100" />
        <StatCard icon={DollarSign} label="Revenue" value={`NPR ${(summary.totalRevenue || 0).toLocaleString()}`} color="text-emerald-600" bg="bg-emerald-100" />
        <StatCard icon={DollarSign} label="Outstanding" value={`NPR ${(summary.totalOutstanding || 0).toLocaleString()}`} color="text-red-600" bg="bg-red-100" />
      </div>

      {/* Defaulters Section */}
      {defaulters.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200/40 p-6">
          <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertTriangle size={16} />
            {roleLabel}s Not Paying ({defaulters.length})
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {defaulters.map((d) => (
              <div key={d._id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-red-50/50 border border-red-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                    <User size={18} className="text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">{d.customer?.name || "Unknown"}</p>
                    <div className="flex items-center gap-3 text-xs text-primary/45 mt-0.5">
                      {d.customer?.email && (
                        <span className="flex items-center gap-1 truncate"><Mail size={11} /> {d.customer.email}</span>
                      )}
                      {d.customer?.phone && (
                        <span className="flex items-center gap-1"><Phone size={11} /> {d.customer.phone}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-red-700">NPR {d.amount.toLocaleString()}</p>
                  <p className="text-xs text-primary/40">{d.period}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_BADGE[d.status]?.bg} ${STATUS_BADGE[d.status]?.text}`}>
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-primary/10 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium text-primary/50 uppercase tracking-wider block mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All</option>
              <option value="UNPAID">Unpaid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PAID">Paid</option>
              <option value="WAIVED">Waived</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-primary/50 uppercase tracking-wider block mb-1">Month</label>
            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleDateString("en-US", { month: "long" })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-primary/50 uppercase tracking-wider block mb-1">Year</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All</option>
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={applyFilters}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/15 transition"
          >
            <Search size={16} />
            Filter
          </button>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden">
        {adminLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : adminBills.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-10 h-10 text-primary/20 mx-auto mb-3" />
            <p className="text-primary/40 text-sm">No {roleLabel.toLowerCase()} bills found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary/5 border-b border-primary/10">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-primary/50 uppercase tracking-wider">{roleLabel}</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-primary/50 uppercase tracking-wider">Period</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-primary/50 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-primary/50 uppercase tracking-wider">Due Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-primary/50 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-primary/50 uppercase tracking-wider">Paid At</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-primary/50 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {adminBills.map((bill) => {
                    const badge = STATUS_BADGE[bill.status] || STATUS_BADGE.UNPAID;
                    return (
                      <tr key={bill._id} className="border-b border-primary/5 hover:bg-primary/3 transition">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-primary">{bill.customerId?.name || "—"}</p>
                          <p className="text-xs text-primary/40">{bill.customerId?.email || ""}</p>
                          {bill.customerId?.address && (
                            <p className="text-[10px] text-primary/30 truncate max-w-[200px]">{bill.customerId.address}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-primary/70">
                          {formatPeriod(bill.billingMonth, bill.billingYear)}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-primary">
                          NPR {bill.amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-primary/50">
                          {new Date(bill.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${badge.bg} ${badge.text} border ${badge.border}`}>
                            {bill.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-primary/50">
                          {bill.paidAt
                            ? new Date(bill.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                          {bill.paymentMethod && (
                            <span className="text-xs text-primary/30 ml-1">({bill.paymentMethod})</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {(bill.status === "UNPAID" || bill.status === "OVERDUE") && (
                            <button
                              onClick={() => handleWaive(bill._id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200/60 hover:bg-violet-100 transition"
                            >
                              <Ban size={12} />
                              Waive
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {adminPagination && adminPagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-primary/10">
                <p className="text-xs text-primary/40">
                  Page {adminPagination.page} of {adminPagination.pages} ({adminPagination.total} bills)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => goToPage(adminPagination.page - 1)}
                    disabled={adminPagination.page <= 1}
                    className="p-2 rounded-lg bg-primary/5 text-primary/50 hover:bg-primary/10 disabled:opacity-30 transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => goToPage(adminPagination.page + 1)}
                    disabled={adminPagination.page >= adminPagination.pages}
                    className="p-2 rounded-lg bg-primary/5 text-primary/50 hover:bg-primary/10 disabled:opacity-30 transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="bg-white rounded-2xl border border-primary/10 p-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-lg font-bold text-primary">{value}</p>
      <p className="text-[10px] font-medium text-primary/40 uppercase mt-0.5">{label}</p>
    </div>
  );
}
