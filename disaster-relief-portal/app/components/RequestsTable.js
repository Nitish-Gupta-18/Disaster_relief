'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Package, Trash2, UserPlus, Users, X } from 'lucide-react';

const statuses = ['pending', 'assigned', 'in_progress', 'completed'];
const types = ['food', 'water', 'medicine', 'shelter'];
const urgencies = ['low', 'medium', 'high', 'critical'];

const urgencyBadgeBg = {
  critical: 'pill-badge pill-critical',
  high: 'pill-badge pill-high',
  medium: 'pill-badge pill-medium',
  low: 'pill-badge pill-low'
};

const statusBadgeBg = {
  pending: 'pill-badge pill-pending',
  assigned: 'pill-badge pill-assigned',
  in_progress: 'pill-badge pill-in_progress',
  completed: 'pill-badge pill-completed'
};

function label(value) { return value.replace(/_/g, ' '); }

function StripeBadge({ value, variant = 'urgency' }) {
  const cls = variant === 'urgency'
    ? `status-stripe status-stripe-urg-${value}`
    : `status-stripe status-stripe-${value}`;
  return <span className={cls}>{label(value)}</span>;
}

function StatusStepper({ currentStatus }) {
  const idx = statuses.indexOf(currentStatus);
  return (
    <div className="flex min-w-[320px] items-center">
      {statuses.map((step, i) => {
        const reached = i <= idx;
        return (
          <div key={step} className="flex flex-1 items-center">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all duration-300 ${
              reached ? 'border-[#FF7A30] bg-[#FF7A30] text-white shadow-sm shadow-orange-500/20' : 'border-[#CBD5E1] bg-white text-[#94A3B8]'
            }`}>
              {reached ? (i < idx ? <CheckCircle2 className="h-3 w-3" /> : i + 1) : i + 1}
            </div>
            <span className={`ml-2 hidden text-xs font-medium capitalize xl:inline ${reached ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
              {label(step)}
            </span>
            {i < statuses.length - 1 && (
              <div className={`mx-2 h-0.5 flex-1 rounded-full transition-colors duration-300 ${i < idx ? 'bg-[#FF7A30]' : 'bg-[#E2E8F0]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RequestsTable({ requests, filters, onFiltersChange, onRefresh }) {
  const [selectedId, setSelectedId] = useState(null);
  const [volunteers, setVolunteers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [assignment, setAssignment] = useState({ volunteerId: '', inventoryId: '', quantity: 1 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedRequest = useMemo(() => requests.find((r) => r.id === selectedId), [requests, selectedId]);

  useEffect(() => {
    async function loadOpts() {
      const [vRes, iRes] = await Promise.all([fetch('/api/volunteers'), fetch('/api/inventory')]);
      setVolunteers(await vRes.json());
      setInventory(await iRes.json());
    }
    loadOpts().catch(() => setError('Unable to load assignment options'));
  }, []);

  useEffect(() => {
    if (requests.length && !requests.some((r) => r.id === selectedId)) setSelectedId(null);
  }, [requests, selectedId]);

  const changeFilter = (field, value) => onFiltersChange({ ...filters, [field]: value });

  async function patchStatus(requestId, status) {
    setError(''); setNotice('');
    const res = await fetch(`/api/requests/${requestId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Update failed'); return; }
    setNotice('Status updated.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    onRefresh();
  }

  async function assignVolunteer() {
    if (!selectedRequest || !assignment.volunteerId) return;
    setError(''); setNotice('');
    const res = await fetch(`/api/requests/${selectedRequest.id}/assign-volunteer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ volunteerId: Number(assignment.volunteerId) })
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Assign failed'); return; }
    setAssignment((c) => ({ ...c, volunteerId: '' }));
    setNotice('Volunteer assigned.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    onRefresh();
  }

  async function assignResource() {
    if (!selectedRequest || !assignment.inventoryId) return;
    setError(''); setNotice('');
    const res = await fetch(`/api/requests/${selectedRequest.id}/assign-resources`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inventoryId: Number(assignment.inventoryId), quantity: Number(assignment.quantity) })
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Assign failed'); return; }
    setAssignment((c) => ({ ...c, inventoryId: '', quantity: 1 }));
    setNotice('Resource allocated.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    onRefresh();
  }

  async function deleteRequest(requestId) {
    setError(''); setNotice('');
    const res = await fetch(`/api/requests/${requestId}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Delete failed'); return; }
    if (selectedId === requestId) setSelectedId(null);
    setNotice('Request removed.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    onRefresh();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid transition-card">
      {/* Header with filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0]/60 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">Relief Requests</h2>
          <p className="text-meta">{requests.length} request{requests.length !== 1 ? 's' : ''} in view</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filters.status} onChange={(e) => changeFilter('status', e.target.value)} className="h-9 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
            <option value="">All status</option>
            {statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <select value={filters.type} onChange={(e) => changeFilter('type', e.target.value)} className="h-9 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
            <option value="">All type</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.urgency} onChange={(e) => changeFilter('urgency', e.target.value)} className="h-9 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
            <option value="">All urgency</option>
            {urgencies.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Notifications */}
      {error && <div className="mx-6 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">{error}</div>}
      {notice && <div className="mx-6 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">{notice}</div>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E2E8F0]/60">
          <thead>
            <tr className="bg-[#F8FAFC]/80">
              <th className="px-6 py-3 text-left text-label">Location</th>
              <th className="px-6 py-3 text-left text-label">Type</th>
              <th className="px-6 py-3 text-left text-label">Urgency</th>
              <th className="px-6 py-3 text-left text-label">Family</th>
              <th className="px-6 py-3 text-left text-label">Status</th>
              <th className="px-6 py-3 text-right text-label">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {!requests ? (
              /* Loading skeleton */
              [...Array(5)].map((_, i) => (
                <tr key={`skel-${i}`}>
                  <td className="px-6 py-4"><div className="skeleton-row w-32" /></td>
                  <td className="px-6 py-4"><div className="skeleton-row w-20" /></td>
                  <td className="px-6 py-4"><div className="skeleton-row w-16" /></td>
                  <td className="px-6 py-4"><div className="skeleton-row w-12" /></td>
                  <td className="px-6 py-4"><div className="skeleton-row w-20" /></td>
                  <td className="px-6 py-4"><div className="skeleton-row w-16 ml-auto" /></td>
                </tr>
              ))
            ) : requests.length === 0 ? (
              /* Empty state */
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F5F9] text-[#94A3B8] mb-3">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A]">No requests found</p>
                  <p className="mt-1 text-meta">Try adjusting your filters or clear them to see all requests.</p>
                  <button onClick={() => onFiltersChange({ status: '', type: '', urgency: '' })}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] hover:border-[#FF7A30] hover:text-[#FF7A30] transition-all duration-200">
                    <X className="h-3 w-3" />Clear filters
                  </button>
                </td>
              </tr>
            ) : (
              requests.map((r, i) => (
              <tr key={r.id} className={`transition-row hover:bg-[#F8FAFC]/80 ${selectedId === r.id ? 'bg-orange-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]/30'}`}>
                <td className="px-6 py-3.5 text-sm font-medium text-[#0F172A]">{r.location}</td>
                <td className="px-6 py-3.5 text-sm capitalize text-[#475569]">{r.type}</td>
                <td className="px-6 py-3.5"><StripeBadge value={r.urgency} variant="urgency" /></td>
                <td className="px-6 py-3.5 text-sm text-[#475569]">{r.family_size}</td>
                <td className="px-6 py-3.5"><StripeBadge value={r.status} variant="status" /></td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setSelectedId(selectedId === r.id ? null : r.id)} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition-colors duration-150" title={selectedId === r.id ? 'Collapse' : 'Expand'}>
                      {selectedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button onClick={() => deleteRequest(r.id)} className="rounded-lg p-2 text-[#CBD5E1] hover:bg-red-50 hover:text-red-500 transition-colors duration-150" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>

      {/* Expanded detail panel */}
      {selectedRequest && (
        <div className="border-t border-[#E2E8F0]/60 bg-[#F8FAFC]/40 p-6 space-y-5 animate-slide-up">
          <div>
            <h3 className="text-base font-semibold text-[#0F172A]">{selectedRequest.location}</h3>
            {selectedRequest.description && (
              <p className="mt-1 text-meta">{selectedRequest.description}</p>
            )}
          </div>

          <StatusStepper currentStatus={selectedRequest.status} />

          <div className="grid gap-4 md:grid-cols-2">
            {/* Status update */}
            <div className="rounded-xl border border-[#E2E8F0]/60 bg-white p-4 shadow-tier-low transition-card">
              <p className="text-sm font-semibold text-[#0F172A] mb-3">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {statuses.map((s) => (
                  <button key={s} disabled={s === selectedRequest.status} onClick={() => patchStatus(selectedRequest.id, s)}
                    className={`rounded-lg px-3.5 py-2 text-xs font-semibold capitalize transition-all duration-200 ${
                      s === selectedRequest.status
                        ? 'bg-[#10B981] text-white shadow-sm'
                        : 'border border-[#E2E8F0] bg-white text-[#475569] hover:border-[#FF7A30] hover:text-[#FF7A30]'
                    }`}>
                    {label(s)}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignment panels */}
            <div className="space-y-3">
              {/* Assign volunteer */}
              <div className="rounded-xl border border-[#E2E8F0]/60 bg-white p-4 shadow-tier-low transition-card">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-[#0EA5E9]" />
                  <p className="text-sm font-semibold text-[#0F172A]">Assign Volunteer</p>
                </div>
                <div className="flex gap-2">
                  <select value={assignment.volunteerId} onChange={(e) => setAssignment((c) => ({ ...c, volunteerId: e.target.value }))}
                    className="flex-1 h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
                    <option value="">Select volunteer</option>
                    {volunteers.filter((v) => v.is_available).map((v) => <option key={v.id} value={v.id}>{v.name} — {v.location_name}</option>)}
                  </select>
                  <button onClick={assignVolunteer} disabled={!assignment.volunteerId}
                    className="h-9 rounded-lg bg-[#0EA5E9] px-4 text-xs font-semibold text-white hover:bg-sky-600 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed">
                    Assign
                  </button>
                </div>
              </div>

              {/* Assign resource */}
              <div className="rounded-xl border border-[#E2E8F0]/60 bg-white p-4 shadow-tier-low transition-card">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-[#10B981]" />
                  <p className="text-sm font-semibold text-[#0F172A]">Assign Resource</p>
                </div>
                <div className="flex gap-2">
                  <select value={assignment.inventoryId} onChange={(e) => setAssignment((c) => ({ ...c, inventoryId: e.target.value }))}
                    className="flex-1 h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
                    <option value="">Select resource</option>
                    {inventory.filter((i) => i.quantity > 0).map((i) => <option key={i.id} value={i.id}>{i.item_name} ({i.quantity} {i.unit})</option>)}
                  </select>
                  <input type="number" min="1" max="9999" step="1" inputMode="numeric" value={assignment.quantity}
                    onChange={(e) => { const v = e.target.value; if (v === '') { setAssignment((c) => ({ ...c, quantity: '' })); return; } const n = parseInt(v, 10); if (!isNaN(n) && n >= 1 && n <= 9999) setAssignment((c) => ({ ...c, quantity: n })); }}
                    onBlur={() => { const n = parseInt(assignment.quantity, 10); if (isNaN(n) || n < 1) setAssignment((c) => ({ ...c, quantity: 1 })); }}
                    className="w-20 h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" />
                  <button onClick={assignResource} disabled={!assignment.inventoryId}
                    className="h-9 rounded-lg bg-[#10B981] px-4 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed">
                    Allocate
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Assigned items lists */}
          {(selectedRequest.assigned_volunteers?.length > 0 || selectedRequest.assigned_resources?.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {selectedRequest.assigned_volunteers?.length > 0 && (
                <div className="rounded-xl border border-[#E2E8F0]/60 bg-white p-4">
                  <p className="text-sm font-semibold text-[#0F172A] mb-2">Assigned Volunteers</p>
                  <ul className="space-y-1.5">
                    {selectedRequest.assigned_volunteers.map((v) => (
                      <li key={v.id} className="text-sm text-[#475569] flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5E9]" />{v.name} — {v.skills?.join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedRequest.assigned_resources?.length > 0 && (
                <div className="rounded-xl border border-[#E2E8F0]/60 bg-white p-4">
                  <p className="text-sm font-semibold text-[#0F172A] mb-2">Assigned Resources</p>
                  <ul className="space-y-1.5">
                    {selectedRequest.assigned_resources.map((r) => (
                      <li key={r.inventory_id} className="text-sm text-[#475569] flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />{r.item_name} × {r.quantity} {r.unit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
