'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, PlusCircle, Send } from 'lucide-react';

const RequestMap = dynamic(() => import('./RequestMap'), {
  ssr: false,
  loading: () => <div className="h-56 w-full rounded-2xl bg-[#F1F5F9] shimmer" />
});

const initialPosition = { lat: 26.1445, lng: 91.7362 };
const requestTypes = ['food', 'water', 'medicine', 'shelter'];
const urgencies = ['low', 'medium', 'high', 'critical'];

const urgencyStyles = {
  critical: { active: 'bg-red-500 border-red-500 text-white', inactive: 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-red-300 hover:text-red-600' },
  high: { active: 'bg-[#FF7A30] border-[#FF7A30] text-white', inactive: 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-orange-300 hover:text-[#FF7A30]' },
  medium: { active: 'bg-[#F59E0B] border-[#F59E0B] text-white', inactive: 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-amber-300 hover:text-[#F59E0B]' },
  low: { active: 'bg-[#10B981] border-[#10B981] text-white', inactive: 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-emerald-300 hover:text-[#10B981]' }
};

export default function RequestForm({ onCreated }) {
  const [form, setForm] = useState({ location: '', type: 'food', urgency: 'medium', family_size: 1, description: '' });
  const [position, setPosition] = useState(initialPosition);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const updateField = (field, value) => setForm((c) => ({ ...c, [field]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, family_size: Number(form.family_size), latitude: position.lat, longitude: position.lng })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Creation failed'); }
      setForm({ location: '', type: 'food', urgency: 'medium', family_size: 1, description: '' });
      setPosition(initialPosition);
      setNotice('Relief request created.');
      window.dispatchEvent(new CustomEvent('data:changed'));
      onCreated?.();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E2E8F0]/80 bg-white p-6 shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">New Relief Request</h2>
          <p className="text-sm text-[#94A3B8]">Capture location, urgency and household impact</p>
        </div>
        <button disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A30] to-[#F97316] px-4 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-all duration-200 hover:shadow-lg hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed">
          <Send className="h-4 w-4" />{saving ? 'Saving...' : 'Create Request'}
        </button>
      </div>

      {/* Notifications */}
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left: Form fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-medium text-[#475569]">Location name</span>
            <input required value={form.location} onChange={(e) => updateField('location', e.target.value)}
              placeholder="Village, district, state"
              className="mt-1.5 h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
          </label>
          <label>
            <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#94A3B8]">Request type</span>
            <select value={form.type} onChange={(e) => updateField('type', e.target.value)}
              className="mt-1.5 h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white capitalize">
              {requestTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#94A3B8]">Family size</span>
            <input required type="number" min="1" value={form.family_size} onChange={(e) => updateField('family_size', e.target.value)}
              className="mt-1.5 h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white" />
          </label>

          {/* Urgency selector */}
          <div className="sm:col-span-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#94A3B8]">Urgency level</span>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {urgencies.map((u) => {
                const active = form.urgency === u;
                const style = urgencyStyles[u];
                return (
                  <label key={u}
                    className={`flex h-[42px] cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold capitalize transition-all duration-200 ${
                      active ? style.active + ' shadow-sm' : style.inactive
                    }`}>
                    <input type="radio" name="urgency" value={u} checked={active} onChange={(e) => updateField('urgency', e.target.value)} className="sr-only" />
                    {u}
                  </label>
                );
              })}
            </div>
          </div>

          <label className="sm:col-span-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#94A3B8]">Description</span>
            <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)}
              rows="3" placeholder="Needs, access constraints, nearby landmarks..."
              className="mt-1.5 w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 py-3 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8] resize-none" />
          </label>
        </div>

        {/* Right: Map picker */}
        <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
          <RequestMap position={position} onChange={setPosition} initialPosition={initialPosition} />
          <div className="grid grid-cols-2 border-t border-[#E2E8F0] text-xs text-[#64748B] bg-white">
            <div className="flex items-center gap-1 border-r border-[#E2E8F0] px-3 py-2">
              <MapPin className="h-3 w-3 text-[#FF7A30]" />
              <span className="font-mono">{position.lat.toFixed(4)}</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-2">
              <MapPin className="h-3 w-3 text-[#0EA5E9]" />
              <span className="font-mono">{position.lng.toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
