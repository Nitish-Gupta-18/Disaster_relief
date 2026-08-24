import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { MapPin, Phone, PlusCircle, Trash2 } from 'lucide-react';

const initialPosition = { lat: 25.5941, lng: 85.1376 };
const skills = ['medical', 'rescue', 'logistics', 'transport'];

function LocationPicker({ position, onChange }) {
  useMapEvents({
    click(event) {
      onChange({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });
  return <Marker position={position} />;
}

function distanceKm(aLat, aLng, bLat, bLng) {
  const toRad = (value) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function VolunteersPanel() {
  const [volunteers, setVolunteers] = useState([]);
  const [filters, setFilters] = useState({ skill: '', availability: '' });
  const [position, setPosition] = useState(initialPosition);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    location_name: '',
    skills: ['logistics'],
    is_available: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.skill) params.set('skill', filters.skill);
    if (filters.availability) params.set('availability', filters.availability);
    return params.toString();
  }, [filters]);

  async function loadVolunteers() {
    setError('');
    const response = await fetch(`/api/volunteers${query ? `?${query}` : ''}`);
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Unable to load volunteers');
    }
    setVolunteers(await response.json());
  }

  useEffect(() => {
    loadVolunteers().catch((loadError) => setError(loadError.message));
  }, [query]);

  const toggleSkill = (skill) => {
    setForm((current) => {
      const exists = current.skills.includes(skill);
      const nextSkills = exists ? current.skills.filter((item) => item !== skill) : [...current.skills, skill];
      return { ...current, skills: nextSkills.length ? nextSkills : [skill] };
    });
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          latitude: position.lat,
          longitude: position.lng
        })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Unable to register volunteer');
      }
      setForm({
        name: '',
        phone: '',
        location_name: '',
        skills: ['logistics'],
        is_available: true
      });
      setPosition(initialPosition);
      setNotice('Volunteer added successfully and is now visible in the roster.');
      window.dispatchEvent(new CustomEvent('data:changed'));
      await loadVolunteers();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateAvailability(volunteer, isAvailable) {
    setError('');
    setNotice('');
    const response = await fetch(`/api/volunteers/${volunteer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available: isAvailable })
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to update availability');
      return;
    }
    setNotice('Volunteer availability updated.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    loadVolunteers().catch((loadError) => setError(loadError.message));
  }

  async function deleteVolunteer(id) {
    setError('');
    setNotice('');
    const response = await fetch(`/api/volunteers/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to delete volunteer');
      return;
    }
    setNotice('Volunteer removed from the roster.');
    window.dispatchEvent(new CustomEvent('data:changed'));
    loadVolunteers().catch((loadError) => setError(loadError.message));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[410px_1fr]">
      <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.28)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Register Volunteer</h2>
            <p className="mt-1 text-sm text-slate-500">Skills, location and current availability.</p>
          </div>
          <button
            disabled={saving}
            className="flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-relief-orange to-orange-400 px-4 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:shadow-xl disabled:opacity-60"
          >
            <PlusCircle className="h-4 w-4" />
            {saving ? 'Saving' : 'Add'}
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label>
            <span className="text-sm font-medium text-slate-600">Name</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-600">Phone</span>
            <input
              required
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-600">Location name</span>
            <input
              required
              value={form.location_name}
              onChange={(event) => setForm((current) => ({ ...current, location_name: event.target.value }))}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
            />
          </label>

          <div>
            <span className="text-sm font-medium text-slate-600">Skills</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {skills.map((skill) => (
                <label
                  key={skill}
                  className={`flex h-10 cursor-pointer items-center justify-center rounded-2xl border text-sm font-semibold capitalize transition ${
                    form.skills.includes(skill)
                      ? 'border-relief-teal bg-relief-teal text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.skills.includes(skill)}
                    onChange={() => toggleSkill(skill)}
                    className="sr-only"
                  />
                  {skill}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <span className="text-sm font-medium text-slate-600">Available now</span>
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(event) => setForm((current) => ({ ...current, is_available: event.target.checked }))}
              className="h-5 w-5 accent-relief-teal"
            />
          </label>

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
            <div className="h-56">
              <MapContainer center={initialPosition} zoom={6} scrollWheelZoom={false}>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationPicker position={position} onChange={setPosition} />
              </MapContainer>
            </div>
            <div className="grid grid-cols-2 border-t border-slate-200 text-xs text-slate-500">
              <div className="border-r border-slate-200 px-3 py-2">Lat {position.lat.toFixed(4)}</div>
              <div className="px-3 py-2">Lng {position.lng.toFixed(4)}</div>
            </div>
          </div>
        </div>

        {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {notice && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}
      </form>

      <section className="rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Volunteer Roster</h2>
            <p className="mt-1 text-sm text-slate-500">{volunteers.length} volunteers in the current view</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filters.skill}
              onChange={(event) => setFilters((current) => ({ ...current, skill: event.target.value }))}
              className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-relief-orange"
            >
              <option value="">All skills</option>
              {skills.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
            <select
              value={filters.availability}
              onChange={(event) => setFilters((current) => ({ ...current, availability: event.target.value }))}
              className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-relief-orange"
            >
              <option value="">All availability</option>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">
          {volunteers.map((volunteer) => {
            const distance = distanceKm(initialPosition.lat, initialPosition.lng, volunteer.latitude, volunteer.longitude);
            return (
              <article
                key={volunteer.id}
                className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-relief-orange hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${volunteer.is_available ? 'bg-relief-teal' : 'bg-red-500'}`} />
                      <h3 className="font-semibold text-slate-900">{volunteer.name}</h3>
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                      <Phone className="h-4 w-4" />
                      {volunteer.phone}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteVolunteer(volunteer.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:border-red-300 hover:text-red-500"
                    title="Delete volunteer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {volunteer.skills.map((skill) => (
                    <span key={skill} className="rounded-full border border-relief-teal/20 bg-relief-teal/10 px-2.5 py-1 text-xs font-semibold text-teal-700">
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-500">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {volunteer.location_name}
                  </p>
                  <p>{distance.toFixed(1)} km from Patna command point</p>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm text-slate-600">{volunteer.is_available ? 'Available' : 'Busy'}</span>
                  <input
                    type="checkbox"
                    checked={volunteer.is_available}
                    onChange={(event) => updateAvailability(volunteer, event.target.checked)}
                    className="h-5 w-5 accent-relief-teal"
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
