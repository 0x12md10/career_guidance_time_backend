import express from 'express';
import Registration from '../models/Registration.js';

const router = express.Router();

// Simple PIN auth for scanner app
function requireScannerPin(req, res, next) {
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  next();
}

// ─── GET /api/checkin/:token — look up registration by QR token ───────────────
router.get('/:token', requireScannerPin, async (req, res) => {
  try {
    const reg = await Registration.findOne({ qrToken: req.params.token }).lean();
    if (!reg) {
      return res.status(404).json({ success: false, message: 'Invalid QR code.' });
    }
    return res.json({
      success: true,
      registration: {
        name: reg.name,
        phone: reg.phone,
        standard: reg.standard,
        school: reg.school,
        city: reg.city,
        checkedIn: reg.checkedIn,
        checkedInAt: reg.checkedInAt,
      },
    });
  } catch (err) {
    console.error('[checkin] lookup error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/checkin/:token — mark attendance ───────────────────────────────
router.post('/:token', requireScannerPin, async (req, res) => {
  try {
    const reg = await Registration.findOne({ qrToken: req.params.token });
    if (!reg) {
      return res.status(404).json({ success: false, message: 'Invalid QR code.' });
    }

    if (reg.checkedIn) {
      return res.status(409).json({
        success: false,
        alreadyCheckedIn: true,
        message: 'Already checked in.',
        checkedInAt: reg.checkedInAt,
        registration: {
          name: reg.name,
          standard: reg.standard,
          school: reg.school,
          city: reg.city,
        },
      });
    }

    reg.checkedIn = true;
    reg.checkedInAt = new Date();
    await reg.save();

    console.log(`✅ Checked in: ${reg.name} (${reg.phone}) at ${reg.checkedInAt.toISOString()}`);

    return res.json({
      success: true,
      message: 'Check-in successful!',
      registration: {
        name: reg.name,
        standard: reg.standard,
        school: reg.school,
        city: reg.city,
        checkedInAt: reg.checkedInAt,
      },
    });
  } catch (err) {
    console.error('[checkin] mark error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/checkin — attendance summary (admin use) ───────────────────────
router.get('/', requireScannerPin, async (_req, res) => {
  try {
    const [total, checkedIn] = await Promise.all([
      Registration.countDocuments(),
      Registration.countDocuments({ checkedIn: true }),
    ]);
    return res.json({ success: true, total, checkedIn, absent: total - checkedIn });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
