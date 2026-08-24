'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, Gift, HandHeart, Heart, IndianRupee, Pencil, Plus, Save, Trash2, TrendingUp } from 'lucide-react';

const categories = ['food', 'medicine', 'equipment', 'shelter', 'clothing', 'other'];
const catIcons = { food: '🍚', medicine: '💊', equipment: '🔧', shelter: '🏕️', clothing: '👕', other: '📦' };
const paymentMethods = ['upi', 'bank_transfer', 'card', 'cash'];

const emptyItemForm = { donor_name: '', donor_email: '', donor_phone: '', item_name: '', category: 'food', quantity: 1, unit: '', drop_location: '', notes: '' };
const emptyFinancialForm = { donor_name: '', donor_email: '', donor_phone: '', amount: '', currency: 'INR', payment_method: '', transaction_id: '', purpose: '', notes: '' };

function formatINR(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '₹0';
  const parts = num.toFixed(0).split('');
  const lastThree = parts.splice(-3).join('');
  const rest = parts.join('');
  const formatted = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree : lastThree;
  return '₹' + formatted;
}

function StatusBadge({ status, type = 'donation' }) {
  const colorMap = {
    donation: {
      pending: 'bg-amber-100 text-amber-800 border-amber-200',
      received: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      distributed: 'bg-sky-100 text-sky-800 border-sky-200'
    },
    financial: {
      pending: 'bg-amber-100 text-amber-800 border-amber-200',
      completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      refunded: 'bg-red-100 text-red-800 border-red-200'
    }
  };
  const colors = colorMap[type]?.[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium capitalize ${colors}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function DonationsPanel() {
  const [tab, setTab] = useState('items');
  const [donations, setDonations] = useState([]);
  const [financials, setFinancials] = useState({ totalAmount: 0, totalDonors: 0, donations: [] });
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [finStatusFilter, setFinStatusFilter] = useState('');
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [finForm, setFinForm] = useState(emptyFinancialForm);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editingFinId, setEditingFinId] = useState(null);
  const [editFinDraft, setEditFinDraft] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // ── Load item donations ──
  const itemQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter) p.set('status', statusFilter);
    if (categoryFilter) p.set('category', categoryFilter);
    return p.toString();
  }, [statusFilter, categoryFilter]);

  async function loadDonations() {
    setError('');
    const res = await fetch(`/api/donations${itemQuery ? `?${itemQuery}` : ''}`);
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Load failed'); }
    setDonations(await res.json());
  }

  useEffect(() => { loadDonations().catch((e) => setError(e.message)); }, [itemQuery]);

  // ── Load financial donations ──
  const finQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (finStatusFilter) p.set('status', finStatusFilter);
    return p.toString();
  }, [finStatusFilter]);

  async function loadFinancials() {
    setError('');
    const res = await fetch(`/api/donations/financial${finQuery ? `?${finQuery}` : ''}`);
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Load failed'); }
    setFinancials(await res.json());
  }

  useEffect(() => { loadFinancials().catch((e) => setError(e.message)); }, [finQuery]);

  // ── Item donation summary ──
  const itemSummary = useMemo(() => ({
    total: donations.length,
    pending: donations.filter(d => d.status === 'pending').length,
    received: donations.filter(d => d.status === 'received').length
  }), [donations]);

  // ── Create item donation ──
  async function createDonation(e) {
    e.preventDefault();
    setError(''); setNotice('');
    const res = await fetch('/api/donations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...itemForm, quantity: Number(itemForm.quantity) })
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Create failed'); return; }
    setItemForm(emptyItemForm);
    setNotice('Donation recorded successfully!');
    window.dispatchEvent(new CustomEvent('data:changed'));
    loadDonations().catch((e) => setError(e.message));
  }

  // ── Create financial donation ──
  async function createFinancial(e) {
    e.preventDefault();
    setError(''); setNotice('');
    const res = await fetch('/api/donations/financial', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...finForm, amount: Number(finForm.amount) })
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Create failed'); return; }
    setFinForm(emptyFinancialForm);
    setNotice('Financial donation recorded! Thank you for your generosity.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    loadFinancials().catch((e) => setError(e.message));
  }

  // ── Patch item donation ──
  async function saveDraft() {
    if (!editDraft) return;
    setError(''); setNotice('');
    const res = await fetch(`/api/donations/${editDraft.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editDraft, quantity: Number(editDraft.quantity) })
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Update failed'); return; }
    await res.json();
    setEditingId(null); setEditDraft(null);
    setNotice('Donation updated.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    loadDonations().catch((e) => setError(e.message));
  }

  // ── Patch financial donation ──
  async function saveFinDraft() {
    if (!editFinDraft) return;
    setError(''); setNotice('');
    const res = await fetch(`/api/donations/financial/${editFinDraft.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editFinDraft, amount: Number(editFinDraft.amount) })
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Update failed'); return; }
    await res.json();
    setEditingFinId(null); setEditFinDraft(null);
    setNotice('Financial donation updated.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    loadFinancials().catch((e) => setError(e.message));
  }

  // ── Quick status change: mark as received ──
  async function markReceived(id) {
    setError(''); setNotice('');
    const res = await fetch(`/api/donations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'received' })
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Update failed'); return; }
    setNotice('Marked as received — added to inventory.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    loadDonations().catch((e) => setError(e.message));
  }

  // ── Delete item donation ──
  async function deleteDonation(id) {
    setError(''); setNotice('');
    const res = await fetch(`/api/donations/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Delete failed'); return; }
    setDonations(c => c.filter(i => i.id !== id));
    setNotice('Donation removed.');
    window.dispatchEvent(new CustomEvent('data:changed'));
  }

  // ── Delete financial donation ──
  async function deleteFinancial(id) {
    setError(''); setNotice('');
    const res = await fetch(`/api/donations/financial/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Delete failed'); return; }
    setFinancials(c => ({ ...c, donations: c.donations.filter(i => i.id !== id) }));
    setNotice('Financial donation removed.');
    window.dispatchEvent(new CustomEvent('data:changed'));
  }

  // ── Form field updaters ──
  const updateItem = (f, v) => setItemForm(c => ({ ...c, [f]: v }));
  const updateFin = (f, v) => setFinForm(c => ({ ...c, [f]: v }));

  return (
    <div className="space-y-8">
      {/* ── Tab toggle ── */}
      <div className="flex items-center gap-1 rounded-2xl bg-[#F1F5F9] p-1 w-fit">
        <button
          onClick={() => setTab('items')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
            tab === 'items'
              ? 'bg-white text-[#0F172A] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Gift className="h-4 w-4" />Item Donations
        </button>
        <button
          onClick={() => setTab('financial')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
            tab === 'financial'
              ? 'bg-white text-[#0F172A] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <IndianRupee className="h-4 w-4" />Financial Donations
        </button>
      </div>

      {/* ── Notifications ── */}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      {/* ═══════════════════ ITEM DONATIONS TAB ═══════════════════ */}
      {tab === 'items' && (
        <>
          {/* Summary cards */}
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="group rounded-2xl border border-[#E2E8F0]/80 bg-white border-t-[3px] border-t-[#FF7A30] p-5 shadow-tier-mid transition-card hover:-translate-y-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-meta font-medium">Total Donations</p>
                  <p className="mt-1 text-[36px] font-black tracking-[-0.03em] text-[#0F172A]">{itemSummary.total}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#FF7A30]"><Heart className="h-5 w-5" /></div>
              </div>
            </div>
            <div className="group rounded-2xl border border-[#E2E8F0]/80 bg-white border-t-[3px] border-t-[#F59E0B] p-5 shadow-tier-mid transition-card hover:-translate-y-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-meta font-medium">Pending</p>
                  <p className="mt-1 text-[36px] font-black tracking-[-0.03em] text-[#F59E0B]">{itemSummary.pending}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[#F59E0B]"><AlertTriangle className="h-5 w-5" /></div>
              </div>
            </div>
            <div className="group rounded-2xl border border-[#E2E8F0]/80 bg-white border-t-[3px] border-t-[#10B981] p-5 shadow-tier-mid transition-card hover:-translate-y-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-meta font-medium">Items Received</p>
                  <p className="mt-1 text-[36px] font-black tracking-[-0.03em] text-[#10B981]">{itemSummary.received}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#10B981]"><Gift className="h-5 w-5" /></div>
              </div>
            </div>
          </section>

          {/* Add item donation form */}
          <form onSubmit={createDonation} className="rounded-2xl border border-[#E2E8F0]/80 bg-white p-4 shadow-tier-mid transition-card sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <HandHeart className="h-4 w-4 text-[#FF7A30]" />
              <h2 className="text-base font-semibold text-[#0F172A]">Record Item Donation</h2>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.2fr_130px_100px_110px_1fr_auto]">
              <input required value={itemForm.donor_name} onChange={(e) => updateItem('donor_name', e.target.value)} placeholder="Donor name" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <input value={itemForm.donor_email} onChange={(e) => updateItem('donor_email', e.target.value)} placeholder="Email (optional)" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <input value={itemForm.donor_phone} onChange={(e) => updateItem('donor_phone', e.target.value)} placeholder="Phone (optional)" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <input required value={itemForm.item_name} onChange={(e) => updateItem('item_name', e.target.value)} placeholder="Item name" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <select value={itemForm.category} onChange={(e) => updateItem('category', e.target.value)} className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white">
                {categories.map((c) => <option key={c} value={c}>{catIcons[c]} {c}</option>)}
              </select>
              <input required type="number" min="1" value={itemForm.quantity} onChange={(e) => updateItem('quantity', e.target.value)} placeholder="Qty" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <input required value={itemForm.unit} onChange={(e) => updateItem('unit', e.target.value)} placeholder="Unit (kg, pcs)" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <input value={itemForm.drop_location} onChange={(e) => updateItem('drop_location', e.target.value)} placeholder="Drop location" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <button type="submit" className="flex h-[46px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7A30] to-[#FF9A5A] px-4 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-all duration-200 hover:shadow-lg hover:brightness-105">
                <Plus className="h-4 w-4" />Add
              </button>
            </div>
            <input value={itemForm.notes} onChange={(e) => updateItem('notes', e.target.value)} placeholder="Notes (optional)" className="mt-3 w-full h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
          </form>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-meta font-medium">Filter:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="distributed">Distributed</option>
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{catIcons[c]} {c}</option>)}
            </select>
            <span className="ml-auto text-meta">{donations.length} donation{donations.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Item Donations Table */}
          <div className="overflow-hidden rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid transition-card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#E2E8F0]/60">
                <thead>
                  <tr className="bg-[#F8FAFC]/80">
                    <th className="px-6 py-3 text-left text-label">Donor</th>
                    <th className="px-6 py-3 text-left text-label">Item</th>
                    <th className="px-6 py-3 text-left text-label">Category</th>
                    <th className="px-6 py-3 text-left text-label">Qty</th>
                    <th className="px-6 py-3 text-left text-label">Drop Location</th>
                    <th className="px-6 py-3 text-left text-label">Status</th>
                    <th className="px-6 py-3 text-left text-label">Date</th>
                    <th className="px-6 py-3 text-right text-label">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {donations.map((d) => (
                    <tr key={d.id} className="transition-row hover:bg-[#F8FAFC]/80">
                      {editingId === d.id && editDraft ? (
                        <>
                          <td className="px-3 py-2"><input value={editDraft.donor_name} onChange={(e) => setEditDraft((c) => ({ ...c, donor_name: e.target.value }))} className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" /></td>
                          <td className="px-3 py-2"><input value={editDraft.item_name} onChange={(e) => setEditDraft((c) => ({ ...c, item_name: e.target.value }))} className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" /></td>
                          <td className="px-3 py-2">
                            <select value={editDraft.category} onChange={(e) => setEditDraft((c) => ({ ...c, category: e.target.value }))} className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
                              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2"><input type="number" min="1" value={editDraft.quantity} onChange={(e) => setEditDraft((c) => ({ ...c, quantity: e.target.value }))} className="h-9 w-24 rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" /></td>
                          <td className="px-3 py-2"><input value={editDraft.drop_location || ''} onChange={(e) => setEditDraft((c) => ({ ...c, drop_location: e.target.value }))} className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" /></td>
                          <td className="px-3 py-2">
                            <select value={editDraft.status} onChange={(e) => setEditDraft((c) => ({ ...c, status: e.target.value }))} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
                              <option value="pending">Pending</option>
                              <option value="received">Received</option>
                              <option value="distributed">Distributed</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-sm text-[#94A3B8]">{new Date(editDraft.created_at).toLocaleDateString()}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={saveDraft} className="rounded-lg p-2 text-[#10B981] hover:bg-emerald-50 transition" title="Save"><Save className="h-4 w-4" /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-3.5">
                            <p className="text-sm font-semibold text-[#0F172A]">{d.donor_name}</p>
                            {d.donor_email && <p className="text-xs text-[#94A3B8]">{d.donor_email}</p>}
                          </td>
                          <td className="px-6 py-3.5 text-sm font-medium text-[#0F172A]">{d.item_name}</td>
                          <td className="px-6 py-3.5">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium capitalize text-[#475569]">
                              {catIcons[d.category]} {d.category}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-sm text-[#475569]">{d.quantity} {d.unit}</td>
                          <td className="px-6 py-3.5 text-sm text-[#64748B]">{d.drop_location || '—'}</td>
                          <td className="px-6 py-3.5"><StatusBadge status={d.status} type="donation" /></td>
                          <td className="px-6 py-3.5 text-sm text-[#94A3B8]">{new Date(d.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              {d.status === 'pending' && (
                                <button onClick={() => markReceived(d.id)} className="rounded-lg p-2 text-[#10B981] hover:bg-emerald-50 transition" title="Mark as Received">
                                  <Gift className="h-4 w-4" />
                                </button>
                              )}
                              <button onClick={() => { setEditingId(d.id); setEditDraft({ ...d }); }} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition" title="Edit"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => deleteDonation(d.id)} className="rounded-lg p-2 text-[#CBD5E1] hover:bg-red-50 hover:text-red-500 transition" title="Delete"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {donations.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-[#94A3B8]">No item donations found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════ FINANCIAL DONATIONS TAB ═══════════════════ */}
      {tab === 'financial' && (
        <>
          {/* Summary cards */}
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="group rounded-2xl border border-[#E2E8F0]/80 bg-white border-t-[3px] border-t-[#10B981] p-5 shadow-tier-mid transition-card hover:-translate-y-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-meta font-medium">Total Raised</p>
                  <p className="mt-1 text-[32px] font-black tracking-[-0.03em] text-[#10B981]">{formatINR(financials.totalAmount)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#10B981]"><Banknote className="h-5 w-5" /></div>
              </div>
            </div>
            <div className="group rounded-2xl border border-[#E2E8F0]/80 bg-white border-t-[3px] border-t-[#0EA5E9] p-5 shadow-tier-mid transition-card hover:-translate-y-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-meta font-medium">Total Donors</p>
                  <p className="mt-1 text-[36px] font-black tracking-[-0.03em] text-[#0EA5E9]">{financials.totalDonors}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[#0EA5E9]"><Heart className="h-5 w-5" /></div>
              </div>
            </div>
            <div className="group rounded-2xl border border-[#E2E8F0]/80 bg-white border-t-[3px] border-t-[#FF7A30] p-5 shadow-tier-mid transition-card hover:-translate-y-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-meta font-medium">Avg Donation</p>
                  <p className="mt-1 text-[32px] font-black tracking-[-0.03em] text-[#FF7A30]">
                    {financials.totalDonors > 0 ? formatINR(financials.totalAmount / financials.totalDonors) : '₹0'}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#FF7A30]"><TrendingUp className="h-5 w-5" /></div>
              </div>
            </div>
          </section>

          {/* Add financial donation form */}
          <form onSubmit={createFinancial} className="rounded-2xl border border-[#E2E8F0]/80 bg-white p-4 shadow-tier-mid transition-card sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <IndianRupee className="h-4 w-4 text-[#FF7A30]" />
              <h2 className="text-base font-semibold text-[#0F172A]">Record Financial Donation</h2>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_120px_100px_130px_1fr_auto]">
              <input required value={finForm.donor_name} onChange={(e) => updateFin('donor_name', e.target.value)} placeholder="Donor name" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <input value={finForm.donor_email} onChange={(e) => updateFin('donor_email', e.target.value)} placeholder="Email (optional)" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <input value={finForm.donor_phone} onChange={(e) => updateFin('donor_phone', e.target.value)} placeholder="Phone (optional)" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <input required type="number" min="1" step="0.01" value={finForm.amount} onChange={(e) => updateFin('amount', e.target.value)} placeholder="Amount" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <input value={finForm.currency} onChange={(e) => updateFin('currency', e.target.value)} placeholder="INR" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <select value={finForm.payment_method} onChange={(e) => updateFin('payment_method', e.target.value)} className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white">
                <option value="">Payment method</option>
                {paymentMethods.map((m) => <option key={m} value={m}>{m === 'upi' ? 'UPI' : m === 'bank_transfer' ? 'Bank Transfer' : m === 'card' ? 'Card' : 'Cash'}</option>)}
              </select>
              <input value={finForm.purpose} onChange={(e) => updateFin('purpose', e.target.value)} placeholder="Purpose (optional)" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <button type="submit" className="flex h-[46px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7A30] to-[#FF9A5A] px-4 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-all duration-200 hover:shadow-lg hover:brightness-105">
                <Plus className="h-4 w-4" />Add
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input value={finForm.transaction_id} onChange={(e) => updateFin('transaction_id', e.target.value)} placeholder="Transaction ID (optional)" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
              <input value={finForm.notes} onChange={(e) => updateFin('notes', e.target.value)} placeholder="Notes (optional)" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
            </div>
          </form>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <span className="text-meta font-medium">Filter:</span>
            <select value={finStatusFilter} onChange={(e) => setFinStatusFilter(e.target.value)} className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
            </select>
            <span className="ml-auto text-meta">{financials.donations.length} donation{financials.donations.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Financial Donations Table */}
          <div className="overflow-hidden rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid transition-card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#E2E8F0]/60">
                <thead>
                  <tr className="bg-[#F8FAFC]/80">
                    <th className="px-6 py-3 text-left text-label">Donor</th>
                    <th className="px-6 py-3 text-left text-label">Amount</th>
                    <th className="px-6 py-3 text-left text-label">Payment</th>
                    <th className="px-6 py-3 text-left text-label">Purpose</th>
                    <th className="px-6 py-3 text-left text-label">Status</th>
                    <th className="px-6 py-3 text-left text-label">Date</th>
                    <th className="px-6 py-3 text-right text-label">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {financials.donations.map((d) => (
                    <tr key={d.id} className="transition-row hover:bg-[#F8FAFC]/80">
                      {editingFinId === d.id && editFinDraft ? (
                        <>
                          <td className="px-3 py-2"><input value={editFinDraft.donor_name} onChange={(e) => setEditFinDraft((c) => ({ ...c, donor_name: e.target.value }))} className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" /></td>
                          <td className="px-3 py-2"><input type="number" min="0.01" step="0.01" value={editFinDraft.amount} onChange={(e) => setEditFinDraft((c) => ({ ...c, amount: e.target.value }))} className="h-9 w-28 rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" /></td>
                          <td className="px-3 py-2">
                            <select value={editFinDraft.payment_method || ''} onChange={(e) => setEditFinDraft((c) => ({ ...c, payment_method: e.target.value }))} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
                              <option value="">—</option>
                              {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2"><input value={editFinDraft.purpose || ''} onChange={(e) => setEditFinDraft((c) => ({ ...c, purpose: e.target.value }))} className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" /></td>
                          <td className="px-3 py-2">
                            <select value={editFinDraft.status} onChange={(e) => setEditFinDraft((c) => ({ ...c, status: e.target.value }))} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                              <option value="refunded">Refunded</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-sm text-[#94A3B8]">{new Date(editFinDraft.created_at).toLocaleDateString()}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={saveFinDraft} className="rounded-lg p-2 text-[#10B981] hover:bg-emerald-50 transition" title="Save"><Save className="h-4 w-4" /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-3.5">
                            <p className="text-sm font-semibold text-[#0F172A]">{d.donor_name}</p>
                            {d.donor_email && <p className="text-xs text-[#94A3B8]">{d.donor_email}</p>}
                          </td>
                          <td className="px-6 py-3.5 text-sm font-bold text-[#10B981]">{formatINR(d.amount)}</td>
                          <td className="px-6 py-3.5">
                            {d.payment_method ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium capitalize text-[#475569]">
                                {d.payment_method === 'upi' ? 'UPI' : d.payment_method === 'bank_transfer' ? 'Bank Transfer' : d.payment_method === 'card' ? 'Card' : d.payment_method === 'cash' ? 'Cash' : d.payment_method}
                              </span>
                            ) : <span className="text-sm text-[#94A3B8]">—</span>}
                          </td>
                          <td className="px-6 py-3.5 text-sm text-[#64748B] max-w-[200px] truncate">{d.purpose || '—'}</td>
                          <td className="px-6 py-3.5"><StatusBadge status={d.status} type="financial" /></td>
                          <td className="px-6 py-3.5 text-sm text-[#94A3B8]">{new Date(d.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { setEditingFinId(d.id); setEditFinDraft({ ...d }); }} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition" title="Edit"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => deleteFinancial(d.id)} className="rounded-lg p-2 text-[#CBD5E1] hover:bg-red-50 hover:text-red-500 transition" title="Delete"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {financials.donations.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-[#94A3B8]">No financial donations found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
