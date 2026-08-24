'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Briefcase, Crosshair, Mail, MapPin, Navigation, Phone, PlusCircle, Send, Trash2, UserPlus } from 'lucide-react';

const MapWithNoSSR = dynamic(
  () => import('./VolunteersMap'),
  { ssr: false, loading: () => <div className="h-72 w-full rounded-2xl bg-[#F1F5F9] animate-pulse" /> }
);

const skills = ['medical', 'rescue', 'logistics', 'transport'];

const skillColors = {
  medical: 'bg-rose-50 text-rose-700',
  rescue: 'bg-orange-50 text-orange-700',
  logistics: 'bg-sky-50 text-sky-700',
  transport: 'bg-emerald-50 text-emerald-700'
};

export default function VolunteersPanel() {
  const [volunteers, setVolunteers] = useState([]);
  const [filters, setFilters] = useState({ skill: '', availability: '' });
  const [position, setPosition] = useState({ lat: 25.5941, lng: 85.1376 });
  const [form, setForm] = useState({ name: '', phone: '', email: '', location_name: '', skills: ['logistics'], is_available: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // ── Phone validation ──
  const phoneRegex = /^[6-9]\d{9}$/;
  const phoneValid = phoneRegex.test(form.phone);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const showPhoneError = phoneTouched && form.phone.length > 0 && !phoneValid;

  function handlePhoneChange(raw) {
    // Strip everything except digits
    let digits = raw.replace(/\D/g, '');
    // Strip country code if present
    if (digits.startsWith('91') && digits.length > 10) digits = digits.slice(2);
    // Limit to 10 digits
    digits = digits.slice(0, 10);
    setForm((c) => ({ ...c, phone: digits }));
    if (!phoneTouched) setPhoneTouched(true);
  }

  // ── Location autocomplete ──
  const locationSuggestions = [
    'Guwahati', 'Patna', 'Dibrugarh', 'Silchar',
    'Jorhat', 'Darbhanga', 'Bhagalpur', 'Muzaffarpur',
    'Barpeta', 'Majuli', 'Morigaon', 'Tezpur',
    'Gaya', 'Purnia', 'Katihar', 'Ranchi',
  ];
  const [locFocus, setLocFocus] = useState(false);
  const [locIdx, setLocIdx] = useState(-1);
  const locInputRef = useRef(null);
  const locListRef = useRef(null);

  const filteredLocations = form.location_name.trim()
    ? locationSuggestions.filter((l) => l.toLowerCase().includes(form.location_name.toLowerCase()))
    : [];

  function selectLocation(loc) {
    setForm((c) => ({ ...c, location_name: loc }));
    setLocFocus(false);
    setLocIdx(-1);
  }

  function handleLocKeyDown(e) {
    if (!locFocus || filteredLocations.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setLocIdx((i) => Math.min(i + 1, filteredLocations.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setLocIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && locIdx >= 0) { e.preventDefault(); selectLocation(filteredLocations[locIdx]); }
    else if (e.key === 'Escape') { setLocFocus(false); setLocIdx(-1); }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        // Reverse-geocode hint
        setForm((c) => ({ ...c, location_name: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}` }));
      },
      () => setError('Unable to get location. Please enter manually.'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.skill) p.set('skill', filters.skill);
    if (filters.availability) p.set('availability', filters.availability);
    return p.toString();
  }, [filters]);

  async function loadVolunteers() {
    setError('');
    const res = await fetch(`/api/volunteers${query ? `?${query}` : ''}`);
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Load failed'); }
    setVolunteers(await res.json());
  }

  useEffect(() => { loadVolunteers().catch((e) => setError(e.message)); }, [query]);

  const toggleSkill = (skill) => {
    setForm((c) => {
      const exists = c.skills.includes(skill);
      const next = exists ? c.skills.filter((s) => s !== skill) : [...c.skills, skill];
      return { ...c, skills: next.length ? next : [skill] };
    });
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (!phoneRegex.test(form.phone)) { setPhoneTouched(true); setError('Please enter a valid 10-digit mobile number'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/volunteers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, latitude: position.lat, longitude: position.lng })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Registration failed'); }
      setForm({ name: '', phone: '', email: '', location_name: '', skills: ['logistics'], is_available: true });
      setNotice('Volunteer added.');
      window.dispatchEvent(new CustomEvent('data:changed'));
      await loadVolunteers();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function updateAvailability(vol, available) {
    setError(''); setNotice('');
    const res = await fetch(`/api/volunteers/${vol.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_available: available }) });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Update failed'); return; }
    setNotice('Availability updated.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    loadVolunteers().catch((e) => setError(e.message));
  }

  async function resendConfirmation(volunteer) {
    setError(''); setNotice('');
    const res = await fetch(`/api/volunteers/${volunteer.id}/send-confirmation`, { method: 'POST' });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to send email'); return; }
    const d = await res.json();
    setNotice(`Confirmation email sent to ${d.email}`);
  }

  async function deleteVolunteer(id) {
    setError(''); setNotice('');
    const res = await fetch(`/api/volunteers/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Delete failed'); return; }
    setNotice('Volunteer removed.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    loadVolunteers().catch((e) => setError(e.message));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      {/* Register form */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E2E8F0]/80 bg-white p-6 shadow-tier-mid transition-card h-fit sticky top-20">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">Register Volunteer</h2>
            <p className="text-meta">Skills, location & availability</p>
          </div>
          <button disabled={saving || (form.phone.length > 0 && !phoneValid)}
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A30] to-[#F97316] px-4 text-sm font-semibold text-white shadow-md shadow-orange-500/20 transition-all duration-200 hover:shadow-lg hover:brightness-105 disabled:opacity-60">
            <UserPlus className="h-4 w-4" />{saving ? 'Saving' : 'Add'}
          </button>
        </div>

        <div className="space-y-4">
          <label>
            <span className="text-label">Full name</span>
            <input required value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              placeholder="e.g. Rajesh Kumar"
              className="mt-1.5 h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
          </label>
          <label>
            <span className="text-label">Phone number</span>
            <input required value={form.phone} onChange={(e) => handlePhoneChange(e.target.value)}
              onBlur={() => setPhoneTouched(true)}
              maxLength={10} inputMode="numeric" type="tel"
              placeholder="9876543210"
              className={`mt-1.5 h-[46px] w-full rounded-xl border bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:ring-2 focus:bg-white placeholder:text-[#94A3B8] ${
                showPhoneError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : 'border-[rgba(148,163,184,0.18)] focus:border-[#FF7A30] focus:ring-[#FF7A30]/20'
              }`} />
            {showPhoneError && (
              <p className="mt-1 text-[11px] font-medium text-red-500 flex items-center gap-1">
                Please enter a valid 10-digit mobile number
              </p>
            )}
          </label>
          <label>
            <span className="text-label">Email address</span>
            <input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              placeholder="volunteer@example.com"
              className="mt-1.5 h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
            <p className="mt-1 text-[11px] text-[#94A3B8]">Optional — receive confirmation & assignment emails</p>
          </label>
          <label className="relative">
            <span className="text-label">Location</span>
            <div className="relative">
              <input required ref={locInputRef} value={form.location_name}
                onChange={(e) => { setForm((c) => ({ ...c, location_name: e.target.value })); setLocFocus(true); setLocIdx(-1); }}
                onFocus={() => { setLocFocus(true); setLocIdx(-1); }}
                onBlur={() => setTimeout(() => { setLocFocus(false); setLocIdx(-1); }, 200)}
                onKeyDown={handleLocKeyDown}
                placeholder="e.g. Guwahati"
                autoComplete="off"
                className="mt-1.5 h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] px-4 pr-10 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
              <button type="button" onClick={useCurrentLocation}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#FF7A30] transition-colors duration-150"
                title="Use current location">
                <Crosshair className="h-4 w-4" />
              </button>
              {/* Suggestions dropdown */}
              {locFocus && filteredLocations.length > 0 && (
                <ul ref={locListRef}
                  className="absolute left-0 right-0 top-full mt-1 z-50 max-h-[200px] overflow-y-auto rounded-xl border border-[#E2E8F0]/80 bg-white shadow-[0_12px_40px_-8px_rgba(15,23,42,0.15)] py-1 animate-scale-in">
                  {/* Geolocation button */}
                  <li>
                    <button type="button" onClick={useCurrentLocation}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#FF7A30] font-medium hover:bg-orange-50 transition-colors">
                      <Navigation className="h-3.5 w-3.5" />Use current location
                    </button>
                  </li>
                  <li className="border-t border-[#F1F5F9]" />
                  {filteredLocations.map((loc, i) => {
                    const idx = form.location_name.toLowerCase();
                    const matchStart = loc.toLowerCase().indexOf(idx);
                    return (
                      <li key={loc}>
                        <button type="button" onClick={() => selectLocation(loc)}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                            i === locIdx ? 'bg-[#F1F5F9] text-[#0F172A]' : 'text-[#475569] hover:bg-[#F8FAFC]'
                          }`}>
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                          <span>
                            {idx && matchStart >= 0 ? (
                              <>
                                {loc.slice(0, matchStart)}
                                <span className="font-semibold text-[#0F172A]">{loc.slice(matchStart, matchStart + idx.length)}</span>
                                {loc.slice(matchStart + idx.length)}
                              </>
                            ) : loc}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </label>

          <div>
            <span className="text-sm font-medium text-[#475569]">Skills</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {skills.map((s) => {
                const active = form.skills.includes(s);
                return (
                  <label key={s}
                    className={`flex h-9 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold capitalize transition-all duration-200 ${
                      active
                        ? 'border-[#10B981] bg-[#10B981] text-white shadow-sm'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#10B981]/50 hover:text-[#10B981]'
                    }`}>
                    <input type="checkbox" checked={active} onChange={() => toggleSkill(s)} className="sr-only" />{s}
                  </label>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] cursor-pointer">
            <input type="checkbox" checked={form.is_available} onChange={(e) => setForm((c) => ({ ...c, is_available: e.target.checked }))}
              className="h-4 w-4 rounded border-[#CBD5E1] text-[#FF7A30] focus:ring-[#FF7A30]" />
            <span className="text-sm font-medium text-[#475569]">Available for dispatch</span>
          </label>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[#E2E8F0] shadow-tier-low">
          <MapWithNoSSR position={position} onChange={setPosition} />
        </div>
      </form>

      {/* Volunteers list */}
      <div>
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <select value={filters.skill} onChange={(e) => setFilters((c) => ({ ...c, skill: e.target.value }))}
            className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
            <option value="">All skills</option>
            {skills.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.availability} onChange={(e) => setFilters((c) => ({ ...c, availability: e.target.value }))}
            className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none transition-colors duration-150 focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
            <option value="">All availability</option>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
          </select>
          <span className="ml-auto text-meta font-medium">
            {volunteers.length} volunteer{volunteers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Volunteer cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {volunteers.map((v) => {
            const initials = v.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={v.id} className="group rounded-2xl border border-[#E2E8F0]/80 bg-white p-5 shadow-tier-mid transition-card hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF7A30] to-[#F97316] text-sm font-bold text-white shadow-sm">
                      {initials}
                    </div>
                    <div>
                      <p className="font-semibold text-[#0F172A]">{v.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-[#64748B]">
                        <Phone className="h-3 w-3" />{v.phone}
                      </p>
                      {v.email && (
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-[#64748B]">
                          <Mail className="h-3 w-3" />{v.email}
                        </p>
                      )}
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-[#64748B]">
                        <MapPin className="h-3 w-3" />{v.location_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateAvailability(v, !v.is_available)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                        v.is_available
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}>
                      {v.is_available ? 'Available' : 'Busy'}
                    </button>
                    <button onClick={() => deleteVolunteer(v.id)}
                      className="rounded-lg p-1.5 text-[#CBD5E1] hover:bg-red-50 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {v.email && (
                      <button onClick={() => resendConfirmation(v)}
                        title="Resend confirmation email"
                        className="rounded-lg p-1.5 text-[#CBD5E1] hover:bg-blue-50 hover:text-blue-500 transition opacity-0 group-hover:opacity-100">
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Skills */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {v.skills.map((s) => (
                    <span key={s} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium capitalize ${skillColors[s] || 'bg-[#F1F5F9] text-[#475569]'}`}>
                      <Briefcase className="h-3 w-3" />{s}
                    </span>
                  ))}
                </div>

                {v.distance_km != null && (
                  <p className="mt-3 text-xs text-[#94A3B8] flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{v.distance_km} km away
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
