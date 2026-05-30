import { useCallback, useEffect, useState } from "react";
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
  ChevronDown,
  ChevronUp,
  Settings,
  Save,
  Users,
  UserCog,
  Wallet,
} from "lucide-react";
import useBillingStore from "../stores/useBillingStore";
import useAuthStore from "../stores/useAuthStore";
import useOrganizationStore from "../stores/useOrganizationStore";
import { AdminEmptyState, ListSkeleton } from "../components/shared/AdminListStates";

const STATUS_BADGE = {
  UNPAID: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200/60" },
  CASH_PENDING: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200/60" },
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
    billingAccounts,
    accountDetails,
    accountDetailsLoading,
    adminSummary,
    adminPagination,
    adminLoading,
    fetchBillingOverview,
    fetchBillingAccountDetails,
    waiveBill,
    confirmCashPayment,
    generateBills,
    billingConfigs,
    activeFees,
    defaults,
    fetchBillingConfig,
    updateBillingConfig,
  } = useBillingStore();

  // ── Tabs: "customer" or "admin" ──
  const [roleTab, setRoleTab] = useState("customer_admin");
  const [filters, setFilters] = useState({ status: "", month: "", year: "", orgId: "" });
  const [showConfig, setShowConfig] = useState(false);

  // Fee form
  const [customerFeeInput, setCustomerFeeInput] = useState("");
  const [adminFeeInput, setAdminFeeInput] = useState("");
  const [feeOrgId, setFeeOrgId] = useState("global");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState(null);
  const [generatingBills, setGeneratingBills] = useState(false);
  const [generationMsg, setGenerationMsg] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [expandedAccountId, setExpandedAccountId] = useState(null);

  const currentOverviewParams = useCallback((extra = {}) => {
    const params = { ...extra };
    if (roleTab === "confirm") {
      params.status = "CASH_PENDING";
    } else {
      params.billedRole = roleTab;
      if (filters.status) params.status = filters.status;
    }
    if (filters.month) params.month = filters.month;
    if (filters.year) params.year = filters.year;
    if (isSuperAdmin && filters.orgId) params.orgId = filters.orgId;
    return params;
  }, [filters.month, filters.orgId, filters.status, filters.year, isSuperAdmin, roleTab]);

  const overviewParamsForRole = useCallback((nextRole, extra = {}) => {
    const params = { ...extra };
    if (nextRole === "confirm") {
      params.status = "CASH_PENDING";
    } else {
      params.billedRole = nextRole;
      if (filters.status) params.status = filters.status;
    }
    if (filters.month) params.month = filters.month;
    if (filters.year) params.year = filters.year;
    if (isSuperAdmin && filters.orgId) params.orgId = filters.orgId;
    return params;
  }, [filters.month, filters.orgId, filters.status, filters.year, isSuperAdmin]);

  const accountDetailsParams = useCallback(() => {
    const params = {};
    if (roleTab !== "confirm") params.billedRole = roleTab;
    if (filters.month) params.month = filters.month;
    if (filters.year) params.year = filters.year;
    if (isSuperAdmin && filters.orgId) params.orgId = filters.orgId;
    return params;
  }, [filters.month, filters.orgId, filters.year, isSuperAdmin, roleTab]);

  // Load data on mount + when roleTab changes
  useEffect(() => {
    fetchBillingConfig();
  }, [fetchBillingConfig]);

  useEffect(() => {
    if (isSuperAdmin) fetchOrganizations();
  }, [isSuperAdmin, fetchOrganizations]);

  useEffect(() => {
    fetchBillingOverview({ billedRole: "customer_admin" });
  }, [fetchBillingOverview]);

  const switchRoleTab = (nextRole) => {
    if (roleTab === nextRole) return;
    setRoleTab(nextRole);
    setExpandedAccountId(null);
    fetchBillingOverview(overviewParamsForRole(nextRole));
  };

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
    queueMicrotask(() => {
      setCustomerFeeInput(String(selectedFees.customerFee));
      setAdminFeeInput(String(selectedFees.adminFee));
    });
  }, [selectedFees.customerFee, selectedFees.adminFee]);

  const applyFilters = () => {
    fetchBillingOverview(currentOverviewParams());
  };

  const handleWaive = async (billingId) => {
    const notes = window.prompt("Reason for waiving this bill (optional):");
    if (notes === null) return;
    await waiveBill(billingId, notes || undefined, currentOverviewParams());
  };

  const handleConfirmCash = async (billingId) => {
    if (!window.confirm("Confirm this cash payment and mark the bill as paid?")) return;
    setConfirmingId(billingId);
    const result = await confirmCashPayment(billingId, currentOverviewParams());
    setConfirmingId(null);
    setGenerationMsg({
      type: result.success ? "success" : "error",
      text: result.success ? "Cash payment confirmed and bill marked paid." : result.error || "Failed to confirm cash payment",
    });
    setTimeout(() => setGenerationMsg(null), 4000);
  };

  const goToPage = (page) => {
    fetchBillingOverview(currentOverviewParams({ page }));
  };

  const toggleAccountDetails = async (accountId) => {
    const id = String(accountId || "");
    if (!id) return;
    if (expandedAccountId === id) {
      setExpandedAccountId(null);
      return;
    }
    setExpandedAccountId(id);
    if (!accountDetails[id]) {
      await fetchBillingAccountDetails(id, accountDetailsParams());
    }
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
    } catch {
      setSavingConfig(false);
      setConfigMsg({ type: "error", text: "Failed to save configuration" });
    }
    setTimeout(() => setConfigMsg(null), 4000);
  };

  const summary = adminSummary || {};
  const roleLabel =
    roleTab === "customer_admin"
      ? "Customer"
      : roleTab === "admin"
      ? "Admin"
      : "Cash Confirmation";
  const isRefreshingOverview = adminLoading && billingAccounts.length > 0;
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-primary tracking-tight sm:text-2xl">Billing Management</h2>
          <p className="text-sm text-primary/50 mt-1">
            {isSuperAdmin
              ? "Review calendar-month bills across the platform, manage fees, and track accumulated dues."
              : "Review calendar-month bills and accumulated dues for your organization."}
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2 sm:gap-3">
          <button
            onClick={handleGenerateBills}
            disabled={generatingBills}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
          >
            <Receipt size={16} />
            {generatingBills ? "Backfilling..." : "Backfill Monthly Bills"}
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
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

      {/* ── Role Tabs: Customer Bills, Admin Bills, Cash Confirmations ── */}
      <div className="grid grid-cols-3 gap-1 bg-white rounded-2xl border border-primary/10 p-1.5">
        <button
          onClick={() => {
            switchRoleTab("customer_admin");
          }}
          className={`min-w-0 flex items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition-all sm:gap-2 sm:text-sm ${
            roleTab === "customer_admin"
              ? "bg-primary text-white shadow-md"
              : "text-primary/50 hover:text-primary/70 hover:bg-primary/5"
          }`}
        >
          <Users size={15} className="shrink-0" />
          <span className="truncate"><span className="sm:hidden">Customer</span><span className="hidden sm:inline">Customer Bills</span></span>
        </button>
        <button
          onClick={() => {
            switchRoleTab("admin");
          }}
          className={`min-w-0 flex items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition-all sm:gap-2 sm:text-sm ${
            roleTab === "admin"
              ? "bg-primary text-white shadow-md"
              : "text-primary/50 hover:text-primary/70 hover:bg-primary/5"
          }`}
        >
          <UserCog size={15} className="shrink-0" />
          <span className="truncate"><span className="sm:hidden">Admin</span><span className="hidden sm:inline">Admin Bills</span></span>
        </button>
        <button
          onClick={() => {
            switchRoleTab("confirm");
          }}
          className={`min-w-0 flex items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition-all sm:gap-2 sm:text-sm ${
            roleTab === "confirm"
              ? "bg-primary text-white shadow-md"
              : "text-primary/50 hover:text-primary/70 hover:bg-primary/5"
          }`}
        >
          <CheckCircle2 size={15} className="shrink-0" />
          <span className="truncate"><span className="sm:hidden">Confirm</span><span className="hidden sm:inline">Confirm Payment</span></span>
          {(summary.cashPending || 0) > 0 && roleTab !== "confirm" && (
            <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 sm:px-2">
              {summary.cashPending}
            </span>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-7">
        <StatCard icon={Receipt} label={`${roleLabel} Bills`} value={summary.totalBills || 0} color="text-primary" bg="bg-primary/8" />
        <StatCard icon={CheckCircle2} label="Paid" value={summary.paid || 0} color="text-green-600" bg="bg-green-100" />
        <StatCard icon={Clock} label="Unpaid" value={summary.unpaid || 0} color="text-amber-600" bg="bg-amber-100" />
        <StatCard icon={Wallet} label="Cash Pending" value={summary.cashPending || 0} color="text-blue-600" bg="bg-blue-100" />
        <StatCard icon={AlertTriangle} label="Overdue" value={summary.overdue || 0} color="text-red-600" bg="bg-red-100" />
        <StatCard icon={DollarSign} label="Revenue" value={`NPR ${(summary.totalRevenue || 0).toLocaleString()}`} color="text-emerald-600" bg="bg-emerald-100" />
        <StatCard icon={DollarSign} label="Outstanding" value={`NPR ${(summary.totalOutstanding || 0).toLocaleString()}`} color="text-red-600" bg="bg-red-100" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-primary/10 p-4 sm:p-5">
        <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap sm:gap-4">
          <div className="min-w-0">
            <label className="text-xs font-medium text-primary/50 uppercase tracking-wider block mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              disabled={roleTab === "confirm"}
              className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-auto"
            >
              <option value="">All</option>
              <option value="UNPAID">Unpaid</option>
              <option value="CASH_PENDING">Cash Pending</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PAID">Paid</option>
              <option value="WAIVED">Waived</option>
            </select>
          </div>
          {isSuperAdmin && (
            <div className="min-w-0">
              <label className="text-xs font-medium text-primary/50 uppercase tracking-wider block mb-1">Organization</label>
              <select
                value={filters.orgId}
                onChange={(e) => setFilters({ ...filters, orgId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-auto"
              >
                <option value="">All organizations</option>
                {organizations.map((org) => (
                  <option key={org._id} value={org._id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="min-w-0">
            <label className="text-xs font-medium text-primary/50 uppercase tracking-wider block mb-1">Month</label>
            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-auto"
            >
              <option value="">All</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleDateString("en-US", { month: "long" })}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="text-xs font-medium text-primary/50 uppercase tracking-wider block mb-1">Year</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-auto"
            >
              <option value="">All</option>
              {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={applyFilters}
            className="col-span-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/15 transition sm:col-span-1"
          >
            <Search size={16} />
            Filter
          </button>
        </div>
      </div>

      {/* Account List */}
      <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden">
        {isRefreshingOverview && (
          <div className="flex items-center justify-between gap-3 border-b border-primary/10 bg-primary/[0.03] px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary/45">
              Refreshing {roleLabel.toLowerCase()} billing data
            </p>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          </div>
        )}

        {adminLoading && billingAccounts.length === 0 ? (
          <div className="p-5">
            <ListSkeleton rows={5} />
          </div>
        ) : billingAccounts.length === 0 ? (
          <AdminEmptyState icon={Receipt} title={`No ${roleLabel.toLowerCase()} accounts found`} message="Billing accounts will appear here after bills are generated." />
        ) : (
          <>
            <div className={`divide-y divide-primary/8 transition-opacity ${isRefreshingOverview ? "opacity-60" : "opacity-100"}`}>
              {billingAccounts.map((account) => {
                const accountId = String(account._id || "");
                const isOpen = expandedAccountId === accountId;
                const details = accountDetails[accountId];
                const isLoadingDetails = accountDetailsLoading[accountId];
                const accountStatus = account.overdueCount > 0 ? "OVERDUE" : account.cashPendingCount > 0 ? "CASH_PENDING" : account.openBillCount > 0 ? "UNPAID" : "PAID";
                const badge = STATUS_BADGE[accountStatus] || STATUS_BADGE.UNPAID;

                return (
                  <div key={accountId}>
                    <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(240px,1fr)_130px_150px_170px_120px] lg:items-center">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{account.customer?.name || "Unknown account"}</p>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-primary/45">
                          {account.customer?.email && <span>{account.customer.email}</span>}
                          {account.customer?.phone && <span>{account.customer.phone}</span>}
                          {account.org?.name && <span>{account.org.name}</span>}
                        </div>
                        {account.customer?.address && (
                          <p className="mt-1 max-w-xl truncate text-[11px] text-primary/35">{account.customer.address}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-primary/35">Outstanding</p>
                        <p className="text-sm font-bold text-primary">NPR {(account.totalOutstanding || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-primary/35">Paid</p>
                        <p className="text-sm font-bold text-emerald-700">NPR {(account.totalPaid || 0).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${badge.bg} ${badge.text} border ${badge.border}`}>
                          {accountStatus}
                        </span>
                        <span className="inline-flex rounded-full border border-primary/10 bg-primary/5 px-2.5 py-0.5 text-[11px] font-bold uppercase text-primary/50">
                          {account.totalBills} bills
                        </span>
                      </div>
                      <button
                        onClick={() => toggleAccountDetails(accountId)}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary/8 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/12 transition sm:w-auto"
                      >
                        Details
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="border-t border-primary/8 bg-primary/[0.025] px-4 py-4 sm:px-5">
                        {isLoadingDetails ? (
                          <div className="flex items-center gap-2 py-5 text-sm font-medium text-primary/45">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                            Loading bill history
                          </div>
                        ) : details?.bills?.length ? (
                          <>
                          <div className="space-y-3 sm:hidden">
                            {details.bills.map((bill) => {
                              const detailBadge = STATUS_BADGE[bill.status] || STATUS_BADGE.UNPAID;
                              return (
                                <div key={bill._id} className="rounded-xl border border-primary/10 bg-white p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-xs font-semibold uppercase text-primary/35">Period</p>
                                      <p className="mt-1 font-bold text-primary">{formatPeriod(bill.billingMonth, bill.billingYear)}</p>
                                    </div>
                                    <span className={`inline-flex shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${detailBadge.bg} ${detailBadge.text} border ${detailBadge.border}`}>
                                      {bill.status}
                                    </span>
                                  </div>
                                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase text-primary/35">Amount</p>
                                      <p className="font-bold text-primary">NPR {bill.amount.toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase text-primary/35">Due</p>
                                      <p className="font-medium text-primary/60">{new Date(bill.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-[10px] font-semibold uppercase text-primary/35">Paid</p>
                                      <p className="font-medium text-primary/60">
                                        {bill.paidAt ? new Date(bill.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"}
                                        {bill.paymentMethod && <span className="ml-1 text-xs text-primary/30">({bill.paymentMethod})</span>}
                                      </p>
                                    </div>
                                  </div>
                                  {(bill.status === "CASH_PENDING" || bill.status === "UNPAID" || bill.status === "OVERDUE") && (
                                    <div className="mt-4">
                                      {bill.status === "CASH_PENDING" ? (
                                        <button
                                          onClick={() => handleConfirmCash(bill._id)}
                                          disabled={confirmingId === bill._id}
                                          className="inline-flex w-full items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 hover:bg-blue-100 transition disabled:opacity-50"
                                        >
                                          <CheckCircle2 size={12} />
                                          {confirmingId === bill._id ? "Confirming..." : "Confirm Payment"}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleWaive(bill._id)}
                                          className="inline-flex w-full items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200/60 hover:bg-violet-100 transition"
                                        >
                                          <Ban size={12} />
                                          Waive Bill
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="hidden overflow-x-auto rounded-xl border border-primary/10 bg-white sm:block">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-primary/5 border-b border-primary/10">
                                  <th className="text-left px-4 py-3 text-xs font-semibold text-primary/50 uppercase">Period</th>
                                  <th className="text-left px-4 py-3 text-xs font-semibold text-primary/50 uppercase">Amount</th>
                                  <th className="text-left px-4 py-3 text-xs font-semibold text-primary/50 uppercase">Due</th>
                                  <th className="text-left px-4 py-3 text-xs font-semibold text-primary/50 uppercase">Status</th>
                                  <th className="text-left px-4 py-3 text-xs font-semibold text-primary/50 uppercase">Paid</th>
                                  <th className="text-right px-4 py-3 text-xs font-semibold text-primary/50 uppercase">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {details.bills.map((bill) => {
                                  const detailBadge = STATUS_BADGE[bill.status] || STATUS_BADGE.UNPAID;
                                  return (
                                    <tr key={bill._id} className="border-b border-primary/5 last:border-0">
                                      <td className="px-4 py-3 text-primary/70">{formatPeriod(bill.billingMonth, bill.billingYear)}</td>
                                      <td className="px-4 py-3 font-semibold text-primary">NPR {bill.amount.toLocaleString()}</td>
                                      <td className="px-4 py-3 text-primary/50">{new Date(bill.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                                      <td className="px-4 py-3">
                                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${detailBadge.bg} ${detailBadge.text} border ${detailBadge.border}`}>
                                          {bill.status}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-primary/50">
                                        {bill.paidAt ? new Date(bill.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"}
                                        {bill.paymentMethod && <span className="ml-1 text-xs text-primary/30">({bill.paymentMethod})</span>}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        {bill.status === "CASH_PENDING" ? (
                                          <button
                                            onClick={() => handleConfirmCash(bill._id)}
                                            disabled={confirmingId === bill._id}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 hover:bg-blue-100 transition disabled:opacity-50"
                                          >
                                            <CheckCircle2 size={12} />
                                            {confirmingId === bill._id ? "Confirming..." : "Confirm"}
                                          </button>
                                        ) : (bill.status === "UNPAID" || bill.status === "OVERDUE") ? (
                                          <button
                                            onClick={() => handleWaive(bill._id)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200/60 hover:bg-violet-100 transition"
                                          >
                                            <Ban size={12} />
                                            Waive
                                          </button>
                                        ) : null}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          </>
                        ) : (
                          <p className="py-5 text-sm text-primary/40">No billing history found for this account.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {adminPagination && adminPagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-primary/10">
                <p className="text-xs text-primary/40">
                  Page {adminPagination.page} of {adminPagination.pages} ({adminPagination.total} accounts)
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

function StatCard({ icon, label, value, color, bg }) {
  const IconComponent = icon;

  return (
    <div className="bg-white rounded-2xl border border-primary/10 p-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <IconComponent className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-lg font-bold text-primary">{value}</p>
      <p className="text-[10px] font-medium text-primary/40 uppercase mt-0.5">{label}</p>
    </div>
  );
}
