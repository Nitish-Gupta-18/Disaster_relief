import { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { PlusCircle } from 'lucide-react';

const initialPosition = { lat: 26.1445, lng: 91.7362 };
const requestTypes = ['food', 'water', 'medicine', 'shelter'];
const urgencies = ['low', 'medium', 'high', 'critical'];

function ClickPicker({ position, onChange }) {
  useMapEvents({
    click(event) {
      onChange({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });

  return <Marker position={position} />;
}

export default function RequestForm({ onCreated }) {
  const [form, setForm] = useState({
    location: '',
    type: 'food',
    urgency: 'medium',
    family_size: 1,
    description: ''
  });
  const [position, setPosition] = useState(initialPosition);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          family_size: Number(form.family_size),
          latitude: position.lat,
          longitude: position.lng
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Unable to create request');
      }

      setForm({
        location: '',
        type: 'food',
        urgency: 'medium',
        family_size: 1,
        description: ''
      });
      setPosition(initialPosition);
      setNotice('Relief request created successfully. The dashboard and coordination views will update shortly.');
      window.dispatchEvent(new CustomEvent('data:changed'));
      onCreated?.();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.28)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">New Relief Request</h2>
          <p className="mt-1 text-sm text-slate-500">Capture location, urgency and household impact with confidence.</p>
        </div>
        <button
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-relief-orange to-orange-400 px-4 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PlusCircle className="h-4 w-4" />
          {saving ? 'Saving' : 'Create'}
        </button>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {notice && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-medium text-slate-600">Location name</span>
            <input
              required
              value={form.location}
              onChange={(event) => updateField('location', event.target.value)}
              placeholder="Village, district, state"
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
            />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-600">Request type</span>
            <select
              value={form.type}
              onChange={(event) => updateField('type', event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
            >
              {requestTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-600">Family size</span>
            <input
              required
              type="number"
              min="1"
              value={form.family_size}
              onChange={(event) => updateField('family_size', event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
            />
          </label>
          <div className="sm:col-span-2">
            <span className="text-sm font-medium text-slate-600">Urgency</span>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {urgencies.map((urgency) => (
                <label
                  key={urgency}
                  className={`flex h-10 cursor-pointer items-center justify-center rounded-2xl border text-sm font-semibold capitalize transition ${
                    form.urgency === urgency
                      ? 'border-relief-orange bg-relief-orange text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="urgency"
                    value={urgency}
                    checked={form.urgency === urgency}
                    onChange={(event) => updateField('urgency', event.target.value)}
                    className="sr-only"
                  />
                  {urgency}
                </label>
              ))}
            </div>
          </div>
          <label className="sm:col-span-2">
            <span className="text-sm font-medium text-slate-600">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              rows="4"
              placeholder="Needs, access constraints, nearby landmarks"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
            />
          </label>
        </div>
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
          <div className="h-56">
            <MapContainer center={initialPosition} zoom={6} scrollWheelZoom={false}>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <ClickPicker position={position} onChange={setPosition} />
            </MapContainer>
          </div>
          <div className="grid grid-cols-2 border-t border-slate-200 text-xs text-slate-500">
            <div className="border-r border-slate-200 px-3 py-2">Lat {position.lat.toFixed(4)}</div>
            <div className="px-3 py-2">Lng {position.lng.toFixed(4)}</div>
          </div>
        </div>
      </div>
    </form>
  );
}
