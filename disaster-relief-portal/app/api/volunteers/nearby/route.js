import db from '@/lib/db';

function parseSkills(value) {
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function mapVolunteer(row, extra = {}) {
  return { ...row, is_available: Boolean(row.is_available), skills: parseSkills(row.skills), ...extra };
}

function distanceKm(aLat, aLng, bLat, bLng) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));
    const radius = Number(searchParams.get('radius') || 20);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
      return Response.json({ error: 'lat, lng and a positive radius are required' }, { status: 400 });
    }

    const volunteers = db.prepare('SELECT * FROM volunteers').all()
      .map((r) => mapVolunteer(r, { distance_km: Number(distanceKm(lat, lng, r.latitude, r.longitude).toFixed(1)) }))
      .filter((v) => v.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km);

    return Response.json(volunteers);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
