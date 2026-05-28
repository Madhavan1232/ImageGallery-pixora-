const nodemailer = require('nodemailer');

function getTransportConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';

  if (!host || !user || !pass) return null;

  return {
    host,
    port,
    secure,
    auth: { user, pass },
  };
}

async function submitHelpRequest(req, res) {
  try {
    const { type, email, subject, description, reportedPerson } = req.body;

    if (!email || !subject || !description) {
      return res.status(400).json({ error: 'Email, subject and description are required' });
    }

    const recipient = process.env.SUPPORT_EMAIL || 'madhavanvairavan3@gmail.com';
    const transportConfig = getTransportConfig();
    if (!transportConfig) {
      return res.status(503).json({
        error: 'Mail service is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in backend .env',
      });
    }

    const transporter = nodemailer.createTransport(transportConfig);

    const safeType = type || 'Report';
    const safeReportedPerson = reportedPerson ? String(reportedPerson).trim() : 'Not provided';

    const text = [
      `New ${safeType} received from Pixora Help page`,
      '',
      `From email: ${email}`,
      `Subject: ${subject}`,
      `Reported person: ${safeReportedPerson}`,
      `IP: ${req.ip}`,
      `User-Agent: ${req.get('user-agent') || 'Unknown'}`,
      '',
      'Description:',
      description,
    ].join('\n');

    const html = `
      <h2>New ${safeType} from Pixora Help page</h2>
      <p><strong>From email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Reported person:</strong> ${safeReportedPerson}</p>
      <p><strong>IP:</strong> ${req.ip}</p>
      <p><strong>User-Agent:</strong> ${req.get('user-agent') || 'Unknown'}</p>
      <hr />
      <p><strong>Description:</strong></p>
      <p style="white-space: pre-wrap;">${String(description)}</p>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient,
      subject: `[Pixora ${safeType}] ${subject}`,
      text,
      html,
      replyTo: email,
    });

    return res.status(202).json({ message: 'Request submitted successfully' });
  } catch (err) {
    console.error('Support request email error:', err);
    return res.status(500).json({ error: 'Failed to send help request email' });
  }
}

module.exports = { submitHelpRequest };
