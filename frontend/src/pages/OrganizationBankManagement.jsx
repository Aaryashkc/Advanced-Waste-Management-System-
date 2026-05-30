import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Landmark,
  Link2,
  Search,
  X,
} from "lucide-react";
import useOrganizationStore from "../stores/useOrganizationStore";
import PaginationControls from "../components/shared/PaginationControls";
import { AdminEmptyState, AdminErrorState } from "../components/shared/AdminListStates";

const STORAGE_KEY = "organization-bank-links";

const emptyForm = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  branchName: "",
};

const readLinks = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const OrganizationBankManagement = () => {
  const { organizations, pagination, isLoading, error, fetchOrganizations } = useOrganizationStore();
  const [bankLinks, setBankLinks] = useState(() => readLinks());
  const [activeOrg, setActiveOrg] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchOrganizations({ page: 1, limit: 10 });
  }, [fetchOrganizations]);

  const filteredOrganizations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return organizations;
    return organizations.filter((org) => org.name?.toLowerCase().includes(normalized));
  }, [organizations, query]);

  const openLinkModal = (org) => {
    setActiveOrg(org);
    setForm(bankLinks[org._id] || emptyForm);
    setFormError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.bankName || !form.accountName || !form.accountNumber || !form.branchName) {
      setFormError("All bank fields are required.");
      return;
    }

    const nextLinks = {
      ...bankLinks,
      [activeOrg._id]: {
        ...form,
        organizationName: activeOrg.name,
        linkedAt: new Date().toISOString(),
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLinks));
    setBankLinks(nextLinks);
    setActiveOrg(null);
    setForm(emptyForm);
  };

  const linkedCount = organizations.filter((org) => bankLinks[org._id]).length;
  const totalOrganizations = pagination?.total ?? organizations.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
            Organization Bank Management
          </h1>
          <p className="mt-1 text-sm text-primary/60">
            Link organization bank details for future direct settlement readiness.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-card-soft)] px-3 py-2 text-xs font-semibold text-primary/65">
          <Landmark className="h-4 w-4" />
          Local demo storage
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<Building2 className="h-5 w-5 text-primary" />}
          label="Organizations"
          value={totalOrganizations}
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label="Banks Linked"
          value={linkedCount}
          tone="emerald"
        />
        <SummaryCard
          icon={<CreditCard className="h-5 w-5 text-amber-600" />}
          label="Not Linked"
          value={Math.max(organizations.length - linkedCount, 0)}
          tone="amber"
        />
      </div>

      <section className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-card)] shadow-sm shadow-primary/5">
        <div className="flex flex-col gap-3 border-b border-[var(--dash-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-primary">Organizations</h2>
            <p className="mt-0.5 text-xs font-medium text-primary/45">
              Bank status is saved in this browser.
            </p>
          </div>
          <label className="flex min-h-10 w-full items-center gap-2 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-card-soft)] px-3 text-sm sm:w-72">
            <Search className="h-4 w-4 text-primary/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search organization"
              className="min-w-0 flex-1 bg-transparent text-primary outline-none placeholder:text-primary/35"
            />
          </label>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm font-medium text-primary/55">Loading organizations...</div>
        ) : error ? (
          <div className="p-6">
            <AdminErrorState
              message={error}
              onRetry={() => fetchOrganizations({ page: pagination?.page || 1, limit: 10 })}
            />
          </div>
        ) : filteredOrganizations.length === 0 ? (
          <div className="p-6">
            <AdminEmptyState
              icon={Building2}
              title="No organizations found"
              message="Organizations from the existing system will appear here."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[var(--dash-card-soft)] text-xs font-bold uppercase tracking-wide text-primary/45">
                  <tr>
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Bank Status</th>
                    <th className="px-5 py-3">Bank</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--dash-border)]">
                  {filteredOrganizations.map((org) => {
                    const linked = bankLinks[org._id];
                    return (
                      <tr key={org._id} className="transition hover:bg-primary/[0.03]">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-sm font-bold text-primary">
                              {org.name?.charAt(0)?.toUpperCase() || "O"}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-primary">{org.name}</p>
                              <p className="truncate text-xs text-primary/45">
                                {org.location?.address || "Address not set"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                              linked
                                ? "bg-emerald-500/10 text-emerald-700"
                                : "bg-amber-500/10 text-amber-700"
                            }`}
                          >
                            {linked ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                            {linked ? "Linked" : "Not Linked"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-primary/65">
                          {linked ? linked.bankName : "Pending"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openLinkModal(org)}
                            className={`inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                              linked
                                ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15"
                                : "bg-primary text-white shadow-sm shadow-primary/10 hover:bg-primary/90"
                            }`}
                          >
                            {linked ? <CheckCircle2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                            {linked ? "Completed" : "Link Bank"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!query && (
              <div className="border-t border-[var(--dash-border)] p-4">
                <PaginationControls
                  pagination={pagination}
                  onPageChange={(nextPage) => fetchOrganizations({ page: nextPage, limit: 10 })}
                  itemLabel="organizations"
                />
              </div>
            )}
          </>
        )}
      </section>

      {activeOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-card)] p-6 shadow-2xl shadow-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary/45">
                  Link Bank
                </p>
                <h3 className="mt-1 text-xl font-bold text-primary">{activeOrg.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveOrg(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5 text-primary/55 transition hover:bg-primary/10 hover:text-primary"
                aria-label="Close bank form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <BankInput label="Bank Name" value={form.bankName} onChange={(bankName) => setForm({ ...form, bankName })} />
              <BankInput label="Account Name" value={form.accountName} onChange={(accountName) => setForm({ ...form, accountName })} />
              <BankInput label="Account Number" value={form.accountNumber} onChange={(accountNumber) => setForm({ ...form, accountNumber })} />
              <BankInput label="Branch Name" value={form.branchName} onChange={(branchName) => setForm({ ...form, branchName })} />
              {formError && <p className="text-sm font-semibold text-red-600">{formError}</p>}
              <button
                type="submit"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-primary/10 transition hover:bg-primary/90"
              >
                <CheckCircle2 className="h-4 w-4" />
                Save Bank Details
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ icon, label, value, tone = "primary" }) => {
  const bg = tone === "emerald" ? "bg-emerald-100" : tone === "amber" ? "bg-amber-100" : "bg-primary/8";

  return (
    <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-card)] p-5 shadow-sm shadow-primary/5">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg}`}>{icon}</div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary/45">{label}</p>
          <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
        </div>
      </div>
    </div>
  );
};

const BankInput = ({ label, value, onChange }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-semibold text-primary/70">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-[var(--dash-border)] bg-[var(--dash-card-soft)] px-4 py-2.5 text-sm text-primary outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
    />
  </label>
);

export default OrganizationBankManagement;
