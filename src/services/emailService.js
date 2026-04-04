import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';

/**
 * AWS SES + Nodemailer email service.
 *
 * Required env vars:
 *   AWS_REGION            — e.g. ap-south-1
 *   AWS_ACCESS_KEY_ID     — IAM user access key
 *   AWS_SECRET_ACCESS_KEY — IAM user secret key
 *   SES_FROM_ADDRESS      — verified sender address in SES (e.g. noreply@yourdomain.com)
 *   SES_BCC_ADDRESS       — optional BCC (defaults to timetirunelveli@gmail.com)
 */

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SES_FROM_ADDRESS } = process.env;

  if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !SES_FROM_ADDRESS) {
    console.warn(
      '⚠️  AWS SES not configured — missing one or more of: ' +
      'AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SES_FROM_ADDRESS'
    );
    return null;
  }

  const sesClient = new SESClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  _transporter = nodemailer.createTransport({
    SES: { ses: sesClient, aws: { SendRawEmailCommand } },
    sendingRate: 14, // SES default sandbox: 1/s; production: up to 14/s
  });

  return _transporter;
}

function buildHtml(data) {
  const { name, phone, email, standard, school, city } = data;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Registration Confirmed — SIGARAM THODU</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0a0f; font-family: 'Segoe UI', Arial, sans-serif; color: #e5e7eb; }
    .wrapper { max-width: 560px; margin: 32px auto; background: #12121a; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
    .header { background: linear-gradient(135deg, #ea6c00, #f97316); padding: 36px 32px; text-align: center; }
    .header h1 { margin: 0 0 4px; font-size: 28px; color: #fff; letter-spacing: 1px; }
    .header p { margin: 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); color: #fff; border-radius: 999px; padding: 4px 14px; font-size: 12px; margin-bottom: 12px; }
    .body { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #fff; }
    .intro { font-size: 14px; color: #9ca3af; margin-bottom: 24px; line-height: 1.6; }
    .detail-box { background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.2); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-row .lbl { color: #9ca3af; }
    .detail-row .val { color: #f3f4f6; font-weight: 500; text-align: right; }
    .event-box { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .event-box h3 { margin: 0 0 12px; font-size: 15px; color: #f97316; }
    .event-item { font-size: 13px; color: #d1d5db; margin: 6px 0; }
    .event-item span { margin-right: 6px; }
    .note { font-size: 12px; color: #6b7280; text-align: center; line-height: 1.6; margin-bottom: 24px; }
    .footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 20px 32px; text-align: center; }
    .footer p { margin: 0; font-size: 11px; color: #4b5563; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">Registration Confirmed ✓</div>
      <h1>SIGARAM THODU</h1>
      <p>Free Education Guidance Program — T.I.M.E Tirunelveli</p>
    </div>
    <div class="body">
      <p class="greeting">Hello ${name}! 🎉</p>
      <p class="intro">
        Your registration for <strong>SIGARAM THODU</strong> is confirmed.
        We look forward to seeing you at this free education guidance program.
      </p>

      <div class="detail-box">
        <div class="detail-row"><span class="lbl">Name</span><span class="val">${name}</span></div>
        <div class="detail-row"><span class="lbl">Phone</span><span class="val">${phone}</span></div>
        <div class="detail-row"><span class="lbl">Email</span><span class="val">${email}</span></div>
        <div class="detail-row"><span class="lbl">Grade</span><span class="val">${standard}</span></div>
        <div class="detail-row"><span class="lbl">School</span><span class="val">${school}</span></div>
        <div class="detail-row"><span class="lbl">City</span><span class="val">${city}</span></div>
      </div>

      <div class="event-box">
        <h3>📅 Event Details</h3>
        <div class="event-item"><span>📆</span> April 26, 2026 (Sunday)</div>
        <div class="event-item"><span>🕥</span> 9:00 AM – 1:00 PM</div>
        <div class="event-item"><span>📍</span> T.I.M.E Institute, Tirunelveli, Tamil Nadu</div>
        <div class="event-item"><span>💰</span> Completely FREE — No charges</div>
        <div class="event-item"><span>🎁</span> Free handbooks worth ₹500 each for all attendees</div>
      </div>

      <p class="note">
        Please arrive on time. Seats are limited.<br />
        Keep this email as your entry confirmation.<br /><br />
        <strong>Tamil:</strong> தயவுசெய்து நேரத்தில் வாருங்கள். இடங்கள் குறைவு.<br />
        இந்த மின்னஞ்சலை உங்கள் நுழைவு உறுதிப்படுத்தலாக வைத்திருங்கள்.
      </p>
    </div>
    <div class="footer">
      <p>T.I.M.E Institute, Tirunelveli • tirunelveli@time4education.com</p>
      <p style="margin-top:6px;">© 2026 T.I.M.E Tirunelveli. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send a registration confirmation email via AWS SES.
 * Never throws — logs errors gracefully so registration is never blocked.
 */
export async function sendConfirmationEmail(registrationData) {
  const transporter = getTransporter();
  if (!transporter) return;

  const { name, email } = registrationData;
  const fromAddress = process.env.SES_FROM_ADDRESS;
  const fromName = 'SIGARAM THODU — T.I.M.E Tirunelveli';
  const bccAddress = process.env.SES_BCC_ADDRESS || 'timetirunelveli@gmail.com';

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      replyTo: 'tirunelveli@time4education.com',
      to: email,
      bcc: bccAddress,
      subject: `Registration Confirmed - SIGARAM THODU | ${name}`,
      headers: {
        'X-Entity-Ref-ID': `sigaram-${Date.now()}`,
        'List-Unsubscribe': `<mailto:tirunelveli@time4education.com?subject=unsubscribe>`,
        'Precedence': 'bulk',
      },
      text: [
        `Hello ${name},`,
        '',
        'Your registration for SIGARAM THODU is confirmed!',
        '',
        'Event Details:',
        '  Date   : April 26, 2026 (Sunday)',
        '  Time   : 9:00 AM – 1:00 PM',
        '  Venue  : T.I.M.E Institute, Tirunelveli',
        '  Entry  : Free',
        '',
        'Please arrive on time. Keep this email as your confirmation.',
        '',
        '— T.I.M.E Tirunelveli',
        '  +91 76039 12341 / +91 76039 12342',
        '  timetirunelveli@gmail.com',
      ].join('\n'),
      html: buildHtml(registrationData),
    });
    console.log(`📧 Email sent via SES to ${email} (MessageId: ${info.messageId})`);
  } catch (err) {
    console.error('❌ SES email failed:', err.message);
  }
}
