import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { Check, Layers, MapPin, Plus, X } from 'lucide-react';

const center = [26.1, 88.9];

const layerMeta = {
  requests: { label: 'Active requests', color: '#EF4444' },
  volunteers: { label: 'Volunteers', color: '#14B8A6' },
  resources: { label: 'Resources', color: '#3B82F6' },
  camps: { label: 'Relief camps', color: '#F97316' }
};

const requestTypes = ['food', 'water', 'medicine', 'shelter'];
const urgencies = ['low', 'medium', 'high', 'critical'];

function divIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div class="relief-pin" style="background:${color}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function clusterIcon(color, count) {
  return L.divIcon({
    className: '',
    html: `<div class="cluster-pin" style="background:${color}">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function label(value) {
  return value.replace('_', ' ');
}

function ZoomAndClickHandler({ onZoom, onMapClick }) {
  useMapEvents({
    zoomend(event) {
      onZoom(event.target.getZoom());
    },
    click(event) {
      onMapClick(event.latlng);
    }
  });
  return null;
}

function toPoint(item, kind) {
  return {
    ...item,
    kind,
    lat: Number(item.latitude),
    lng: Number(item.longitude)
  };
}

function clusterPoints(points, zoom) {
  if (zoom >= 8) {
    return points.map((point) => ({ clustered: false, points: [point], lat: point.lat, lng: point.lng, id: `${point.kind}-${point.id}` }));
  }

  const cellSize = zoom < 6 ? 1.6 : 0.8;
  const groups = new Map();

  points.forEach((point) => {
    const key = `${Math.round(point.lat / cellSize)}:${Math.round(point.lng / cellSize)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
  });

  return Array.from(groups.entries()).map(([key, group]) => ({
    clustered: group.length > 1,
    points: group,
    lat: group.reduce((sum, point) => sum + point.lat, 0) / group.length,
    lng: group.reduce((sum, point) => sum + point.lng, 0) / group.length,
    id: key
  }));
}

function RequestPopup({ item }) {
  return (
    <div className="min-w-[190px] text-sm">
      <p className="font-semibold text-white">{item.location}</p>
      <p className="mt-1 capitalize text-neutral-300">{item.type} / {item.urgency}</p>
      <p className="mt-1 capitalize text-neutral-400">{label(item.status)}</p>
      <p className="mt-2 text-neutral-400">Family size: {item.family_size}</p>
    </div>
  );
}

function VolunteerPopup({ item }) {
  return (
    <div className="min-w-[180px] text-sm">
      <p className="font-semibold text-white">{item.name}</p>
      <p className="mt-1 text-neutral-300">{item.skills.join(', ')}</p>
      <p className={`mt-1 font-medium ${item.is_available ? 'text-teal-300' : 'text-red-300'}`}>
        {item.is_available ? 'Available' : 'Busy'}
      </p>
    </div>
  );
}

function ResourcePopup({ item }) {
  return (
    <div className="min-w-[180px] text-sm">
      <p className="font-semibold text-white">{item.item_name}</p>
      <p className="mt-1 capitalize text-neutral-300">{item.category}</p>
      <p className="mt-1 text-neutral-400">{item.quantity} {item.unit}</p>
      <p className="mt-1 text-neutral-500">{item.location_name}</p>
    </div>
  );
}

function CampPopup({ item }) {
  return (
    <div className="min-w-[180px] text-sm">
      <p className="font-semibold text-white">{item.name}</p>
      <p className="mt-1 text-neutral-300">{item.location_name}</p>
      <p className="mt-1 text-neutral-400">Capacity: {item.capacity}</p>
    </div>
  );
}

function LayerMarkers({ points, color, zoom, renderPopup }) {
  return (
    <>
      {clusterPoints(points, zoom).map((group) => {
        if (group.clustered) {
          return (
            <Marker key={group.id} position={[group.lat, group.lng]} icon={clusterIcon(color, group.points.length)}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold text-white">{group.points.length} markers</p>
                  <p className="mt-1 text-neutral-400">Zoom in for details</p>
                </div>
              </Popup>
            </Marker>
          );
        }

        const item = group.points[0];
        return (
          <Marker key={group.id} position={[item.lat, item.lng]} icon={divIcon(color)}>
            <Popup>{renderPopup(item)}</Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default function LiveMap() {
  const [requests, setRequests] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [resources, setResources] = useState([]);
  const [camps, setCamps] = useState([]);
  const [zoom, setZoom] = useState(6);
  const [layers, setLayers] = useState({
    requests: true,
    volunteers: true,
    resources: true,
    camps: true
  });
  const [dropMode, setDropMode] = useState('');
  const [pendingPin, setPendingPin] = useState(null);
  const [pinForm, setPinForm] = useState({
    location: '',
    type: 'water',
    urgency: 'high',
    family_size: 1,
    description: '',
    name: '',
    capacity: 100
  });
  const [error, setError] = useState('');

  async function loadMapData() {
    const [requestResponse, volunteerResponse, resourceResponse, campResponse] = await Promise.all([
      fetch('/api/requests'),
      fetch('/api/volunteers'),
      fetch('/api/inventory'),
      fetch('/api/dashboard/camps')
    ]);

    if (!requestResponse.ok || !volunteerResponse.ok || !resourceResponse.ok || !campResponse.ok) {
      throw new Error('Unable to load map layers');
    }

    setRequests((await requestResponse.json()).filter((request) => request.status !== 'completed').map((item) => toPoint(item, 'requests')));
    setVolunteers((await volunteerResponse.json()).map((item) => toPoint(item, 'volunteers')));
    setResources((await resourceResponse.json()).map((item) => toPoint(item, 'resources')));
    setCamps((await campResponse.json()).map((item) => toPoint(item, 'camps')));
  }

  useEffect(() => {
    loadMapData().catch((loadError) => setError(loadError.message));
  }, []);

  const layerData = useMemo(() => ({
    requests,
    volunteers,
    resources,
    camps
  }), [requests, volunteers, resources, camps]);

  const handleMapClick = (latlng) => {
    if (!dropMode) return;
    setPendingPin({ lat: latlng.lat, lng: latlng.lng, mode: dropMode });
    setPinForm((current) => ({
      ...current,
      location: '',
      name: ''
    }));
  };

  async function savePin(event) {
    event.preventDefault();
    if (!pendingPin) return;
    setError('');

    const requestBody = pendingPin.mode === 'request'
      ? {
          location: pinForm.location,
          latitude: pendingPin.lat,
          longitude: pendingPin.lng,
          type: pinForm.type,
          urgency: pinForm.urgency,
          family_size: Number(pinForm.family_size),
          description: pinForm.description
        }
      : {
          name: pinForm.name,
          location_name: pinForm.location,
          latitude: pendingPin.lat,
          longitude: pendingPin.lng,
          capacity: Number(pinForm.capacity)
        };

    const endpoint = pendingPin.mode === 'request' ? '/api/requests' : '/api/dashboard/camps';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to save pin');
      return;
    }

    setPendingPin(null);
    await loadMapData();
  }

  const toggleLayer = (layer) => {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  };

  return (
    <div className="relative h-full overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/70 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.28)]">
      <MapContainer center={center} zoom={6} minZoom={5} maxZoom={14} className="z-0">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ZoomAndClickHandler onZoom={setZoom} onMapClick={handleMapClick} />

        {layers.requests && (
          <LayerMarkers points={layerData.requests} color={layerMeta.requests.color} zoom={zoom} renderPopup={(item) => <RequestPopup item={item} />} />
        )}
        {layers.volunteers && (
          <LayerMarkers points={layerData.volunteers} color={layerMeta.volunteers.color} zoom={zoom} renderPopup={(item) => <VolunteerPopup item={item} />} />
        )}
        {layers.resources && (
          <LayerMarkers points={layerData.resources} color={layerMeta.resources.color} zoom={zoom} renderPopup={(item) => <ResourcePopup item={item} />} />
        )}
        {layers.camps && (
          <LayerMarkers points={layerData.camps} color={layerMeta.camps.color} zoom={zoom} renderPopup={(item) => <CampPopup item={item} />} />
        )}

        {pendingPin && (
          <CircleMarker
            center={[pendingPin.lat, pendingPin.lng]}
            radius={9}
            pathOptions={{
              color: pendingPin.mode === 'request' ? layerMeta.requests.color : layerMeta.camps.color,
              fillColor: pendingPin.mode === 'request' ? layerMeta.requests.color : layerMeta.camps.color,
              fillOpacity: 0.85
            }}
          />
        )}
      </MapContainer>

      <div className="absolute right-4 top-4 z-[500] w-72 rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-xl shadow-slate-900/10 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-relief-orange" />
            <p className="text-sm font-semibold text-slate-900">Layers</p>
          </div>
          <span className="text-xs text-neutral-500">Zoom {zoom}</span>
        </div>

        <div className="mt-3 grid gap-2">
          {Object.entries(layerMeta).map(([key, meta]) => (
            <label key={key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
                {meta.label}
              </span>
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={() => toggleLayer(key)}
                className="h-4 w-4 accent-relief-orange"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setDropMode((mode) => (mode === 'request' ? '' : 'request'))}
            className={`flex h-10 items-center justify-center gap-1 rounded-lg border text-xs font-semibold transition ${
              dropMode === 'request'
                ? 'border-red-500 bg-red-500 text-white shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-red-300'
            }`}
          >
            <MapPin className="h-4 w-4" />
            Request
          </button>
          <button
            type="button"
            onClick={() => setDropMode((mode) => (mode === 'camp' ? '' : 'camp'))}
            className={`flex h-10 items-center justify-center gap-1 rounded-lg border text-xs font-semibold transition ${
              dropMode === 'camp'
                ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-orange-300'
            }`}
          >
            <Plus className="h-4 w-4" />
            Camp
          </button>
          <button
            type="button"
            onClick={() => {
              setDropMode('');
              setPendingPin(null);
            }}
            className="flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Off
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-[500] rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-xl shadow-slate-900/10 backdrop-blur">
        <p className="text-sm font-semibold text-slate-900">Legend</p>
        <div className="mt-3 grid gap-2">
          {Object.values(layerMeta).map((meta) => (
            <div key={meta.label} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="h-3 w-3 rounded-full" style={{ background: meta.color }} />
              {meta.label}
            </div>
          ))}
        </div>
      </div>

      {pendingPin && (
        <form onSubmit={savePin} className="absolute bottom-4 right-4 z-[500] w-[360px] rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-xl shadow-slate-900/10 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{pendingPin.mode === 'request' ? 'New request pin' : 'New camp pin'}</p>
            <button
              type="button"
              onClick={() => setPendingPin(null)}
              className="flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 hover:border-slate-300"
              title="Cancel pin"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {pendingPin.mode === 'camp' && (
              <input
                required
                value={pinForm.name}
                onChange={(event) => setPinForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Camp name"
                className="h-10 rounded-lg border border-relief-border bg-neutral-950 px-3 text-sm text-white outline-none focus:border-relief-orange"
              />
            )}
            <input
              required
              value={pinForm.location}
              onChange={(event) => setPinForm((current) => ({ ...current, location: event.target.value }))}
              placeholder="Location name"
              className="h-10 rounded-lg border border-relief-border bg-neutral-950 px-3 text-sm text-white outline-none focus:border-relief-orange"
            />
            {pendingPin.mode === 'request' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={pinForm.type}
                    onChange={(event) => setPinForm((current) => ({ ...current, type: event.target.value }))}
                    className="h-10 rounded-lg border border-relief-border bg-neutral-950 px-3 text-sm text-white outline-none focus:border-relief-orange"
                  >
                    {requestTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <select
                    value={pinForm.urgency}
                    onChange={(event) => setPinForm((current) => ({ ...current, urgency: event.target.value }))}
                    className="h-10 rounded-lg border border-relief-border bg-neutral-950 px-3 text-sm text-white outline-none focus:border-relief-orange"
                  >
                    {urgencies.map((urgency) => (
                      <option key={urgency} value={urgency}>
                        {urgency}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  required
                  type="number"
                  min="1"
                  value={pinForm.family_size}
                  onChange={(event) => setPinForm((current) => ({ ...current, family_size: event.target.value }))}
                  className="h-10 rounded-lg border border-relief-border bg-neutral-950 px-3 text-sm text-white outline-none focus:border-relief-orange"
                />
                <textarea
                  value={pinForm.description}
                  onChange={(event) => setPinForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Description"
                  rows="3"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-relief-orange focus:bg-white"
                />
              </>
            ) : (
              <input
                required
                type="number"
                min="0"
                value={pinForm.capacity}
                onChange={(event) => setPinForm((current) => ({ ...current, capacity: event.target.value }))}
                className="h-10 rounded-lg border border-relief-border bg-neutral-950 px-3 text-sm text-white outline-none focus:border-relief-orange"
              />
            )}
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <span>Lat {pendingPin.lat.toFixed(4)}</span>
              <span>Lng {pendingPin.lng.toFixed(4)}</span>
            </div>
            {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <button className="flex h-10 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-relief-orange to-orange-400 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:shadow-xl">
              <Check className="h-4 w-4" />
              Save pin
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
