'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Box, Layers, Package, Pencil, Plus, Save, Trash2 } from 'lucide-react';

const categories = ['food', 'medicine', 'equipment', 'shelter', 'clothing', 'other'];
const emptyForm = { item_name: '', category: 'food', quantity: 0, unit: '', location_name: '', latitude: 26.1445, longitude: 91.7362 };

const catIcons = { food: '🍚', medicine: '💊', equipment: '🔧', shelter: '🏕️', clothing: '👕', other: '📦' };

export default function InventoryPanel() {
  const [items, setItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (categoryFilter) p.set('category', categoryFilter);
    return p.toString();
  }, [categoryFilter]);

  async function loadItems() {
    setError('');
    const res = await fetch(`/api/inventory${query ? `?${query}` : ''}`);
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Load failed'); }
    setItems(await res.json());
  }

  useEffect(() => { loadItems().catch((e) => setError(e.message)); }, [query]);

  const summary = useMemo(() => ({
    totalItems: items.reduce((t, i) => t + i.quantity, 0),
    lowStock: items.filter((i) => i.quantity < 10).length,
    categoryCount: new Set(items.map((i) => i.category)).size
  }), [items]);

  const updateForm = (field, value) => setForm((c) => ({ ...c, [field]: value }));

  async function createItem(event) {
    event.preventDefault();
    setError(''); setNotice('');
    const res = await fetch('/api/inventory', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, quantity: Number(form.quantity), latitude: Number(form.latitude), longitude: Number(form.longitude) })
    });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Create failed'); return; }
    setForm(emptyForm);
    setNotice('Item added.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    loadItems().catch((e) => setError(e.message));
  }

  async function patchItem(id, updates) {
    setError(''); setNotice('');
    const res = await fetch(`/api/inventory/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Update failed'); return null; }
    const updated = await res.json();
    setItems((c) => c.map((i) => (i.id === id ? updated : i)));
    setNotice('Item updated.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    return updated;
  }

  async function deleteItem(id) {
    setError(''); setNotice('');
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Delete failed'); return; }
    setItems((c) => c.filter((i) => i.id !== id));
    setNotice('Item removed.');
    window.dispatchEvent(new CustomEvent('data:changed'));
  }

  async function saveDraft() {
    if (!editDraft) return;
    const updated = await patchItem(editDraft.id, { ...editDraft, quantity: Number(editDraft.quantity), latitude: Number(editDraft.latitude), longitude: Number(editDraft.longitude) });
    if (updated) { setEditingId(null); setEditDraft(null); }
  }

  // Inline editable cell component
  function EditableCell({ editing, value, onChange, type = 'text', className = '' }) {
    if (!editing) return null;
    return (
      <td className="px-3 py-2">
        {type === 'select' ? (
          <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={`h-9 rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 ${className}`} />
        )}
      </td>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="group rounded-2xl border border-[#E2E8F0]/80 bg-white border-t-[3px] border-t-[#0EA5E9] p-5 shadow-tier-mid transition-card hover:-translate-y-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-meta font-medium">Total Quantity</p>
              <p className="mt-1 text-[36px] font-black tracking-[-0.03em] text-[#0F172A]">{summary.totalItems}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[#0EA5E9]">
              <Package className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="group rounded-2xl border border-[#E2E8F0]/80 bg-white border-t-[3px] border-t-[#F59E0B] p-5 shadow-tier-mid transition-card hover:-translate-y-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-meta font-medium">Low Stock Items</p>
              <p className="mt-1 text-[36px] font-black tracking-[-0.03em] text-[#F59E0B]">{summary.lowStock}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[#F59E0B]">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="group rounded-2xl border border-[#E2E8F0]/80 bg-white border-t-[3px] border-t-[#10B981] p-5 shadow-tier-mid transition-card hover:-translate-y-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-meta font-medium">Categories</p>
              <p className="mt-1 text-[36px] font-black tracking-[-0.03em] text-[#10B981]">{summary.categoryCount}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#10B981]">
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      {/* Add form */}
      <form onSubmit={createItem} className="rounded-2xl border border-[#E2E8F0]/80 bg-white p-4 shadow-tier-mid transition-card sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Box className="h-4 w-4 text-[#FF7A30]" />
          <h2 className="text-base font-semibold text-[#0F172A]">Add Inventory Item</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1.2fr_140px_110px_110px_1.2fr_110px_110px_auto]">
          <input required value={form.item_name} onChange={(e) => updateForm('item_name', e.target.value)} placeholder="Item name" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
          <select value={form.category} onChange={(e) => updateForm('category', e.target.value)} className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white">
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input required type="number" min="0" value={form.quantity} onChange={(e) => updateForm('quantity', e.target.value)} placeholder="Qty" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
          <input required value={form.unit} onChange={(e) => updateForm('unit', e.target.value)} placeholder="Unit" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
          <input required value={form.location_name} onChange={(e) => updateForm('location_name', e.target.value)} placeholder="Storage location" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
          <input required type="number" step="0.0001" value={form.latitude} onChange={(e) => updateForm('latitude', e.target.value)} placeholder="Lat" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
          <input required type="number" step="0.0001" value={form.longitude} onChange={(e) => updateForm('longitude', e.target.value)} placeholder="Lng" className="h-[46px] rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
          <button type="submit" className="flex h-[46px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7A30] to-[#FF9A5A] px-4 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-all duration-200 hover:shadow-lg hover:brightness-105">
            <Plus className="h-4 w-4" />Add
          </button>
        </div>
      </form>

      {/* Notifications */}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-meta font-medium">Filter:</span>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{catIcons[c]} {c}</option>)}
        </select>
        <span className="ml-auto text-meta">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid transition-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#E2E8F0]/60">
            <thead>
              <tr className="bg-[#F8FAFC]/80">
                <th className="px-6 py-3 text-left text-label">Item</th>
                <th className="px-6 py-3 text-left text-label">Category</th>
                <th className="px-6 py-3 text-left text-label">Quantity</th>
                <th className="px-6 py-3 text-left text-label">Location</th>
                <th className="px-6 py-3 text-right text-label">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {items.map((item) => (
                <tr key={item.id} className="transition-row hover:bg-[#F8FAFC]/80">
                  {editingId === item.id && editDraft ? (
                    <>
                      <td className="px-3 py-2"><input value={editDraft.item_name} onChange={(e) => setEditDraft((c) => ({ ...c, item_name: e.target.value }))} className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" /></td>
                      <td className="px-3 py-2">
                        <select value={editDraft.category} onChange={(e) => setEditDraft((c) => ({ ...c, category: e.target.value }))} className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
                          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2"><input type="number" min="0" value={editDraft.quantity} onChange={(e) => setEditDraft((c) => ({ ...c, quantity: e.target.value }))} className="h-9 w-24 rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" /></td>
                      <td className="px-3 py-2"><input value={editDraft.location_name} onChange={(e) => setEditDraft((c) => ({ ...c, location_name: e.target.value }))} className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 text-sm text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" /></td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={saveDraft} className="rounded-lg p-2 text-[#10B981] hover:bg-emerald-50 transition" title="Save"><Save className="h-4 w-4" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-3.5 text-sm font-medium text-[#0F172A]">{item.item_name}</td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium capitalize text-[#475569]">
                          {catIcons[item.category]} {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-sm ${item.quantity < 10 ? 'text-[#F59E0B] font-semibold' : 'text-[#475569]'}`}>
                          {item.quantity} {item.unit}
                          {item.quantity < 10 && <AlertTriangle className="h-3.5 w-3.5" />}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-sm text-[#64748B]">{item.location_name}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setEditingId(item.id); setEditDraft({ ...item }); }} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition" title="Edit"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => deleteItem(item.id)} className="rounded-lg p-2 text-[#CBD5E1] hover:bg-red-50 hover:text-red-500 transition" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
