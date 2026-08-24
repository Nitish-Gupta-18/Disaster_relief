import db from '@/lib/db';
import { getAuthUser } from '../../auth-utils';

function parseJsonArray(value) {
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function distanceKm(aLat, aLng, bLat, bLng) {
  const toRad = (v) => (v * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Map request type to relevant volunteer skills
const requestSkillMap = {
  food: ['logistics', 'transport'],
  water: ['logistics', 'rescue'],
  medicine: ['medical'],
  shelter: ['rescue', 'logistics', 'transport']
};

// GET /api/admin/assignments/suggestions?requestId=1
// Returns ranked volunteers best suited for a given request
export async function GET(request) {
  try {
    getAuthUser(request, { requireAdmin: true });

    const { searchParams } = new URL(request.url);
    const requestId = Number(searchParams.get('requestId'));

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return Response.json({ error: 'Valid requestId query parameter is required' }, { status: 400 });
    }

    const req = db.prepare('SELECT * FROM requests WHERE id = ?').get(requestId);
    if (!req) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }

    // Get all available volunteers
    const volunteers = db.prepare('SELECT * FROM volunteers WHERE is_available = 1').all();

    // Get already assigned volunteer IDs for this request
    const assignedIds = new Set(
      db.prepare(
        "SELECT volunteer_id FROM assignments WHERE request_id = ? AND status NOT IN ('completed', 'rejected')"
      ).all(requestId).map((r) => r.volunteer_id)
    );

    // Get preferred skills for this request type
    const preferredSkills = requestSkillMap[req.type] || ['logistics'];

    // Score each volunteer
    const scored = volunteers
      .filter((v) => !assignedIds.has(v.id))
      .map((v) => {
        const skills = parseJsonArray(v.skills);
        let score = 0;
        const reasons = [];

        // Skill match: +30 for each preferred skill
        const matchedSkills = skills.filter((s) => preferredSkills.includes(s));
        score += matchedSkills.length * 30;
        if (matchedSkills.length > 0) {
          reasons.push(`Has relevant skills: ${matchedSkills.join(', ')}`);
        }

        // Additional skill bonus
        score += skills.length * 5;

        // Proximity score: closer volunteers get higher score (max 40 points)
        const dist = distanceKm(req.latitude, req.longitude, v.latitude, v.longitude);
        const proximityScore = Math.max(0, 40 - dist * 0.4); // 0 points at 100km, 40 at 0km
        score += Math.round(proximityScore);
        if (dist < 30) reasons.push(`Nearby: ${dist.toFixed(0)} km away`);
        else reasons.push(`${dist.toFixed(0)} km away`);

        return {
          volunteer: {
            ...v,
            is_available: Boolean(v.is_available),
            skills
          },
          score,
          distance_km: Number(dist.toFixed(1)),
          reasons
        };
      })
      .sort((a, b) => b.score - a.score);

    // Also return request info and preferred skills
    return Response.json({
      request: req,
      preferred_skills: preferredSkills,
      suggestions: scored,
      total_available: volunteers.length,
      already_assigned: assignedIds.size
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
