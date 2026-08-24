'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Check, Loader2, MapPin, Plus, RefreshCw, UserPlus, X } from 'lucide-react';

const MapCore = dynamic(
  () => import('./MapCore'),
  { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 animate-pulse" /> }
);

const requestTypes = ['food', 'water', 'medicine', 'shelter'];
const urgencies = ['low', 'medium', 'high', 'critical'];

const layerMeta = {
  requests: { label: 'Active requests', color: '#EF4444' },
  volunteers: { label: 'Volunteers', color: '#14B8A6' },
  resources: { label: 'Resources', color: '#3B82F6' },
  camps: { label: 'Relief camps', color: '#F97316' },
  donations: { label: 'Donation drops', color: '#8B5CF6' }
};

function toPoint(item, kind) {
  return { ...item, kind, lat: Number(item.latitude), lng: Number(item.longitude) };
}

export default function LiveMap() {
  const [requests, setRequests] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [resources, setResources] = useState([]);
  const [camps, setCamps] = useState([]);
  const [donations, setDonations] = useState([]);
  const [layers, setLayers] = useState({ requests: true, volunteers: true, resources: true, camps: true, donations: true });
  const [dropMode, setDropMode] = useState('');
  const [pendingPin, setPendingPin] = useState(null);
  const [pinForm, setPinForm] = useState({ location: '', type: 'water', urgency: 'high', family_size: 1, description: '', name: '', capacity: 100 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // ── New: side panel + legend + live counter state ──
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [dashboardKpis, setDashboardKpis] = useState(null);
  const [assignVolunteerId, setAssignVolunteerId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [allVolunteers, setAllVolunteers] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadMapData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [rRes, vRes, iRes, cRes, dRes] = await Promise.all([
        fetch('/api/requests'), fetch('/api/volunteers'), fetch('/api/inventory'), fetch('/api/dashboard/camps'), fetch('/api/donations?status=received')
      ]);
      if (!rRes.ok || !vRes.ok || !iRes.ok || !cRes.ok) throw new Error('Unable to load map layers');
      setRequests((await rRes.json()).filter((r) => r.status !== 'completed').map((r) => toPoint(r, 'requests')));
      setVolunteers((await vRes.json()).map((v) => toPoint(v, 'volunteers')));
      setResources((await iRes.json()).map((i) => toPoint(i, 'resources')));
      setCamps((await cRes.json()).map((c) => toPoint(c, 'camps')));
      if (dRes.ok) {
        const dData = await dRes.json();
        setDonations(dData.filter(d => d.drop_location).map((d) => {
          const lat = Number.isFinite(Number(d.latitude)) ? Number(d.latitude) : 26.1445;
          const lng = Number.isFinite(Number(d.longitude)) ? Number(d.longitude) : 91.7362;
          return { ...d, kind: 'donations', latitude: lat, longitude: lng, lat, lng, location_name: d.drop_location, item_name: d.item_name, quantity: d.quantity, unit: d.unit };
        }));
      }
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // ── Load on mount + listen for data changes + auto-refresh every 12s ──
  useEffect(() => {
    loadMapData().catch((e) => setError(e.message));
    const handler = () => { loadMapData().catch(() => {}); };
    window.addEventListener('data:changed', handler);
    window.addEventListener('focus', handler);
    const interval = setInterval(() => { loadMapData().catch(() => {}); }, 12000);
    return () => {
      window.removeEventListener('data:changed', handler);
      window.removeEventListener('focus', handler);
      clearInterval(interval);
    };
  }, [loadMapData]);

  // ── New: fetch dashboard KPIs for live counter + volunteer list for quick-assign ──
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [dRes, vRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/volunteers')
        ]);
        if (!active) return;
        if (dRes.ok) setDashboardKpis(await dRes.json());
        if (vRes.ok) setAllVolunteers(await vRes.json());
      } catch { /* silent */ }
    }
    load();
    const h = () => load();
    window.addEventListener('data:changed', h);
    window.addEventListener('focus', h);
    const i = setInterval(load, 15000);
    return () => { window.removeEventListener('data:changed', h); window.removeEventListener('focus', h); clearInterval(i); };
  }, []);

  // ── New: marker click → open side panel ──
  function handleMarkerClick(data) {
    setSelectedMarker(data);
    setAssignVolunteerId('');
  }

  function handleClosePanel() {
    setSelectedMarker(null);
    setAssignVolunteerId('');
  }

  // ── New: quick assign volunteer from side panel ──
  async function handleQuickAssign() {
    if (!selectedMarker || selectedMarker.kind !== 'requests' || !assignVolunteerId) return;
    setAssignLoading(true);
    try {
      const res = await fetch(`/api/requests/${selectedMarker.item.id}/assign-volunteer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteerId: Number(assignVolunteerId) })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setAssignVolunteerId('');
      window.dispatchEvent(new CustomEvent('data:changed'));
      await loadMapData();
      setNotice('Volunteer assigned.');
      setTimeout(() => setNotice(''), 3000);
    } catch (e) {
      setError(e.message);
      setTimeout(() => setError(''), 4000);
    } finally {
      setAssignLoading(false);
    }
  }

  const toggleLayer = (key) => setLayers((c) => ({ ...c, [key]: !c[key] }));

  function handlePinDrop(latLng) {
    if (!dropMode) return;
    setPendingPin({ lat: latLng.lat, lng: latLng.lng });
  }

  async function saveDroppedPin() {
    if (!pendingPin || !dropMode) return;
    setError(''); setNotice('');

    // Validate numeric inputs before submitting
    const familySize = parseInt(pinForm.family_size, 10);
    const capacity = parseInt(pinForm.capacity, 10);
    if (dropMode === 'request' && (isNaN(familySize) || familySize < 1)) {
      setError('Family size must be at least 1.');
      return;
    }
    if (dropMode === 'camp' && (isNaN(capacity) || capacity < 0)) {
      setError('Capacity must be 0 or more.');
      return;
    }

    try {
      if (dropMode === 'request') {
        const res = await fetch('/api/requests', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...pinForm, latitude: pendingPin.lat, longitude: pendingPin.lng, family_size: familySize })
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        setNotice('Request dropped on map.');
      } else if (dropMode === 'camp') {
        const res = await fetch('/api/dashboard/camps', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...pinForm, latitude: pendingPin.lat, longitude: pendingPin.lng, capacity: capacity })
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        setNotice('Camp created on map.');
      }
      setDropMode(''); setPendingPin(null);
      setPinForm({ location: '', type: 'water', urgency: 'high', family_size: 1, description: '', name: '', capacity: 100 });
      window.dispatchEvent(new CustomEvent('data:changed'));
      await loadMapData();
    } catch (e) { setError(e.message); }
  }

  const activePoints = [
    ...(layers.requests ? requests : []),
    ...(layers.volunteers ? volunteers : []),
    ...(layers.resources ? resources : []),
    ...(layers.camps ? camps : []),
    ...(layers.donations ? donations : [])
  ];

  return (
    <div className="relative h-full -m-4 lg:-m-6">
      {/* Full-viewport map */}
      <div className="absolute inset-0">
        <MapCore
          points={activePoints}
          requestPoints={layers.requests ? requests : []}
          volunteerPoints={layers.volunteers ? volunteers : []}
          resourcePoints={layers.resources ? resources : []}
          campPoints={layers.camps ? camps : []}
          donationPoints={layers.donations ? donations : []}
          onPinDrop={handlePinDrop}
          dropMode={dropMode}
          pendingPin={pendingPin}
          onMarkerClick={handleMarkerClick}
        />
      </div>

      {/* Error / Notice toasts */}
      {error && (
        <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 shadow-tier-mid">{error}</div>
      )}
      {notice && (
        <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 shadow-tier-mid">{notice}</div>
      )}

      {/* ── Live counter overlay (top-left) ── */}
      {dashboardKpis && (
        <div className="absolute left-4 top-4 z-[800] map-counter">
          <span className="flex items-center gap-1.5">
            <span className="map-counter-dot" style={{ background: '#EF4444' }} />
            <span className="text-[#64748B]">Pending</span>
            <span className="font-bold text-[#0F172A]">{dashboardKpis.kpis.openRequests}</span>
          </span>
          <span className="text-[#CBD5E1]">·</span>
          <span className="flex items-center gap-1.5">
            <span className="map-counter-dot" style={{ background: '#10B981' }} />
            <span className="text-[#64748B]">Available</span>
            <span className="font-bold text-[#0F172A]">{dashboardKpis.kpis.availableVolunteers}</span>
          </span>
          <span className="text-[#CBD5E1]">·</span>
          <span className="flex items-center gap-1.5">
            <span className="map-counter-dot" style={{ background: '#F59E0B' }} />
            <span className="text-[#64748B]">Low stock</span>
            <span className="font-bold text-[#0F172A]">{dashboardKpis.kpis.lowStockItems}</span>
          </span>
        </div>
      )}

      {/* Layer toggle bar — top-right overlay */}
      <div className="absolute right-4 top-4 z-[800] flex flex-wrap items-center gap-1.5">
        {/* Live indicator + manual refresh */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[#E2E8F0]/80 bg-white/95 px-2.5 py-1.5 text-[10px] font-bold text-[#64748B] shadow-tier-mid backdrop-blur-md">
          <span className={`h-1.5 w-1.5 rounded-full ${isRefreshing ? 'bg-[#F59E0B] animate-pulse' : 'bg-[#10B981]'}`} />
          <span>{isRefreshing ? 'Updating…' : 'Live'}</span>
          {lastRefresh && <span className="text-[#94A3B8] font-normal">· {lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={() => loadMapData().catch(() => {})} className="ml-1 rounded-md p-0.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition" title="Refresh now">
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {Object.entries(layerMeta).map(([key, meta]) => (
          <button key={key} onClick={() => toggleLayer(key)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition-all duration-200 ${
              layers[key]
                ? 'border-[#E2E8F0] bg-white/95 text-[#0F172A] shadow-tier-mid'
                : 'border-[#E2E8F0]/60 bg-white/60 text-[#94A3B8] hover:bg-white/80'
            }`}>
            <span className={`h-2 w-2 rounded-full transition-opacity duration-200`}
              style={{ background: meta.color, opacity: layers[key] ? 1 : 0.35 }} />
            {meta.label}
          </button>
        ))}
      </div>

      {/* ── Legend panel (bottom-right) ── */}
      <div className="absolute bottom-4 right-4 z-[800] map-legend space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#94A3B8] mb-1">Legend</p>
        <div className="map-legend-row">
          <span className="map-legend-dot" style={{ background: '#EF4444' }} />
          <span className="text-[#475569] font-medium">Critical</span>
        </div>
        <div className="map-legend-row">
          <span className="map-legend-dot" style={{ background: '#FF7A30' }} />
          <span className="text-[#475569] font-medium">High</span>
        </div>
        <div className="map-legend-row">
          <span className="map-legend-dot" style={{ background: '#F59E0B' }} />
          <span className="text-[#475569] font-medium">Medium</span>
        </div>
        <div className="map-legend-row">
          <span className="map-legend-dot" style={{ background: '#94A3B8' }} />
          <span className="text-[#475569] font-medium">Low</span>
        </div>
        <div className="border-t border-[#E2E8F0]/60 my-1.5" />
        <div className="map-legend-row">
          <span className="map-legend-diamond" style={{ background: '#10B981' }} />
          <span className="text-[#475569] font-medium">Volunteer (available)</span>
        </div>
        <div className="map-legend-row">
          <span className="map-legend-diamond" style={{ background: '#94A3B8' }} />
          <span className="text-[#475569] font-medium">Volunteer (dispatched)</span>
        </div>
        <div className="border-t border-[#E2E8F0]/60 my-1.5" />
        <div className="map-legend-row">
          <span className="map-legend-dot" style={{ background: '#8B5CF6' }} />
          <span className="text-[#475569] font-medium">Donation drop-off</span>
        </div>
      </div>

      {/* Drop-mode panel — bottom-left overlay */}
      <div className="absolute bottom-4 left-4 z-[800] space-y-2">
        <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white/95 p-3 shadow-tier-mid backdrop-blur-md transition-card">
          <div className="flex items-center gap-2">
            <button onClick={() => { setDropMode('request'); setPendingPin(null); }}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                dropMode === 'request'
                  ? 'bg-[#FF7A30] text-white shadow-md'
                  : 'bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#FF7A30] hover:text-[#FF7A30]'
              }`}>
              <Plus className="mr-1 inline h-3 w-3" />Drop Request
            </button>
            <button onClick={() => { setDropMode('camp'); setPendingPin(null); }}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                dropMode === 'camp'
                  ? 'bg-[#10B981] text-white shadow-md'
                  : 'bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#10B981] hover:text-[#10B981]'
              }`}>
              <Plus className="mr-1 inline h-3 w-3" />Drop Camp
            </button>
            {dropMode && (
              <button onClick={() => { setDropMode(''); setPendingPin(null); }}
                className="rounded-xl border border-[#E2E8F0] bg-white p-2 text-[#94A3B8] hover:text-red-500 transition-colors duration-150">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-[#94A3B8]">
            {dropMode ? `Click on the map to place a ${dropMode}` : 'Select mode, then click on the map'}
          </p>
        </div>

        {/* Pin form — shown when a pin is dropped */}
        {pendingPin && dropMode && (
          <div className="rounded-2xl border border-[#E2E8F0]/80 bg-white/98 p-4 shadow-card backdrop-blur-md space-y-2.5 max-w-xs animate-slide-up">
            <p className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#FF7A30]" />
              {pendingPin.lat.toFixed(4)}, {pendingPin.lng.toFixed(4)}
            </p>
            {dropMode === 'request' ? (
              <>
                <input required value={pinForm.location} onChange={(e) => setPinForm((c) => ({ ...c, location: e.target.value }))}
                  placeholder="Location name" className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 text-xs text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20" />
                <div className="flex gap-2">
                  <select value={pinForm.type} onChange={(e) => setPinForm((c) => ({ ...c, type: e.target.value }))}
                    className="h-9 flex-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-xs text-[#0F172A] outline-none focus:border-[#FF7A30]">
                    {requestTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={pinForm.urgency} onChange={(e) => setPinForm((c) => ({ ...c, urgency: e.target.value }))}
                    className="h-9 flex-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-xs text-[#0F172A] outline-none focus:border-[#FF7A30]">
                    {urgencies.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" min="1" max="9999" step="1" inputMode="numeric" value={pinForm.family_size}
                    onChange={(e) => { const v = e.target.value; if (v === '') { setPinForm((c) => ({ ...c, family_size: '' })); return; } const n = parseInt(v, 10); if (!isNaN(n) && n >= 1 && n <= 9999) setPinForm((c) => ({ ...c, family_size: n })); }}
                    onBlur={() => { const n = parseInt(pinForm.family_size, 10); if (isNaN(n) || n < 1) setPinForm((c) => ({ ...c, family_size: 1 })); }}
                    placeholder="Family" className="h-9 w-20 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-xs text-[#0F172A] outline-none focus:border-[#FF7A30]" />
                </div>
                <textarea value={pinForm.description} onChange={(e) => setPinForm((c) => ({ ...c, description: e.target.value }))}
                  placeholder="Description" rows="2" className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-[#0F172A] outline-none resize-none" />
              </>
            ) : (
              <>
                <input required value={pinForm.name} onChange={(e) => setPinForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Camp name" className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 text-xs text-[#0F172A] outline-none" />
                <input required value={pinForm.location} onChange={(e) => setPinForm((c) => ({ ...c, location: e.target.value }))}
                  placeholder="Location name" className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 text-xs text-[#0F172A] outline-none" />
                <input type="number" min="0" max="999999" step="1" inputMode="numeric" value={pinForm.capacity}
                  onChange={(e) => { const v = e.target.value; if (v === '') { setPinForm((c) => ({ ...c, capacity: '' })); return; } const n = parseInt(v, 10); if (!isNaN(n) && n >= 0 && n <= 999999) setPinForm((c) => ({ ...c, capacity: n })); }}
                  onBlur={() => { const n = parseInt(pinForm.capacity, 10); if (isNaN(n) || n < 0) setPinForm((c) => ({ ...c, capacity: 0 })); }}
                  placeholder="Capacity" className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 text-xs text-[#0F172A] outline-none" />
              </>
            )}
            <button onClick={saveDroppedPin}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#FF7A30] to-[#F97316] py-2 text-xs font-semibold text-white shadow-md shadow-orange-500/20 hover:brightness-105 transition-all duration-200">
              <Check className="h-3.5 w-3.5" />Save {dropMode}
            </button>
          </div>
        )}
      </div>

      {/* ── Side detail panel (slides in from right when marker clicked) ── */}
      {selectedMarker && selectedMarker.item && (
        <div className="absolute right-4 top-4 z-[900] map-side-panel max-h-[calc(100vh-32px)]">
          {/* Close button */}
          <button onClick={handleClosePanel}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition-colors duration-150">
            <X className="h-4 w-4" />
          </button>

          {/* Request details */}
          {selectedMarker.kind === 'requests' && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#0F172A] leading-tight pr-6">{selectedMarker.item.location}</p>
              <div className="flex flex-wrap gap-1.5">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${
                  selectedMarker.item.urgency === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                  selectedMarker.item.urgency === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                  selectedMarker.item.urgency === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {selectedMarker.item.urgency}
                </span>
                <span className="inline-flex items-center rounded-full border border-[#E2E8F0] bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold capitalize text-[#475569]">
                  {selectedMarker.item.type}
                </span>
                <span className="inline-flex items-center rounded-full border border-[#E2E8F0] bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold capitalize text-[#475569]">
                  {selectedMarker.item.family_size} people
                </span>
              </div>
              {selectedMarker.item.description && (
                <p className="text-xs text-[#64748B] leading-relaxed">{selectedMarker.item.description}</p>
              )}
              <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  selectedMarker.item.status === 'completed' ? 'bg-[#10B981]' :
                  selectedMarker.item.status === 'in_progress' ? 'bg-[#FF7A30]' :
                  selectedMarker.item.status === 'assigned' ? 'bg-[#0EA5E9]' : 'bg-[#94A3B8]'
                }`} />
                Status: {(selectedMarker.item.status || 'pending').replace(/_/g, ' ')}
              </div>

              {/* Assigned volunteers */}
              {selectedMarker.item.assigned_volunteers?.length > 0 && (
                <div className="pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#94A3B8] mb-1.5">Assigned Volunteers</p>
                  <ul className="space-y-1">
                    {selectedMarker.item.assigned_volunteers.map((v) => (
                      <li key={v.id} className="text-xs text-[#475569] flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5E9]" />{v.name} ({v.location_name})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick Assign Volunteer */}
              <div className="border-t border-[#E2E8F0]/60 pt-3 mt-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <UserPlus className="h-3.5 w-3.5 text-[#FF7A30]" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#94A3B8]">Quick Assign</p>
                </div>
                <div className="flex gap-2">
                  <select value={assignVolunteerId} onChange={(e) => setAssignVolunteerId(e.target.value)}
                    className="flex-1 h-9 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 text-xs text-[#0F172A] outline-none focus:border-[#FF7A30] focus:ring-2 focus:ring-[#FF7A30]/20">
                    <option value="">Select volunteer</option>
                    {allVolunteers.filter((v) => v.is_available).map((v) => (
                      <option key={v.id} value={v.id}>{v.name} — {v.location_name}</option>
                    ))}
                  </select>
                  <button onClick={handleQuickAssign} disabled={!assignVolunteerId || assignLoading}
                    className="h-9 rounded-lg bg-gradient-to-r from-[#FF7A30] to-[#F97316] px-4 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 hover:brightness-105 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
                    {assignLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Assign'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Volunteer details */}
          {selectedMarker.kind === 'volunteers' && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#0F172A] leading-tight pr-6">{selectedMarker.item.name}</p>
              <div className="flex flex-wrap gap-1.5">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                  selectedMarker.item.is_available
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {selectedMarker.item.is_available ? 'Available' : 'Dispatched'}
                </span>
                {selectedMarker.item.skills?.map((s) => (
                  <span key={s} className="inline-flex items-center rounded-full border border-[#E2E8F0] bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold capitalize text-[#475569]">{s}</span>
                ))}
              </div>
              <p className="text-xs text-[#64748B]">{selectedMarker.item.phone}</p>
              <p className="text-xs text-[#94A3B8]">{selectedMarker.item.location_name}</p>
            </div>
          )}

          {/* Resource details */}
          {selectedMarker.kind === 'resources' && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#0F172A] leading-tight pr-6">{selectedMarker.item.item_name}</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-full border border-[#E2E8F0] bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold capitalize text-[#475569]">{selectedMarker.item.category}</span>
                <span className="inline-flex items-center rounded-full border border-[#E2E8F0] bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold text-[#475569]">{selectedMarker.item.quantity} {selectedMarker.item.unit}</span>
              </div>
              <p className="text-xs text-[#94A3B8]">{selectedMarker.item.location_name}</p>
            </div>
          )}

          {/* Camp details */}
          {selectedMarker.kind === 'camps' && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#0F172A] leading-tight pr-6">{selectedMarker.item.name}</p>
              <p className="text-xs text-[#64748B]">{selectedMarker.item.location_name}</p>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-[#E2E8F0] bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold text-[#475569]">Capacity: {selectedMarker.item.capacity}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
