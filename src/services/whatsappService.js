/**
 * WhatsApp Business Cloud API (Meta) integration.
 *
 * Prerequisites (set in .env):
 *   WHATSAPP_PHONE_NUMBER_ID  — from Meta Developer Dashboard
 *   WHATSAPP_ACCESS_TOKEN     — System User permanent token or Page token
 *   WHATSAPP_TEMPLATE_NAME    — approved template name (default: registration_confirmation)
 *   WHATSAPP_TEMPLATE_LANG    — template language code (default: en_US)
 *
 * Template must be approved in WhatsApp Manager before going live.
 * For testing without an approved template, set WHATSAPP_FREE_FORM=true
 * and message within a 24-hour window after the user messages your number.
 */

const META_API_VERSION = 'v19.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Format an Indian phone number for WhatsApp API (E.164 format, no "+").
 * Accepts: "9876543210" → "919876543210"
 */
function formatPhone(phone) {
  const clean = String(phone).replace(/\D/g, '');
  // Already has country code
  if (clean.length === 12 && clean.startsWith('91')) return clean;
  if (clean.length === 10) return `91${clean}`;
  return clean;
}

/**
 * Build the WhatsApp message payload.
 *
 * Uses a template message if WHATSAPP_TEMPLATE_NAME is set,
 * otherwise falls back to a plain text message (only valid within 24h window).
 */
function buildPayload(to, data) {
  const { name } = data;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';

  if (templateName) {
    // --- Template message (required for business-initiated messages) ---
    // Template body: "Hello *{{1}}*! Your registration is successful."
    // {{1}} = name only
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: name },
            ],
          },
        ],
      },
    };
  }

  // --- Free-form text (testing only, within 24h customer-initiated window) ---
  const text = [
    `✅ *SIGARAM THODU — Registration Confirmed!*`,
    '',
    `Hello *${name}*! Your registration is successful.`,
    '',
    `*Event Details:*`,
    `📆 April 26, 2025 (Sunday)`,
    `🕥 9:00 AM – 1:00 PM`,
    `📍 T.I.M.E Institute, Tirunelveli`,
    `💰 Completely FREE`,
    '',
    `Please arrive on time. Seats are limited!`,
    '',
    `_— T.I.M.E Tirunelveli_`,
  ].join('\n');

  return {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text, preview_url: false },
  };
}

/**
 * Send a WhatsApp confirmation to the registrant's phone number.
 * Never throws — logs errors and returns gracefully.
 */
export async function sendWhatsAppConfirmation(registrationData) {
  const { WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN } = process.env;

  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.warn('⚠️  WhatsApp not configured — WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN missing');
    return;
  }

  const to = formatPhone(registrationData.phone);
  const payload = buildPayload(to, registrationData);
  const url = `${META_BASE}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json();

    if (!res.ok) {
      console.error(`❌ WhatsApp API error (${res.status}):`, JSON.stringify(body));
      return;
    }

    const msgId = body?.messages?.[0]?.id ?? 'unknown';
    console.log(`💬 WhatsApp message sent to ${to} (id: ${msgId})`);
  } catch (err) {
    console.error('❌ WhatsApp send failed:', err.message);
  }
}
