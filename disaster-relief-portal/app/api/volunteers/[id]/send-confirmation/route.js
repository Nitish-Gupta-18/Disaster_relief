import db from '@/lib/db';
import { sendVolunteerConfirmation } from '@/lib/mailer';

export async function POST(_request, { params }) {
  try {
    const id = Number((await params).id);
    const volunteer = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(id);
    if (!volunteer) return Response.json({ error: 'Volunteer not found' }, { status: 404 });
    if (!volunteer.email) return Response.json({ error: 'Volunteer has no email address' }, { status: 400 });

    try {
      await sendVolunteerConfirmation({ name: volunteer.name, email: volunteer.email });
      return Response.json({ message: 'Confirmation email sent', email: volunteer.email });
    } catch (err) {
      console.error('[volunteers] Failed to send confirmation:', err.message);
      return Response.json({ error: 'Failed to send confirmation email' }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 500 });
  }
}
