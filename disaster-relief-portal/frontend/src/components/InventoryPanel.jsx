import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Minus, Pencil, Plus, Save, Trash2 } from 'lucide-react';

const categories = ['food', 'medicine', 'equipment', 'shelter'];
const emptyForm = {
  item_name: '',
  category: 'food',
  quantity: 0,
  unit: '',
  location_name: '',
  latitude: 26.1445,
  longitude: 91.7362
};

export default function InventoryPanel() {
  const [items, setItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set('category', categoryFilter);
    return params.toString();
  }, [categoryFilter]);

  async function loadItems() {
    setError('');
    const response = await fetch(`/api/inventory${query ? `?${query}` : ''}`);
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Unable to load inventory');
    }
    setItems(await response.json());
  }

  useEffect(() => {
    loadItems().catch((loadError) => setError(loadError.message));
  }, [query]);

  const summary = useMemo(() => {
    const categoryCount = new Set(items.map((item) => item.category)).size;
    return {
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      lowStock: items.filter((item) => item.quantity < 10).length,
      categoryCount
    };
  }, [items]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  async function createItem(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        quantity: Number(form.quantity),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude)
      })
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to add inventory item');
      return;
    }
    setForm(emptyForm);
    setNotice('Inventory item added successfully.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    loadItems().catch((loadError) => setError(loadError.message));
  }

  async function patchItem(id, updates) {
    setError('');
    setNotice('');
    const response = await fetch(`/api/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to update inventory item');
      return null;
    }
    const updated = await response.json();
    setItems((current) => current.map((item) => (item.id === id ? updated : item)));
    setNotice('Inventory updated successfully.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    return updated;
  }

  async function deleteItem(id) {
    setError('');
    setNotice('');
    const response = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to delete inventory item');
      return;
    }
    setItems((current) => current.filter((item) => item.id !== id));
    setNotice('Inventory item removed.');
    window.dispatchEvent(new CustomEvent('data:changed'));
  }

  async function saveDraft() {
    if (!editDraft) return;
    const updated = await patchItem(editDraft.id, {
      ...editDraft,
      quantity: Number(editDraft.quantity),
      latitude: Number(editDraft.latitude),
      longitude: Number(editDraft.longitude)
    });
    if (updated) {
      setEditingId(null);
      setEditDraft(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)]">
          <p className="text-sm font-medium text-slate-500">Total quantity</p>
          <p className="mt-2 text-[28px] font-semibold text-slate-900">{summary.totalItems}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)]">
          <p className="text-sm font-medium text-slate-500">Low stock items</p>
          <p className="mt-2 text-[28px] font-semibold text-amber-500">{summary.lowStock}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_16px_45px_-24px_rgba(15,23,42,0.35)]">
          <p className="text-sm font-medium text-slate-500">Categories stocked</p>
          <p className="mt-2 text-[28px] font-semibold text-relief-teal">{summary.categoryCount}</p>
        </div>
      </section>

      <form onSubmit={createItem} className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.28)] sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_150px_130px_120px_1.2fr_120px_120px_auto]">
          <input
            required
            value={form.item_name}
            onChange={(event) => updateForm('item_name', event.target.value)}
            placeholder="Item name"
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
          />
          <select
            value={form.category}
            onChange={(event) => updateForm('category', event.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input
            required
            type="number"
            min="0"
            value={form.quantity}
            onChange={(event) => updateForm('quantity', event.target.value)}
            placeholder="Qty"
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
          />
          <input
            required
            value={form.unit}
            onChange={(event) => updateForm('unit', event.target.value)}
            placeholder="Unit"
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
          />
          <input
            required
            value={form.location_name}
            onChange={(event) => updateForm('location_name', event.target.value)}
            placeholder="Storage location"
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
          />
          <input
            required
            type="number"
            step="0.0001"
            value={form.latitude}
            onChange={(event) => updateForm('latitude', event.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
          />
          <input
            required
            type="number"
            step="0.0001"
            value={form.longitude}
            onChange={(event) => updateForm('longitude', event.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
          />
          <button className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-relief-orange to-orange-400 px-4 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:shadow-xl">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {notice && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}
      </form>

      <section className="rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Resource Inventory</h2>
            <p className="mt-1 text-sm text-slate-500">{items.length} item records</p>
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-relief-orange"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((item) => {
            const lowStock = item.quantity < 10;
            const editing = editingId === item.id && editDraft;
            return (
              <article
                key={item.id}
                className={`rounded-[24px] border bg-slate-50/80 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-relief-orange hover:shadow-md ${
                  lowStock ? 'border-amber-300' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {editing ? (
                      <input
                        value={editDraft.item_name}
                        onChange={(event) => setEditDraft((current) => ({ ...current, item_name: event.target.value }))}
                        className="h-9 w-full rounded-2xl border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-relief-orange"
                      />
                    ) : (
                      <h3 className="truncate font-semibold text-slate-900">{item.item_name}</h3>
                    )}
                    <p className="mt-1 text-sm capitalize text-slate-500">{item.category}</p>
                  </div>
                  {lowStock && <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />}
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    {editing ? (
                      <input
                        type="number"
                        min="0"
                        value={editDraft.quantity}
                        onChange={(event) => setEditDraft((current) => ({ ...current, quantity: event.target.value }))}
                        className="h-10 w-28 rounded-2xl border border-slate-200 bg-white px-2 text-xl font-semibold text-slate-900 outline-none focus:border-relief-orange"
                      />
                    ) : (
                      <p className="text-[28px] font-semibold text-slate-900">{item.quantity}</p>
                    )}
                    {editing ? (
                      <input
                        value={editDraft.unit}
                        onChange={(event) => setEditDraft((current) => ({ ...current, unit: event.target.value }))}
                        className="mt-2 h-8 w-28 rounded-2xl border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-relief-orange"
                      />
                    ) : (
                      <p className="text-sm text-slate-500">{item.unit}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => patchItem(item.id, { quantity: Math.max(0, item.quantity - 1) })}
                      className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-relief-orange hover:text-relief-orange"
                      title="Decrease quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => patchItem(item.id, { quantity: item.quantity + 1 })}
                      className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-relief-teal hover:text-relief-teal"
                      title="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {editing ? (
                  <div className="mt-4 grid gap-2">
                    <input
                      value={editDraft.location_name}
                      onChange={(event) => setEditDraft((current) => ({ ...current, location_name: event.target.value }))}
                      className="h-9 rounded-2xl border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-relief-orange"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        value={editDraft.latitude}
                        onChange={(event) => setEditDraft((current) => ({ ...current, latitude: event.target.value }))}
                        className="h-9 rounded-2xl border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-relief-orange"
                      />
                      <input
                        type="number"
                        step="0.0001"
                        value={editDraft.longitude}
                        onChange={(event) => setEditDraft((current) => ({ ...current, longitude: event.target.value }))}
                        className="h-9 rounded-2xl border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-relief-orange"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 min-h-10 text-sm text-slate-500">{item.location_name}</p>
                )}

                <div className="mt-4 flex justify-between gap-2">
                  {editing ? (
                    <button
                      type="button"
                      onClick={saveDraft}
                      className="flex h-9 flex-1 items-center justify-center gap-2 rounded-2xl bg-relief-teal px-3 text-sm font-semibold text-white transition hover:bg-teal-600"
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditDraft(item);
                      }}
                      className="flex h-9 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-relief-orange"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:border-red-300 hover:text-red-500"
                    title="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
