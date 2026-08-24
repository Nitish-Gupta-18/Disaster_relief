'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';

const CENTER = [26.1, 88.9];

const LAYER_COLORS = {
  requests: '#EF4444',
  volunteers: '#14B8A6',
  resources: '#3B82F6',
  camps: '#F97316',
  donations: '#8B5CF6'
};

// Urgency → marker fill color (reuses same tokens as RequestsTable urgency badges)
const URGENCY_COLORS = {
  critical: '#EF4444',
  high: '#FF7A30',
  medium: '#F59E0B',
  low: '#94A3B8'
};

function urgencyColor(item) {
  return URGENCY_COLORS[item.urgency] || URGENCY_COLORS.medium;
}

// ---- Marker icon factory ----
// shape: 'circle' (requests) | 'diamond' (volunteers)
// extraClass: e.g. 'relief-pin-critical' for pulse animation
function divIcon(color, shape, extraClass) {
  const isDiamond = shape === 'diamond';
  const baseClass = isDiamond ? 'relief-pin relief-pin-volunteer' : 'relief-pin';
  const cls = extraClass ? `${baseClass} ${extraClass}` : baseClass;
  const size = isDiamond ? 16 : 18;
  return L.divIcon({
    className: '',
    html: `<div class="${cls}" style="background:${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function buildPopupHtml(kind, item) {
  switch (kind) {
    case 'requests':
      return `<div class="min-w-[190px] text-sm"><p class="font-semibold text-slate-900">${item.location}</p><p class="mt-1 capitalize text-slate-600">${item.type} / ${item.urgency}</p><p class="mt-1 capitalize text-slate-500">${(item.status || '').replace(/_/g, ' ')}</p><p class="mt-2 text-slate-400">Family size: ${item.family_size}</p></div>`;
    case 'volunteers':
      return `<div class="min-w-[180px] text-sm"><p class="font-semibold text-slate-900">${item.name}</p><p class="mt-1 text-slate-600">${(item.skills || []).join(', ')}</p><p class="mt-1 font-medium ${item.is_available ? 'text-teal-600' : 'text-red-500'}">${item.is_available ? 'Available' : 'Busy'}</p></div>`;
    case 'resources':
      return `<div class="min-w-[180px] text-sm"><p class="font-semibold text-slate-900">${item.item_name}</p><p class="mt-1 capitalize text-slate-600">${item.category}</p><p class="mt-1 text-slate-500">${item.quantity} ${item.unit}</p><p class="mt-1 text-slate-400">${item.location_name}</p></div>`;
    case 'camps':
      return `<div class="min-w-[180px] text-sm"><p class="font-semibold text-slate-900">${item.name}</p><p class="mt-1 text-slate-600">${item.location_name}</p><p class="mt-1 text-slate-500">Capacity: ${item.capacity}</p></div>`;
    case 'donations':
      return `<div class="min-w-[180px] text-sm"><p class="font-semibold text-slate-900">📦 ${item.item_name || 'Donation Drop'}</p><p class="mt-1 text-slate-600">${item.location_name || item.drop_location || ''}</p><p class="mt-1 text-slate-500">${item.quantity || ''} ${item.unit || ''}</p><p class="mt-1 text-[#8B5CF6] font-medium">Drop-off Point</p></div>`;
    default:
      return '';
  }
}

// ---- Build a single Leaflet marker from an item ----
function buildMarker(item) {
  const kind = item.kind;
  const lat = Number(item.latitude ?? item.lat);
  const lng = Number(item.longitude ?? item.lng);

  // Skip items with invalid coordinates
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.warn('MapCore: skipping marker with invalid coords', item);
    return null;
  }

  let color, shape, extraClass;

  if (kind === 'requests') {
    color = urgencyColor(item);
    shape = 'circle';
    if (item.urgency === 'critical') extraClass = 'relief-pin-critical';
  } else if (kind === 'volunteers') {
    color = item.is_available ? '#10B981' : '#94A3B8';
    shape = 'diamond';
  } else {
    color = LAYER_COLORS[kind] || '#94a3b8';
    shape = 'circle';
  }

  const icon = divIcon(color, shape, extraClass);
  const marker = L.marker([lat, lng], { icon });

  // Attach source data for click handler (non-enumerable so it doesn't affect Leaflet internals)
  Object.defineProperty(marker, '_reliefData', { value: { kind, item }, writable: true });

  marker.bindPopup(buildPopupHtml(kind, item));
  return marker;
}

export default function MapCore({ points, onPinDrop, dropMode, pendingPin, onMarkerClick, requestPoints, volunteerPoints, resourcePoints, campPoints, donationPoints }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clusterGroupRef = useRef(null);
  const pendingMarkerRef = useRef(null);
  const onPinDropRef = useRef(onPinDrop);
  const onMarkerClickRef = useRef(onMarkerClick);

  onPinDropRef.current = onPinDrop;
  onMarkerClickRef.current = onMarkerClick;

  // ── Init map once ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: CENTER,
      zoom: 6,
      scrollWheelZoom: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Use leaflet.markercluster for clustering (disable at zoom >= 12 for individual markers)
    const cg = L.markerClusterGroup({
      maxClusterRadius: 50,
      disableClusteringAtZoom: 12,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: function (cluster) {
        const count = cluster.getChildCount();
        const color = count > 15 ? '#EF4444' : count > 8 ? '#FF7A30' : '#F59E0B';
        return L.divIcon({
          className: '',
          html: `<div class="cluster-pin" style="background:${color}">${count}</div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });
      }
    });

    // Click on individual marker → fire callback for side panel
    cg.on('click', (e) => {
      const marker = e.layer;
      if (marker && marker._reliefData && onMarkerClickRef.current) {
        L.DomEvent.stopPropagation(e);
        onMarkerClickRef.current(marker._reliefData);
      }
    });

    map.addLayer(cg);
    clusterGroupRef.current = cg;

    map.on('click', (e) => {
      if (dropMode) onPinDropRef.current(e.latlng);
    });

    mapRef.current = map;

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      clusterGroupRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rebuild markers when layer data changes ──
  useEffect(() => {
    const cg = clusterGroupRef.current;
    if (!cg) return;

    cg.clearLayers();

    // If new per-layer props are provided, use them; otherwise fall back to flat `points` array
    const allItems = [];
    if (requestPoints || volunteerPoints || resourcePoints || campPoints || donationPoints) {
      if (requestPoints) allItems.push(...requestPoints);
      if (volunteerPoints) allItems.push(...volunteerPoints);
      if (resourcePoints) allItems.push(...resourcePoints);
      if (campPoints) allItems.push(...campPoints);
      if (donationPoints) allItems.push(...donationPoints);
    } else if (points) {
      allItems.push(...points);
    }

    allItems.forEach((item) => {
      const marker = buildMarker(item);
      if (marker) cg.addLayer(marker);
    });
  }, [points, requestPoints, volunteerPoints, resourcePoints, campPoints, donationPoints]);

  // ── Show/hide pending pin ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pendingMarkerRef.current) {
      map.removeLayer(pendingMarkerRef.current);
      pendingMarkerRef.current = null;
    }

    if (pendingPin) {
      pendingMarkerRef.current = L.marker([pendingPin.lat, pendingPin.lng]).addTo(map);
    }

    return () => {
      if (pendingMarkerRef.current) {
        map.removeLayer(pendingMarkerRef.current);
        pendingMarkerRef.current = null;
      }
    };
  }, [pendingPin]);

  return <div ref={containerRef} className="h-full w-full" />;
}

