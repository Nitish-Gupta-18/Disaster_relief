'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../components/AuthContext';
import {
  AlertTriangle, ArrowRight, Briefcase, ChevronDown, Crosshair, Eye, EyeOff, Heart, Lock, LogIn, Mail,
  MapPin, Navigation, Phone, Search, Shield, Sparkles, User, UserCheck, UserPlus, Users, Zap
} from 'lucide-react';

const skillIcons = {
  medical: '🩺', rescue: '🪢', logistics: '📦', transport: '🚛'
};

const skillColors = {
  medical: 'bg-rose-50 text-rose-700 border-rose-200',
  rescue: 'bg-orange-50 text-orange-700 border-orange-200',
  logistics: 'bg-sky-50 text-sky-700 border-sky-200',
  transport: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const { login, quickLogin } = useAuth();

  const [mode, setMode] = useState('quick'); // 'quick' | 'admin'

  // ── Admin login state ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ── Quick login state ──
  const [quickType, setQuickType] = useState('volunteer'); // 'volunteer' | 'requester' | 'register'
  const [volunteers, setVolunteers] = useState([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [volunteerSearch, setVolunteerSearch] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Register new volunteer state ──
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regLocation, setRegLocation] = useState('');
  const [regSkills, setRegSkills] = useState(['logistics']);
  const [regNotice, setRegNotice] = useState('');

  const allSkills = ['medical', 'rescue', 'logistics', 'transport'];

  function toggleRegSkill(skill) {
    setRegSkills((prev) => {
      const exists = prev.includes(skill);
      const next = exists ? prev.filter((s) => s !== skill) : [...prev, skill];
      return next.length ? next : [skill];
    });
  }

  const locationSuggestions = [
    'Guwahati', 'Patna', 'Dibrugarh', 'Silchar',
    'Jorhat', 'Darbhanga', 'Bhagalpur', 'Muzaffarpur',
    'Barpeta', 'Majuli', 'Morigaon', 'Tezpur',
    'Gaya', 'Purnia', 'Katihar', 'Ranchi',
  ];
  const [locFocus, setLocFocus] = useState(false);

  const filteredLocations = regLocation.trim()
    ? locationSuggestions.filter((l) => l.toLowerCase().includes(regLocation.toLowerCase()))
    : [];

  function selectLocation(loc) { setRegLocation(loc); setLocFocus(false); }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setRegNotice('');
    if (!regName.trim() || !regPhone.trim() || !regLocation.trim()) {
      setError('Name, phone, and location are required');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(regPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          phone: regPhone.trim(),
          email: regEmail.trim() || undefined,
          location_name: regLocation.trim(),
          latitude: 26.1445,
          longitude: 91.7362,
          skills: regSkills,
          is_available: true
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Registration failed'); }
      const newVolunteer = await res.json();

      await quickLogin({ type: 'volunteer', volunteer_id: newVolunteer.id });
      window.dispatchEvent(new CustomEvent('data:changed'));
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Load volunteers list on mount
  useEffect(() => {
    fetch('/api/auth/quick-login?type=volunteers')
      .then((r) => r.json())
      .then((d) => setVolunteers(d.volunteers || []))
      .catch(() => {});
  }, []);

  // Filter volunteers by search
  const filteredVolunteers = volunteerSearch.trim()
    ? volunteers.filter((v) =>
        v.name.toLowerCase().includes(volunteerSearch.toLowerCase()) ||
        v.location_name.toLowerCase().includes(volunteerSearch.toLowerCase()) ||
        (v.skills || []).some((s) => s.toLowerCase().includes(volunteerSearch.toLowerCase()))
      )
    : volunteers;

  // ── Admin login handler ──
  async function handleAdminLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Quick login handler ──
  async function handleQuickLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (quickType === 'volunteer') {
        if (!selectedVolunteer) {
          setError('Please select a volunteer from the list');
          setLoading(false);
          return;
        }
        await quickLogin({ type: 'volunteer', volunteer_id: selectedVolunteer.id });
      } else {
        if (!requesterName.trim()) {
          setError('Please enter your name');
          setLoading(false);
          return;
        }
        await quickLogin({ type: 'requester', name: requesterName, phone: requesterPhone });
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0] p-5">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF7A30] to-[#F97316] shadow-xl shadow-orange-500/20 mb-4">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A]">IMPACTSTER Relief Portal</h1>
          <p className="mt-1 text-sm text-[#64748B]">Choose how you want to access the portal</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid overflow-hidden">
          {/* ── Mode tabs ── */}
          <div className="flex border-b border-[#E2E8F0]/60">
            <button
              onClick={() => { setMode('quick'); setError(''); }}
              className={`flex-1 px-4 py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                mode === 'quick'
                  ? 'text-[#FF7A30] border-b-2 border-[#FF7A30] bg-[#FFF7ED]/30'
                  : 'text-[#64748B] border-b-2 border-transparent hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}>
              <Zap className="h-4 w-4" /> Quick Access
            </button>
            <button
              onClick={() => { setMode('admin'); setError(''); }}
              className={`flex-1 px-4 py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                mode === 'admin'
                  ? 'text-[#0F172A] border-b-2 border-[#0F172A] bg-[#F8FAFC]/80'
                  : 'text-[#64748B] border-b-2 border-transparent hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}>
              <Shield className="h-4 w-4" /> Admin Login
            </button>
          </div>

          {/* ═══════════ QUICK ACCESS ═══════════ */}
          {mode === 'quick' && (
            <form onSubmit={quickType === 'register' ? handleRegister : handleQuickLogin} className="p-6 space-y-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              {/* Sub-tabs: Volunteer / Requester / Register */}
              <div className="flex rounded-xl bg-[#F1F5F9] p-1 gap-1">
                <button type="button"
                  onClick={() => { setQuickType('volunteer'); setError(''); }}
                  className={`flex-1 rounded-lg px-2 py-2 text-[12px] font-semibold transition-all flex items-center justify-center gap-1 ${
                    quickType === 'volunteer'
                      ? 'bg-white text-[#0F172A] shadow-sm'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}>
                  <Users className="h-3.5 w-3.5" /> Volunteer
                </button>
                <button type="button"
                  onClick={() => { setQuickType('requester'); setError(''); }}
                  className={`flex-1 rounded-lg px-2 py-2 text-[12px] font-semibold transition-all flex items-center justify-center gap-1 ${
                    quickType === 'requester'
                      ? 'bg-white text-[#0F172A] shadow-sm'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}>
                  <Heart className="h-3.5 w-3.5" /> Need Help
                </button>
                <button type="button"
                  onClick={() => { setQuickType('register'); setError(''); setRegNotice(''); }}
                  className={`flex-1 rounded-lg px-2 py-2 text-[12px] font-semibold transition-all flex items-center justify-center gap-1 ${
                    quickType === 'register'
                      ? 'bg-white text-[#0F172A] shadow-sm'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}>
                  <UserPlus className="h-3.5 w-3.5" /> Register
                </button>
              </div>

              {/* ── Volunteer selector ── */}
              {quickType === 'volunteer' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-label">Select your name</label>
                    <div className="relative mt-1.5">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                      <input
                        value={volunteerSearch}
                        onChange={(e) => { setVolunteerSearch(e.target.value); setSelectedVolunteer(null); }}
                        placeholder="Search by name, location or skill..."
                        className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]"
                      />
                    </div>
                  </div>

                  <div className="max-h-[280px] overflow-y-auto rounded-xl border border-[#E2E8F0]/60 divide-y divide-[#F1F5F9]">
                    {filteredVolunteers.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <Users className="h-8 w-8 text-[#CBD5E1] mx-auto mb-2" />
                        <p className="text-sm text-[#94A3B8]">No volunteers found</p>
                        <p className="text-xs text-[#CBD5E1] mt-0.5">Try a different search</p>
                      </div>
                    ) : (
                      filteredVolunteers.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVolunteer(v)}
                          className={`w-full text-left px-4 py-3 transition-colors hover:bg-[#F8FAFC] ${
                            selectedVolunteer?.id === v.id
                              ? 'bg-[#FFF7ED] border-l-[3px] border-l-[#FF7A30]'
                              : 'border-l-[3px] border-l-transparent'
                          }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                                v.is_available
                                  ? 'bg-gradient-to-br from-[#10B981] to-[#34D399]'
                                  : 'bg-gradient-to-br from-[#94A3B8] to-[#CBD5E1]'
                              }`}>
                                {v.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#0F172A] truncate">{v.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <MapPin className="h-3 w-3 text-[#94A3B8] shrink-0" />
                                  <span className="text-[11px] text-[#64748B] truncate">{v.location_name}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {v.skills.slice(0, 2).map((s) => (
                                <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded border ${skillColors[s] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                  {skillIcons[s] || ''} {s}
                                </span>
                              ))}
                              {!v.is_available && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">Busy</span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {selectedVolunteer && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm font-semibold text-emerald-700">
                        Logging in as <span className="text-emerald-900">{selectedVolunteer.name}</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Requester form ── */}
              {quickType === 'requester' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-label">Your name</label>
                    <div className="relative mt-1.5">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                      <input
                        value={requesterName} onChange={(e) => setRequesterName(e.target.value)}
                        placeholder="Enter your full name"
                        className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-label">Phone number (optional)</label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                      <input
                        value={requesterPhone} onChange={(e) => setRequesterPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit mobile number"
                        maxLength={10} inputMode="numeric" type="tel"
                        className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Register new volunteer form ── */}
              {quickType === 'register' && (
                <div className="space-y-3">
                  {regNotice && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                      <UserCheck className="h-4 w-4 shrink-0" /> {regNotice}
                    </div>
                  )}
                  <div>
                    <label className="text-label">Full name *</label>
                    <div className="relative mt-1.5">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                      <input required value={regName} onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Rajesh Kumar"
                        className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-label">Phone number *</label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                      <input required value={regPhone} onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit mobile number" maxLength={10} inputMode="numeric" type="tel"
                        className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-label">Email (optional)</label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                      <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="volunteer@example.com"
                        className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
                    </div>
                    <p className="mt-0.5 text-[10px] text-[#94A3B8]">Receive confirmation & assignment emails</p>
                  </div>
                  <div className="relative">
                    <label className="text-label">Location *</label>
                    <div className="relative mt-1.5">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                      <input required value={regLocation}
                        onChange={(e) => { setRegLocation(e.target.value); setLocFocus(true); }}
                        onFocus={() => setLocFocus(true)}
                        onBlur={() => setTimeout(() => setLocFocus(false), 200)}
                        placeholder="e.g. Guwahati" autoComplete="off"
                        className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]" />
                    </div>
                    {locFocus && filteredLocations.length > 0 && (
                      <ul className="absolute left-0 right-0 top-full mt-1 z-50 max-h-[180px] overflow-y-auto rounded-xl border border-[#E2E8F0]/80 bg-white shadow-lg py-1">
                        {filteredLocations.map((loc, i) => (
                          <li key={loc}>
                            <button type="button" onClick={() => selectLocation(loc)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-[#475569] hover:bg-[#F8FAFC] transition-colors">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />{loc}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <span className="text-label">Skills (select at least one)</span>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {allSkills.map((s) => {
                        const active = regSkills.includes(s);
                        return (
                          <button key={s} type="button" onClick={() => toggleRegSkill(s)}
                            className={`h-9 rounded-lg border text-xs font-semibold capitalize transition-all ${
                              active
                                ? 'border-[#10B981] bg-[#10B981] text-white shadow-sm'
                                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#10B981]/50 hover:text-[#10B981]'
                            }`}>
                            <span className="flex items-center justify-center gap-1">
                              <Briefcase className="h-3 w-3" />{s}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FF7A30] to-[#F97316] text-sm font-bold text-white shadow-lg shadow-orange-500/20 hover:shadow-xl hover:brightness-105 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {loading ? 'Please wait...' : (
                  quickType === 'volunteer'
                    ? <>Continue as Volunteer <ArrowRight className="h-4 w-4" /></>
                    : quickType === 'register'
                    ? <>Register & Continue <UserPlus className="h-4 w-4" /></>
                    : <>Continue to Request Help <ArrowRight className="h-4 w-4" /></>
                )}
              </button>

              <p className="text-center text-[11px] text-[#94A3B8]">
                {quickType === 'register'
                  ? 'Fill in your details to become a volunteer instantly'
                  : 'No password needed — just select your identity'}
              </p>
            </form>
          )}

          {/* ═══════════ ADMIN LOGIN ═══════════ */}
          {mode === 'admin' && (
            <form onSubmit={handleAdminLogin} className="p-6 space-y-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Admin access requires email & password
                </p>
                <p className="text-[11px] text-amber-600 mt-1">
                  Only authorized administrators can manage assignments and system settings.
                </p>
              </div>

              <div>
                <label className="text-label">Admin email</label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                  <input
                    type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@relief.org"
                    className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-4 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]"
                  />
                </div>
              </div>

              <div>
                <label className="text-label">Password</label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                  <input
                    type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="h-[46px] w-full rounded-xl border border-[rgba(148,163,184,0.18)] bg-[#F8FAFC] pl-10 pr-11 text-sm text-[#0F172A] outline-none transition focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20 focus:bg-white placeholder:text-[#94A3B8]"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#0F172A] to-[#334155] text-sm font-bold text-white shadow-lg shadow-slate-900/20 hover:shadow-xl hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {loading ? 'Signing in...' : <>Admin Sign In <Shield className="h-4 w-4" /></>}
              </button>

              <div className="text-center text-sm text-[#64748B]">
                Need an admin account?{' '}
                <Link href={`/signup${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
                  className="font-semibold text-[#0F172A] hover:underline">
                  Register here
                </Link>
              </div>

              {/* Demo credentials */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-xs font-semibold text-[#94A3B8] mb-2">Demo Admin Credentials</p>
                <div className="space-y-1 text-xs text-[#64748B]">
                  <p><span className="font-semibold text-[#0F172A]">Email:</span> admin@relief.org</p>
                  <p><span className="font-semibold text-[#0F172A]">Password:</span> admin123</p>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Bottom note */}
        <p className="text-center text-[11px] text-[#94A3B8] mt-4">
          Volunteers & requesters — no password needed. Admins — secure login required.
        </p>
      </div>
    </div>
  );
}

