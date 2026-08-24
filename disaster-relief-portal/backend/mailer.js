const nodemailer = require('nodemailer');

let transporterPromise = null;

function getTransporter() {
  if (transporterPromise) return transporterPromise;
  const host = process.env.SMTP_HOST, port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    transporterPromise = Promise.resolve(nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }));
  } else {
    transporterPromise = nodemailer.createTestAccount().then((account) => {
      console.log('[mailer] Using Ethereal test account:', account.user);
      return nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, secure: false, auth: { user: account.user, pass: account.pass } });
    });
  }
  return transporterPromise;
}

function logPreview(info) { const u = nodemailer.getTestMessageUrl(info); if (u) console.log(`[mailer] Preview: ${u}`); }

function urgencyBadge(u) {
  const c = { critical: '#DC2626', high: '#EA580C', medium: '#CA8A04', low: '#16A34A' };
  return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;color:#fff;background:${c[u] || '#475569'}">${u}</span>`;
}

async function sendMail(to, subject, headerGradient, headerEmoji, headerTitle, bodyHtml) {
  const transporter = await getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@relief-portal.org';
  const info = await transporter.sendMail({
    from: `"Disaster Relief Portal" <${from}>`, to, subject,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<div style="background:${headerGradient};padding:24px;border-radius:12px 12px 0 0;text-align:center">
<h1 style="color:#fff;margin:0;font-size:24px">${headerEmoji} ${headerTitle}</h1></div>
<div style="background:#fff;padding:24px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px">
${bodyHtml}
<p style="margin-top:24px;font-size:12px;color:#94A3B8;text-align:center">⚠️ Automated notification — do not reply.<br>— Disaster Relief Coordination Portal</p>
</div></div>`
  });
  logPreview(info);
  return info;
}

// ─── Public exports ───

async function sendVolunteerConfirmation(volunteer) {
  return sendMail(volunteer.email, '✅ You are now a confirmed volunteer!',
    'linear-gradient(135deg,#FF7A30,#F97316)', '🎉', 'Volunteer Confirmed!',
    `<p style="font-size:16px;color:#334155">Hello <strong>${volunteer.name}</strong>,</p>
<p style="font-size:15px;color:#475569;line-height:1.6">Your registration has been confirmed. You are now an active volunteer with the <strong>Disaster Relief Coordination Portal</strong>.</p>
<p style="font-size:15px;color:#475569;line-height:1.6">You will receive email notifications for all assignment updates.</p>`);
}

async function sendAssignmentNotification(volunteer, request) {
  return sendMail(volunteer.email, `📋 New Assignment: ${request.type.toUpperCase()} in ${request.location}`,
    'linear-gradient(135deg,#2563EB,#1D4ED8)', '📋', 'New Request Assignment',
    `<p style="font-size:16px;color:#334155">Hello <strong>${volunteer.name}</strong>,</p>
<p style="font-size:15px;color:#475569;line-height:1.6">You have been assigned to a relief request:</p>
<div style="margin:16px 0;padding:16px;background:#F8FAFC;border-radius:10px;border:1px solid #E2E8F0">
<table style="width:100%;font-size:14px">
<tr><td style="padding:6px 0;color:#64748B;font-weight:600;width:110px">Request ID</td><td style="color:#0F172A;font-weight:500">#${request.id}</td></tr>
<tr><td style="padding:6px 0;color:#64748B;font-weight:600">Location</td><td style="color:#0F172A">${request.location}</td></tr>
<tr><td style="padding:6px 0;color:#64748B;font-weight:600">Type</td><td style="color:#0F172A;text-transform:capitalize">${request.type}</td></tr>
<tr><td style="padding:6px 0;color:#64748B;font-weight:600">Urgency</td><td>${urgencyBadge(request.urgency)}</td></tr>
${request.description ? `<tr><td style="padding:6px 0;color:#64748B;font-weight:600">Description</td><td style="color:#0F172A">${request.description}</td></tr>` : ''}
</table></div>
<p style="font-size:14px;color:#475569">Log in to view details and update your progress.</p>`);
}

async function sendAssignmentStatusEmail(volunteer, request, newStatus, oldStatus) {
  const config = {
    accepted: { emoji: '✅', color: '#16A34A', label: 'Accepted', grad: 'linear-gradient(135deg,#16A34A,#15803D)' },
    in_progress: { emoji: '🚧', color: '#2563EB', label: 'In Progress', grad: 'linear-gradient(135deg,#2563EB,#1D4ED8)' },
    completed: { emoji: '🎉', color: '#7C3AED', label: 'Completed', grad: 'linear-gradient(135deg,#7C3AED,#6D28D9)' },
    rejected: { emoji: '❌', color: '#DC2626', label: 'Rejected', grad: 'linear-gradient(135deg,#DC2626,#B91C1C)' }
  };
  const c = config[newStatus] || { emoji: '📌', color: '#475569', label: newStatus, grad: 'linear-gradient(135deg,#475569,#334155)' };
  return sendMail(volunteer.email, `${c.emoji} Assignment ${c.label}: Request #${request.id}`,
    c.grad, c.emoji, `Assignment ${c.label}`,
    `<p style="font-size:16px;color:#334155">Hello <strong>${volunteer.name}</strong>,</p>
<p style="font-size:15px;color:#475569">Your assignment for request <strong>#${request.id}</strong> is now <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;color:#fff;background:${c.color}">${c.label.replace('_', ' ')}</span>${oldStatus ? ` (was: ${oldStatus.replace('_', ' ')})` : ''}.</p>
<table style="width:100%;font-size:14px;margin:12px 0"><tr><td style="padding:4px 0;color:#64748B">Location</td><td style="color:#0F172A">${request.location}</td></tr><tr><td style="padding:4px 0;color:#64748B">Type</td><td style="color:#0F172A;text-transform:capitalize">${request.type}</td></tr></table>
<p style="font-size:14px;color:#475569">Log in to the portal for full details.</p>`);
}

async function sendUnassignedEmail(volunteer, request) {
  return sendMail(volunteer.email, `🔓 Unassigned: Request #${request.id}`,
    'linear-gradient(135deg,#64748B,#475569)', '🔓', 'Unassigned from Request',
    `<p style="font-size:16px;color:#334155">Hello <strong>${volunteer.name}</strong>,</p>
<p style="font-size:15px;color:#475569;line-height:1.6">You have been <strong>unassigned</strong> from request <strong>#${request.id}</strong> (${request.type} — ${request.location}).</p>
<p style="font-size:15px;color:#475569">You are now available for new assignments.</p>`);
}

async function sendRequestStatusEmail(volunteer, request, newStatus) {
  const config = {
    assigned: { emoji: '📋', color: '#2563EB', label: 'Assigned' },
    in_progress: { emoji: '🚧', color: '#EA580C', label: 'In Progress' },
    completed: { emoji: '✅', color: '#16A34A', label: 'Completed' }
  };
  const c = config[newStatus] || { emoji: '📌', color: '#475569', label: newStatus };
  return sendMail(volunteer.email, `${c.emoji} Request #${request.id} is now ${c.label}`,
    `linear-gradient(135deg,${c.color},${c.color}dd)`, c.emoji, `Request ${c.label}`,
    `<p style="font-size:16px;color:#334155">Hello <strong>${volunteer.name}</strong>,</p>
<p style="font-size:15px;color:#475569">Request <strong>#${request.id}</strong> (${request.type} — ${request.location}) is now <span style="font-weight:600;color:${c.color}">${c.label.replace('_', ' ')}</span>.</p>
<p style="font-size:14px;color:#475569">Log in to the portal for full details.</p>`);
}

async function sendProfileUpdateEmail(volunteer, changedFields) {
  const labels = { name: 'Name', phone: 'Phone', email: 'Email', skills: 'Skills', location_name: 'Location', is_available: 'Availability' };
  const list = changedFields.map((f) => labels[f] || f).join(', ');
  return sendMail(volunteer.email, '📝 Your volunteer profile has been updated',
    'linear-gradient(135deg,#8B5CF6,#7C3AED)', '📝', 'Profile Updated',
    `<p style="font-size:16px;color:#334155">Hello <strong>${volunteer.name}</strong>,</p>
<p style="font-size:15px;color:#475569">Your profile was updated: <strong>${list}</strong>.</p>
<p style="font-size:14px;color:#EF4444">If you didn't request this, contact the admin team immediately.</p>`);
}

module.exports = { sendVolunteerConfirmation, sendAssignmentNotification, sendAssignmentStatusEmail, sendUnassignedEmail, sendRequestStatusEmail, sendProfileUpdateEmail };
