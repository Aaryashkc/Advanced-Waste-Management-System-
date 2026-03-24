import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bubble } from 'react-chartjs-2';
import useZoneStore from '../stores/useZoneStore';
import useAuthStore from '../stores/useAuthStore';

ChartJS.register(CategoryScale, LinearScale, PointElement, ArcElement, Title, Tooltip, Legend);

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Classify duty type from capacity
const getDutyType = (capacity) => {
  const kg = Number(capacity);
  if (!kg || isNaN(kg)) return null;
  if (kg < 1000) return 'light duty';
  if (kg <= 5000) return 'medium duty';
  return 'heavy duty';
};

const DUTY_BADGE = {
  'light duty': { badge: 'bg-blue-100 text-blue-700', strip: '#3b82f6', label: 'Light Duty (<1t)' },
  'medium duty': { badge: 'bg-amber-100 text-amber-700', strip: '#f59e0b', label: 'Medium Duty (1–5t)' },
  'heavy duty': { badge: 'bg-red-100 text-red-700', strip: '#ef4444', label: 'Heavy Duty (>5t)' },
};

const DAY_COLORS = {
  Monday: { bg: 'rgba(59,130,246,0.18)', border: '#3b82f6', badge: 'bg-blue-100 text-blue-700' },
  Tuesday: { bg: 'rgba(168,85,247,0.18)', border: '#a855f7', badge: 'bg-purple-100 text-purple-700' },
  Wednesday: { bg: 'rgba(34,197,94,0.18)', border: '#22c55e', badge: 'bg-green-100 text-green-700' },
  Thursday: { bg: 'rgba(245,158,11,0.18)', border: '#f59e0b', badge: 'bg-amber-100 text-amber-700' },
  Friday: { bg: 'rgba(239,68,68,0.18)', border: '#ef4444', badge: 'bg-red-100 text-red-700' },
  Saturday: { bg: 'rgba(20,184,166,0.18)', border: '#14b8a6', badge: 'bg-teal-100 text-teal-700' },
  Sunday: { bg: 'rgba(249,115,22,0.18)', border: '#f97316', badge: 'bg-orange-100 text-orange-700' },
};

const ORG_PALETTE = ['#3b82f6', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#f97316', '#ec4899'];

// ─── Add/Edit Zone Modal ───────────────────────────────────────────────────────
function ZoneModal({ isOpen, onClose, onSubmit, trucks, organizations, isSuperAdmin, isSubmitting, editZone }) {
  const emptyForm = { city: '', area: '', truckId: '', day: '', time: '', truckType: '', orgId: '' };
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editZone) {
        setForm({
          city: editZone.city || '',
          area: editZone.area || '',
          truckId: editZone.truckObjectId ? String(editZone.truckObjectId) : '',
          day: editZone.day || '',
          time: editZone.time || '',
          truckType: editZone.truckType || '',
          orgId: editZone.orgId ? String(editZone.orgId) : '',
        });
      } else {
        setForm(emptyForm);
      }
      setError('');
    }
  }, [isOpen, editZone]);

  // Trucks filtered by selected duty type — uses dutyType field (not truckType which is BIO/NON_BIO)
  const filteredTrucks = useMemo(() => {
    if (!form.truckType) return trucks;
    return trucks.filter(t => {
      const duty = t.dutyType || (t.capacity < 1000 ? 'light duty' : t.capacity <= 5000 ? 'medium duty' : 'heavy duty');
      return duty.toLowerCase() === form.truckType.toLowerCase();
    });
  }, [trucks, form.truckType]);

  // Auto-find driver via trucks's assignedDriver data (from useVehicleStore trucks)  
  const autoDriver = useMemo(() => {
    if (!form.truckId) return null;
    const t = trucks.find(t => String(t.id || t._id) === String(form.truckId));
    if (!t) return null;
    // trucks from org-admin endpoint: has assignedDriver field
    if (t.assignedDriver?.name) return t.assignedDriver.name;
    if (t.assignedDriverName) return t.assignedDriverName;
    return null;
  }, [form.truckId, trucks]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };
      // When truck type changes, reset truck selection
      if (name === 'truckType') next.truckId = '';
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { city, area, truckId, day, time, truckType } = form;
    if (!city || !area || !truckId || !day || !time || !truckType) {
      setError('Please fill all required fields.');
      return;
    }
    if (isSuperAdmin && !form.orgId) { setError('Please select an organization.'); return; }
    setError('');
    const result = await onSubmit(form);
    if (result && !result.success) setError(result.error || 'Failed to save zone.');
  };

  if (!isOpen) return null;

  const truckTypeOptions = [
    { value: 'light duty', label: '🔵 Light Duty', hint: '< 1,000 kg' },
    { value: 'medium duty', label: '🟡 Medium Duty', hint: '1,000 – 5,000 kg' },
    { value: 'heavy duty', label: '🔴 Heavy Duty', hint: '> 5,000 kg' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Colored header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-black">
                {editZone ? '✏️ Edit Zone' : '📍 Create Zone'}
              </h2>
              <p className="text-black/70 text-sm mt-0.5">
                {editZone ? 'Update pickup zone details' : 'Assign a vehicle to a pickup area & time'}
              </p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠️</span> {error}
              </div>
            )}

            {/* Org (super admin only) */}
            {isSuperAdmin && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">🏢 Organization *</label>
                <select name="orgId" value={form.orgId} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select organization...</option>
                  {organizations.map(o => (
                    <option key={o._id || o.id} value={o._id || o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Location row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">🏙️ City *</label>
                <input name="city" value={form.city} onChange={handleChange}
                  placeholder="e.g. Kathmandu"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">📌 Area *</label>
                <input name="area" value={form.area} onChange={handleChange}
                  placeholder="e.g. Thamel"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>

            {/* Day + Time row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">📅 Day *</label>
                <select name="day" value={form.day} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select day...</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">🕐 Pickup Time *</label>
                <input name="time" value={form.time} onChange={handleChange}
                  placeholder="e.g. 7:00 AM"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>

            {/* Truck type — visual cards */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">🚛 Vehicle Class *</label>
              <div className="grid grid-cols-3 gap-2">
                {truckTypeOptions.map(opt => {
                  const duty = DUTY_BADGE[opt.value];
                  const selected = form.truckType === opt.value;
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => handleChange({ target: { name: 'truckType', value: opt.value } })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${selected
                        ? `border-current ${duty.badge} shadow-sm`
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                    >
                      <div className="text-base font-bold">{opt.label.split(' ')[0]}</div>
                      <div className={`text-xs font-semibold mt-0.5 ${selected ? '' : 'text-gray-600'}`}>
                        {opt.label.split(' ').slice(1).join(' ')}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${selected ? 'opacity-80' : 'text-gray-400'}`}>
                        {opt.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vehicle dropdown — filtered by truckType */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                🚚 Assign Vehicle *
                {form.truckType && (
                  <span className={`ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${DUTY_BADGE[form.truckType]?.badge}`}>
                    {form.truckType === 'light duty' ? '<1t' : form.truckType === 'medium duty' ? '1–5t' : '>5t'} only
                  </span>
                )}
              </label>
              {!form.truckType ? (
                <div className="w-full border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-400 text-center">
                  Select a vehicle class first
                </div>
              ) : filteredTrucks.length === 0 ? (
                <div className="w-full border border-dashed border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-500 text-center bg-orange-50">
                  No {form.truckType} vehicles available
                </div>
              ) : (
                <select name="truckId" value={form.truckId} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select vehicle...</option>
                  {filteredTrucks.map(t => (
                    <option key={t.id || t._id} value={t.id || t._id}>
                      {t.licensePlate} — {t.capacity ? `${t.capacity} kg` : t.truckType}
                    </option>
                  ))}
                </select>
              )}

              {/* Auto-resolved driver preview */}
              {form.truckId && (
                <div className={`mt-2.5 px-4 py-2.5 rounded-xl border text-sm flex items-center gap-2.5 ${autoDriver
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                  {autoDriver ? (
                    <>
                      <span className="text-base">👤</span>
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">Auto-assigned driver</span>
                        <p className="font-bold">{autoDriver}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-base">⚠️</span>
                      <div>
                        <span className="text-xs font-semibold">No driver assigned to this vehicle</span>
                        <p className="text-xs opacity-75">Go to Vehicles → Assign a driver first</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#354f52] text-white text-sm font-semibold hover:bg-[#354f52]/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                {isSubmitting
                  ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving...</>
                  : editZone ? '✓ Save Changes' : '+ Create Zone'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Zone Card ─────────────────────────────────────────────────────────────────
function ZoneCard({ zone, isSuperAdmin, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dayStyle = DAY_COLORS[zone.day] || DAY_COLORS.Monday;
  const dutyStyle = DUTY_BADGE[zone.truckType] || DUTY_BADGE['medium duty'];

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100">
      {/* Day color strip */}
      <div className="h-1.5" style={{ background: dayStyle.border }} />

      <div className="p-4">
        {/* Top: location + time */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-primary text-base truncate">{zone.city}</h3>
            <p className="text-xs text-primary/55 truncate">{zone.area}</p>
            {isSuperAdmin && zone.orgName && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                🏢 {zone.orgName}
              </span>
            )}
          </div>
          {/* Time pill */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 bg-primary text-white px-2.5 py-1.5 rounded-lg shadow-sm">
              <svg className="w-3 h-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-black font-extrabold tracking-tight">{zone.time}</span>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dayStyle.badge}`}>{zone.day}</span>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-5 text-center">👤</span>
            <span className="text-gray-500">Driver:</span>
            <span className="font-semibold text-primary truncate flex-1">{zone.driver}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-5 text-center">🚛</span>
            <span className="text-gray-500">Vehicle:</span>
            <span className="font-semibold text-primary truncate flex-1">{zone.truckName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-5 text-center">⚖️</span>
            <span className="text-gray-500">Class:</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${dutyStyle.badge}`}>
              {zone.truckType}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5">
          <button onClick={() => onEdit(zone)}
            className="flex-1 py-1.5 rounded-lg border border-primary/15 text-primary text-xs font-medium hover:bg-primary/5 transition-colors">
            Edit
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="flex-1 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors">
              Delete
            </button>
          ) : (
            <div className="flex-1 flex gap-1">
              <button onClick={() => onDelete(zone.id)}
                className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors">
                Yes
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors">
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bubble Chart ──────────────────────────────────────────────────────────────
function ZonesBubbleChart({ zones, organizations, isSuperAdmin }) {
  const chartData = useMemo(() => {
    if (!zones.length) return { datasets: [] };
    if (isSuperAdmin && organizations.length) {
      const orgMap = {};
      zones.forEach(z => {
        const k = z.orgName || 'Unknown';
        if (!orgMap[k]) orgMap[k] = [];
        orgMap[k].push(z);
      });
      return {
        datasets: Object.entries(orgMap).map(([name, oz], i) => ({
          label: name,
          data: oz.map((z, j) => ({ x: j + 1 + i * 0.4, y: DAYS.indexOf(z.day) + 1, r: 13, zone: z })),
          backgroundColor: ORG_PALETTE[i % ORG_PALETTE.length] + 'B0',
          borderColor: ORG_PALETTE[i % ORG_PALETTE.length],
          borderWidth: 2,
        }))
      };
    }
    const byDay = {};
    zones.forEach(z => { if (!byDay[z.day]) byDay[z.day] = []; byDay[z.day].push(z); });
    return {
      datasets: Object.entries(byDay).map(([day, dz]) => {
        const col = DAY_COLORS[day]?.border || '#3b82f6';
        return {
          label: day,
          data: dz.map((z, j) => ({ x: j + 1, y: DAYS.indexOf(day) + 1, r: 13, zone: z })),
          backgroundColor: col + 'B0', borderColor: col, borderWidth: 2,
        };
      })
    };
  }, [zones, organizations, isSuperAdmin]);

  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#192a1c', font: { family: "'Inter',sans-serif", size: 12 }, usePointStyle: true, padding: 16 } },
      tooltip: {
        backgroundColor: 'rgba(25,42,28,0.92)', padding: 12, cornerRadius: 10,
        callbacks: {
          title: (items) => { const z = items[0]?.raw?.zone; return z ? `${z.city} — ${z.area}` : ''; },
          label: (item) => { const z = item.raw?.zone; return z ? [`📅 ${z.day}  🕐 ${z.time}`, `🚛 ${z.truckName}`, `👤 ${z.driver}`] : []; },
        }
      }
    },
    scales: {
      x: { display: false },
      y: { min: 0, max: 8, ticks: { stepSize: 1, callback: v => DAYS[v - 1] || '', font: { family: "'Inter',sans-serif", size: 12 }, color: '#4a5568' }, grid: { color: '#e2e8f0' }, border: { display: false } }
    }
  };

  if (!zones.length) {
    return (
      <div className="h-full flex items-center justify-center text-primary/40">
        <div className="text-center"><div className="text-4xl mb-2">🗺️</div><p className="text-sm">No zones to visualize yet</p></div>
      </div>
    );
  }
  return <Bubble data={chartData} options={options} />;
}

// ─── Main Zones Page ───────────────────────────────────────────────────────────
const Zones = () => {
  const user = useAuthStore(s => s.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const { zones, trucks, organizations, isLoading, isSubmitting, fetchZones, fetchDropdownData, createZone, updateZone, deleteZone } = useZoneStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editZone, setEditZone] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState('all');
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedDuty, setSelectedDuty] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchZones(); fetchDropdownData(); }, [fetchZones, fetchDropdownData]);
  useEffect(() => { if (isSuperAdmin) fetchZones(selectedOrg !== 'all' ? selectedOrg : null); }, [selectedOrg, isSuperAdmin, fetchZones]);

  const filteredZones = useMemo(() => {
    let r = [...zones];
    if (selectedDay !== 'all') r = r.filter(z => z.day === selectedDay);
    if (selectedDuty !== 'all') r = r.filter(z => z.truckType === selectedDuty);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(z => z.city.toLowerCase().includes(q) || z.area.toLowerCase().includes(q) || z.driver.toLowerCase().includes(q) || z.truckName.toLowerCase().includes(q));
    }
    return r;
  }, [zones, selectedDay, selectedDuty, searchQuery]);

  const handleOpenAdd = () => { setEditZone(null); setModalOpen(true); };
  const handleOpenEdit = useCallback((zone) => { setEditZone(zone); setModalOpen(true); }, []);
  const handleCloseModal = () => { setModalOpen(false); setEditZone(null); };

  const handleSubmit = async (form) => {
    const result = editZone ? await updateZone(editZone.id, form) : await createZone(form);
    if (result.success) handleCloseModal();
    return result;
  };

  const handleDelete = useCallback(async (id) => { await deleteZone(id); }, [deleteZone]);

  const totalZones = zones.length;
  const uniqueCities = new Set(zones.map(z => z.city)).size;
  const uniqueAreas = new Set(zones.map(z => z.area)).size;

  return (
    <div className="app-bg">
      <div className="app-container space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">Zone Management</h2>
            <p className="text-sm sm:text-base text-primary/70 mt-1">
              {isSuperAdmin ? 'Monitor pickup zones across all organizations' : "Manage your organization's pickup zones"}
            </p>
          </div>
          <button onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Zone
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Zones', value: totalZones, icon: '📍', c: 'text-blue-600 bg-blue-50' },
            { label: 'Cities', value: uniqueCities, icon: '🏙️', c: 'text-purple-600 bg-purple-50' },
            { label: 'Areas', value: uniqueAreas, icon: '🗺️', c: 'text-green-600 bg-green-50' },
            { label: 'Weekly Pickups', value: totalZones, icon: '📅', c: 'text-amber-600 bg-amber-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-primary/10 shadow-sm p-4">
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${s.c}`}>{s.icon}</span>
                <div><p className="text-2xl font-bold text-primary">{s.value}</p><p className="text-xs text-primary/60">{s.label}</p></div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-white rounded-3xl border border-primary/10 shadow-sm p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-primary">Zone Coverage Map</h3>
            <p className="text-sm text-primary/60">Zones plotted by day of week — hover for details</p>
          </div>
          <div className="h-60"><ZonesBubbleChart zones={zones} organizations={organizations} isSuperAdmin={isSuperAdmin} /></div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search city, area, driver or vehicle..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 bg-gray-50" />
            </div>
            {isSuperAdmin && (
              <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/25 min-w-[155px]">
                <option value="all">All Organizations</option>
                {organizations.map(o => <option key={o._id || o.id} value={o._id || o.id}>{o.name}</option>)}
              </select>
            )}
            <select value={selectedDuty} onChange={e => setSelectedDuty(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/25 min-w-[140px]">
              <option value="all">All Classes</option>
              <option value="light duty">🔵 Light Duty</option>
              <option value="medium duty">🟡 Medium Duty</option>
              <option value="heavy duty">🔴 Heavy Duty</option>
            </select>
            <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/25 min-w-[130px]">
              <option value="all">All Days</option>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40 bg-white/50 rounded-3xl border border-primary/10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-primary/60 text-sm">Loading zones...</p>
            </div>
          </div>
        ) : filteredZones.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 bg-white rounded-3xl border border-dashed border-primary/20 gap-2">
            <div className="text-4xl">📍</div>
            <p className="font-semibold text-primary">No zones found</p>
            <p className="text-sm text-primary/60">
              {searchQuery || selectedDay !== 'all' || selectedDuty !== 'all' ? 'Try adjusting your filters' : 'Click "Add Zone" to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredZones.map(zone => (
              <ZoneCard key={zone.id} zone={zone} isSuperAdmin={isSuperAdmin} onEdit={handleOpenEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {!isLoading && filteredZones.length > 0 && (
          <p className="text-xs text-primary/40 text-center">
            {filteredZones.length} of {zones.length} zones
          </p>
        )}
      </div>

      <ZoneModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        trucks={trucks}
        organizations={organizations}
        isSuperAdmin={isSuperAdmin}
        isSubmitting={isSubmitting}
        editZone={editZone}
      />
    </div>
  );
};

export default Zones;
