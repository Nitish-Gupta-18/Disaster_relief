import db, { initDb } from '@/lib/db';

initDb();

export async function GET() {
  return Response.json({ ok: true, service: 'Disaster Relief Coordination Portal', runtime: 'Bun + Next.js' });
}
