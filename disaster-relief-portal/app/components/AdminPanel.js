'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  AlertTriangle, ArrowRight, Briefcase, Calendar, CheckCircle2, Clock,
  Filter, MapPin, MessageSquare, Plus, Search, Shield, Star,
  Trash2, UserCheck, UserPlus, Users, X, Zap, ChevronDown, ChevronUp,
  Edit3, RefreshCw, Loader2, GripVertical, ArrowUpDown
} from 'lucide-react';

const skillColors = {
  medical: 'bg-rose-50 text-rose-700 border-rose-200',
  rescue: 'bg-orange-50 text-orange-700 border-orange-200',
  logistics: 'bg-sky-50 text-sky-700 border-sky-200',
  transport: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

const priorityColors = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-blue-600 bg-blue-50 border-blue-200',
  low: 'text-slate-600 bg-slate-50 border-slate-200'
};

const statusColors = {
  assigned: 'text-blue-600 bg-blue-50 border-blue-200',
  accepted: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  in_progress: 'text-orange-600 bg-orange-50 border-orange-200',
  completed: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  rejected: 'text-red-600 bg-red-50 border-red-200'
};

const urgencyBadge = {
  critical: 'pill-badge pill-critical',
  high: 'pill-badge pill-high',
  medium: 'pill-badge pill-medium',
  low: 'pill-badge pill-low'
};

function label(v) { return (v || '').replace(/_/g, ' '); }

function Badge({ children, className = '' }) {
  return <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

export default function AdminPanel() {
  const { token } = useAuth();

  // Helper for authenticated API calls
  const authHeaders = useMemo(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [token]);

  // ── State ──
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' | 'create'
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create form state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [assignPriority, setAssignPriority] = useState('medium');
  const [adminNotes, setAdminNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded assignment for detail view
  const [expandedId, setExpandedId] = useState(null);

  // ── Data loading ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);

      const [aRes, rRes, vRes] = await Promise.all([
        fetch(`/api/admin/assignments?${params.toString()}`, { headers: authHeaders }),
        fetch('/api/requests'),
        fetch('/api/volunteers?availability=available')
      ]);

      if (!aRes.ok) throw new Error('Failed to load assignments');
      const [aData, rData, vData] = await Promise.all([
        aRes.json(), rRes.json(), vRes.json()
      ]);

      setAssignments(aData);
      setRequests(rData.filter((r) => r.status !== 'completed'));
      setVolunteers(vData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Load suggestions when a request is selected ──
  useEffect(() => {
    if (!selectedRequest) { setSuggestions(null); return; }
    fetch(`/api/admin/assignments/suggestions?requestId=${selectedRequest.id}`, { headers: authHeaders })
      .then((r) => r.json())
      .then(setSuggestions)
      .catch(() => setSuggestions(null));
  }, [selectedRequest, authHeaders]);

  // ── Create assignment ──
  async function handleCreateAssignment() {
    if (!selectedRequest || !selectedVolunteer) {
      setError('Please select both a request and a volunteer');
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          request_id: selectedRequest.id,
          volunteer_id: selectedVolunteer.id,
          priority: assignPriority,
          admin_notes: adminNotes,
          due_date: dueDate || null,
          assigned_by: 'Admin'
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Assignment failed'); }
      setNotice('Volunteer assigned successfully!');
      setSelectedRequest(null);
      setSelectedVolunteer(null);
      setAdminNotes('');
      setDueDate('');
      setAssignPriority('medium');
      setSuggestions(null);
      window.dispatchEvent(new CustomEvent('data:changed'));
      loadAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Update assignment status ──
  async function updateAssignment(id, updates) {
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/admin/assignments/${id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(updates)
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Update failed'); }
      setNotice('Assignment updated.');
      window.dispatchEvent(new CustomEvent('data:changed'));
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  }

  // ── Delete assignment ──
  async function deleteAssignment(id) {
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/admin/assignments/${id}`, { method: 'DELETE', headers: authHeaders });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      setNotice('Assignment removed.');
      window.dispatchEvent(new CustomEvent('data:changed'));
      loadAll();
    } catch (e) {
      setError(e.message);
    }
  }

  // ── Quick assign from suggestions ──
  async function quickAssign(volunteer) {
    if (!selectedRequest) return;
    setSelectedVolunteer(volunteer);
    await new Promise((r) => setTimeout(r, 50));
    await handleCreateAssignment();
  }

  // ── Filtered assignments ──
  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) return assignments;
    const q = searchQuery.toLowerCase();
    return assignments.filter((a) => {
      const req = a.request;
      const vol = a.volunteer;
      return (
        (req && (req.location.toLowerCase().includes(q) || req.type.toLowerCase().includes(q) || (req.description || '').toLowerCase().includes(q))) ||
        (vol && (vol.name.toLowerCase().includes(q) || vol.location_name.toLowerCase().includes(q)))
      );
    });
  }, [assignments, searchQuery]);

  // ── Stats ──
  const stats = useMemo(() => ({
    total: assignments.length,
    active: assignments.filter((a) => !['completed', 'rejected'].includes(a.status)).length,
    completed: assignments.filter((a) => a.status === 'completed').length,
    critical: assignments.filter((a) => a.priority === 'critical' && !['completed', 'rejected'].includes(a.status)).length
  }), [assignments]);

  // ── Render ──
  if (loading && assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white p-8 shadow-tier-mid">
        <div className="space-y-4">
          <div className="h-5 w-48 shimmer rounded-lg" />
          <div className="h-4 w-96 shimmer rounded-lg" />
          <div className="grid gap-4 grid-cols-4 mt-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 shimmer rounded-xl" />)}
          </div>
          <div className="h-80 shimmer rounded-xl mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid overflow-hidden">
        <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <Shield className="h-5 w-5 text-[#FF7A30]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Admin Assignment Control</h2>
                <p className="text-sm text-slate-400">Manage volunteer-task assignments with full oversight</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadAll} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white transition-colors" title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#E2E8F0]/30">
          {[
            { label: 'Total Assignments', value: stats.total, icon: Briefcase, color: 'text-slate-600' },
            { label: 'Active', value: stats.active, icon: Clock, color: 'text-blue-600' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600' },
            { label: 'Critical Priority', value: stats.critical, icon: AlertTriangle, color: 'text-red-600' }
          ].map((stat) => (
            <div key={stat.label} className="bg-white px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-meta">{stat.label}</span>
              </div>
              <span className="text-2xl font-bold text-[#0F172A]">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* ── Tab bar ── */}
        <div className="flex items-center border-b border-[#E2E8F0]/60 px-6">
          <button onClick={() => setActiveTab('assignments')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'assignments' ? 'border-[#FF7A30] text-[#FF7A30]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> All Assignments
            </div>
          </button>
          <button onClick={() => setActiveTab('create')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'create' ? 'border-[#FF7A30] text-[#FF7A30]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}>
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> New Assignment
            </div>
          </button>
        </div>
      </div>

      {/* ── Notifications ── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
          <button onClick={() => setNotice('')} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ═══════════════ ALL ASSIGNMENTS TAB ═══════════════ */}
      {activeTab === 'assignments' && (
        <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid overflow-hidden">
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0]/60 px-6 py-4">
            <div>
              <h3 className="text-base font-semibold text-[#0F172A]">Assignment Records</h3>
              <p className="text-meta">{filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="h-9 w-48 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pl-9 pr-3 text-sm outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" />
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
                <option value="">All Status</option>
                {['assigned', 'accepted', 'in_progress', 'completed', 'rejected'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
              </select>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
                className="h-9 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
                <option value="">All Priority</option>
                {['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{label(p)}</option>)}
              </select>
              {(filterStatus || filterPriority || searchQuery) && (
                <button onClick={() => { setFilterStatus(''); setFilterPriority(''); setSearchQuery(''); }}
                  className="h-9 rounded-xl border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#64748B] hover:text-[#FF7A30] hover:border-[#FF7A30] transition-colors flex items-center gap-1">
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#E2E8F0]/60">
              <thead>
                <tr className="bg-[#F8FAFC]/80">
                  <th className="px-5 py-3 text-left text-label">Request</th>
                  <th className="px-5 py-3 text-left text-label">Volunteer</th>
                  <th className="px-5 py-3 text-left text-label">Priority</th>
                  <th className="px-5 py-3 text-left text-label">Status</th>
                  <th className="px-5 py-3 text-left text-label">Assigned</th>
                  <th className="px-5 py-3 text-right text-label">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F5F9] text-[#94A3B8] mb-3">
                        <Briefcase className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-[#0F172A]">No assignments found</p>
                      <p className="mt-1 text-meta">Create a new assignment to get started.</p>
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map((a) => (
                    <tr key={a.id} className={`transition-colors hover:bg-[#F8FAFC] ${expandedId === a.id ? 'bg-[#FFF7ED]/30' : ''}`}>
                      <td className="px-5 py-3">
                        {a.request ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-[#94A3B8]" />
                              <span className="text-sm font-semibold text-[#0F172A]">{a.request.location}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={urgencyBadge[a.request.urgency] || 'pill-badge pill-medium'}>{a.request.urgency}</Badge>
                              <span className="text-xs text-[#64748B] capitalize">{a.request.type} · {a.request.family_size} people</span>
                            </div>
                          </div>
                        ) : <span className="text-sm text-[#94A3B8]">Request #{a.request_id}</span>}
                      </td>
                      <td className="px-5 py-3">
                        {a.volunteer ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF7A30]/10 text-[#FF7A30] text-xs font-bold">
                                {a.volunteer.name.charAt(0)}
                              </div>
                              <span className="text-sm font-semibold text-[#0F172A]">{a.volunteer.name}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {a.volunteer.skills.map((s) => (
                                <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-md border ${skillColors[s] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{s}</span>
                              ))}
                            </div>
                          </div>
                        ) : <span className="text-sm text-[#94A3B8]">Volunteer #{a.volunteer_id}</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Badge className={priorityColors[a.priority] || ''}>{label(a.priority)}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge className={statusColors[a.status] || ''}>
                          <span className="flex items-center gap-1">
                            {a.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                            {a.status === 'in_progress' && <Clock className="h-3 w-3" />}
                            {label(a.status)}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-sm text-[#64748B]">
                        {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick status update */}
                          {a.status === 'assigned' && (
                            <button onClick={() => updateAssignment(a.id, { status: 'accepted' })}
                              className="h-8 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                              title="Mark as Accepted">Accept</button>
                          )}
                          {a.status === 'accepted' && (
                            <button onClick={() => updateAssignment(a.id, { status: 'in_progress' })}
                              className="h-8 rounded-lg border border-orange-200 bg-orange-50 px-2.5 text-[11px] font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
                              title="Mark In Progress">Start</button>
                          )}
                          {a.status === 'in_progress' && (
                            <button onClick={() => updateAssignment(a.id, { status: 'completed' })}
                              className="h-8 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                              title="Mark Completed">Complete</button>
                          )}
                          <button onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors text-[#64748B]"
                            title="Details">
                            {expandedId === a.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => deleteAssignment(a.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-red-400 hover:text-red-600"
                            title="Remove assignment">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Expanded detail row */}
          {expandedId && (() => {
            const a = assignments.find((x) => x.id === expandedId);
            if (!a) return null;
            return (
              <div className="border-t border-[#E2E8F0]/60 bg-[#F8FAFC]/50 px-6 py-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h4 className="text-label mb-2">Admin Notes</h4>
                    <div className="rounded-lg border border-[#E2E8F0] bg-white p-3">
                      <textarea defaultValue={a.admin_notes || ''}
                        onBlur={(e) => { if (e.target.value !== (a.admin_notes || '')) updateAssignment(a.id, { admin_notes: e.target.value }); }}
                        placeholder="Add admin notes..."
                        rows={2}
                        className="w-full text-sm text-[#0F172A] outline-none resize-none bg-transparent placeholder:text-[#94A3B8]" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-label mb-2">Volunteer Notes</h4>
                    <div className="rounded-lg border border-[#E2E8F0] bg-white p-3">
                      <p className="text-sm text-[#64748B]">{a.volunteer_notes || 'No volunteer notes yet.'}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-label mb-2">Quick Actions</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#64748B] w-16">Status:</span>
                        <select value={a.status} onChange={(e) => updateAssignment(a.id, { status: e.target.value })}
                          className="h-8 flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 text-xs outline-none focus:border-[#FF7A30]">
                          {['assigned', 'accepted', 'in_progress', 'completed', 'rejected'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#64748B] w-16">Priority:</span>
                        <select value={a.priority} onChange={(e) => updateAssignment(a.id, { priority: e.target.value })}
                          className="h-8 flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 text-xs outline-none focus:border-[#FF7A30]">
                          {['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{label(p)}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#64748B] w-16">Due:</span>
                        <input type="date" defaultValue={a.due_date || ''}
                          onChange={(e) => updateAssignment(a.id, { due_date: e.target.value || null })}
                          className="h-8 flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 text-xs outline-none focus:border-[#FF7A30]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══════════════ NEW ASSIGNMENT TAB ═══════════════ */}
      {activeTab === 'create' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          {/* Left: Select Request */}
          <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid overflow-hidden">
            <div className="border-b border-[#E2E8F0]/60 px-5 py-4">
              <h3 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#FF7A30]" /> Step 1: Select Request
              </h3>
              <p className="text-meta mt-0.5">Choose a pending relief request to assign</p>
            </div>
            <div className="divide-y divide-[#F1F5F9] max-h-[500px] overflow-y-auto">
              {requests.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <CheckCircle2 className="h-10 w-10 text-[#94A3B8] mx-auto mb-3" />
                  <p className="text-sm font-semibold text-[#0F172A]">All requests are completed</p>
                  <p className="mt-1 text-meta">No pending requests need assignment.</p>
                </div>
              ) : (
                requests.map((req) => (
                  <button key={req.id} onClick={() => { setSelectedRequest(req); setSelectedVolunteer(null); }}
                    className={`w-full text-left px-5 py-4 transition-colors hover:bg-[#F8FAFC] ${
                      selectedRequest?.id === req.id ? 'bg-[#FFF7ED] border-l-4 border-l-[#FF7A30]' : 'border-l-4 border-l-transparent'
                    }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#0F172A] truncate">{req.location}</span>
                          <Badge className={urgencyBadge[req.urgency] || ''}>{req.urgency}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[#64748B] capitalize">{req.type}</span>
                          <span className="text-xs text-[#94A3B8]">·</span>
                          <span className="text-xs text-[#64748B]">{req.family_size} people</span>
                          <span className="text-xs text-[#94A3B8]">·</span>
                          <Badge className={statusColors[req.status] || ''}>{label(req.status)}</Badge>
                        </div>
                        {req.description && <p className="text-xs text-[#94A3B8] mt-1 truncate">{req.description}</p>}
                      </div>
                      {selectedRequest?.id === req.id && <CheckCircle2 className="h-5 w-5 text-[#FF7A30] shrink-0" />}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: Select Volunteer + Assignment config */}
          <div className="space-y-6">
            {/* Suggestions panel */}
            {selectedRequest && (
              <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid overflow-hidden">
                <div className="border-b border-[#E2E8F0]/60 px-5 py-4">
                  <h3 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" /> Step 2: Choose Volunteer
                  </h3>
                  <p className="text-meta mt-0.5">
                    {suggestions ? `Smart-matched volunteers for "${selectedRequest.type}" request` : 'Loading suggestions...'}
                  </p>
                </div>

                {!suggestions ? (
                  <div className="px-5 py-12 text-center">
                    <Loader2 className="h-6 w-6 text-[#FF7A30] animate-spin mx-auto mb-2" />
                    <p className="text-sm text-[#64748B]">Analyzing best volunteer matches...</p>
                  </div>
                ) : suggestions.suggestions.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <Users className="h-10 w-10 text-[#94A3B8] mx-auto mb-3" />
                    <p className="text-sm font-semibold text-[#0F172A]">No available volunteers</p>
                    <p className="mt-1 text-meta">All volunteers are currently busy or assigned.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F1F5F9] max-h-[400px] overflow-y-auto">
                    {suggestions.suggestions.map((s) => (
                      <button key={s.volunteer.id} onClick={() => setSelectedVolunteer(s.volunteer)}
                        className={`w-full text-left px-5 py-3 transition-colors hover:bg-[#F8FAFC] ${
                          selectedVolunteer?.id === s.volunteer.id ? 'bg-[#F0F9FF] border-l-4 border-l-[#0EA5E9]' : 'border-l-4 border-l-transparent'
                        }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#FF7A30] to-[#F97316] text-white text-xs font-bold">
                                {s.volunteer.name.charAt(0)}
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-[#0F172A]">{s.volunteer.name}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px] text-[#64748B]">{s.volunteer.location_name}</span>
                                  <span className="text-[11px] text-[#94A3B8]">·</span>
                                  <span className="text-[11px] text-[#64748B]">{s.distance_km} km</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              {s.volunteer.skills.map((sk) => (
                                <span key={sk} className={`text-[10px] px-1.5 py-0.5 rounded-md border ${skillColors[sk] || ''}`}>{sk}</span>
                              ))}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold ${
                                s.score >= 60 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                s.score >= 30 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-slate-50 text-slate-600 border-slate-200'
                              }`}>
                                ★ {s.score} match
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {s.reasons.map((r, i) => (
                                <span key={i} className="text-[10px] text-[#94A3B8]">{r}{i < s.reasons.length - 1 ? ' ·' : ''}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 ml-2">
                            {selectedVolunteer?.id === s.volunteer.id && <CheckCircle2 className="h-5 w-5 text-[#0EA5E9]" />}
                            <button onClick={(e) => { e.stopPropagation(); quickAssign(s.volunteer); }}
                              disabled={submitting}
                              className="h-7 rounded-lg bg-gradient-to-r from-[#FF7A30] to-[#F97316] px-2.5 text-[10px] font-bold text-white shadow-sm shadow-orange-500/20 hover:brightness-105 disabled:opacity-50 transition-all">
                              Quick Assign
                            </button>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Assignment configuration */}
            {selectedRequest && selectedVolunteer && (
              <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid p-5">
                <h3 className="text-base font-semibold text-[#0F172A] flex items-center gap-2 mb-4">
                  <Edit3 className="h-4 w-4 text-[#FF7A30]" /> Step 3: Configure & Assign
                </h3>

                {/* Summary */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-[#94A3B8]">Request</p>
                      <p className="text-sm font-semibold text-[#0F172A]">{selectedRequest.location}</p>
                      <p className="text-xs text-[#64748B] capitalize">{selectedRequest.type} · {selectedRequest.family_size} people</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-[#FF7A30]" />
                    <div className="flex-1">
                      <p className="text-xs text-[#94A3B8]">Volunteer</p>
                      <p className="text-sm font-semibold text-[#0F172A]">{selectedVolunteer.name}</p>
                      <p className="text-xs text-[#64748B]">{selectedVolunteer.location_name}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-label">Priority</label>
                    <select value={assignPriority} onChange={(e) => setAssignPriority(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
                      {['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{label(p)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-label">Due Date (optional)</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" />
                  </div>
                  <div>
                    <label className="text-label">Admin Notes</label>
                    <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Instructions or notes for the volunteer..."
                      rows={2}
                      className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm outline-none resize-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" />
                  </div>
                  <button onClick={handleCreateAssignment} disabled={submitting}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FF7A30] to-[#F97316] text-sm font-bold text-white shadow-lg shadow-orange-500/20 hover:shadow-xl hover:brightness-105 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Assigning...</>
                    ) : (
                      <><UserCheck className="h-4 w-4" /> Confirm Assignment</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Empty state when no request selected */}
            {!selectedRequest && (
              <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white shadow-tier-mid p-12 text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F1F5F9] text-[#94A3B8] mb-4">
                  <ArrowRight className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold text-[#0F172A]">Select a Request</h3>
                <p className="mt-1 text-meta max-w-xs mx-auto">
                  Choose a pending relief request from the left panel to see smart-matched volunteer suggestions.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
