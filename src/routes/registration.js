import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import Registration from '../models/Registration.js';
import { sendConfirmationEmail } from '../services/emailService.js';
import { sendWhatsAppConfirmation } from '../services/whatsappService.js';

const router = express.Router();

// ─── Strict rate-limit for registration endpoint ──────────────────────────────
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // max 5 registration attempts per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again in 1 hour.',
  },
  skipSuccessfulRequests: true, // don't count successful registrations against limit
});

// ─── Input validation rules ───────────────────────────────────────────────────
const registrationValidators = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ max: 100 }).withMessage('Name must be under 100 characters.')
    .escape(),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .matches(/^[6-9]\d{9}$/).withMessage('Please enter a valid 10-digit Indian phone number.'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail({ gmail_remove_dots: false })
    .isLength({ max: 254 }).withMessage('Email is too long.'),
  body('standard')
    .trim()
    .notEmpty().withMessage('Grade is required.')
    .isIn(['9', '10', '11', '12', 'other']).withMessage('Invalid grade value.'),
  body('school')
    .trim()
    .notEmpty().withMessage('School name is required.')
    .isLength({ max: 200 }).withMessage('School name is too long.')
    .escape(),
  body('city')
    .trim()
    .notEmpty().withMessage('City is required.')
    .isLength({ max: 100 }).withMessage('City name is too long.')
    .escape(),
  // Optional fields
  body('parentName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Parent name must be under 100 characters.')
    .escape(),
  body('parentPhone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[6-9]\d{9}$/).withMessage('Please enter a valid 10-digit parent phone number.'),
  body('howHeard')
    .optional({ checkFalsy: true })
    .trim()
    .isIn(['friend', 'social_media', 'school', 'family', 'other', '']).withMessage('Invalid source value.'),
];

// ─── POST /api/register ───────────────────────────────────────────────────────
router.post(
  '/',
  registrationLimiter,
  registrationValidators,
  async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors.array().map((e) => e.msg).join(' ');
      return res.status(400).json({ success: false, message: messages });
    }

    const {
      name, phone, email, standard, school, city,
      parentName, parentPhone, howHeard,
    } = req.body;

    try {
      // Duplicate phone check
      const existing = await Registration.findOne({ phone });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'This phone number is already registered. / இந்த தொலைபேசி எண் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது.',
        });
      }

      const registration = await Registration.create({
        name, phone, email, standard, school, city,
        parentName: parentName || undefined,
        parentPhone: parentPhone || undefined,
        howHeard: howHeard || undefined,
      });

      // ── Send notifications asynchronously (don't block the response) ────────
      const notifData = { name, phone, email, standard, school, city, qrToken: registration.qrToken };
      Promise.allSettled([
        sendConfirmationEmail(notifData),
        sendWhatsAppConfirmation(notifData),
      ]).then((results) => {
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.error(`Notification ${i} failed:`, r.reason);
          }
        });
      });

      return res.status(201).json({
        success: true,
        message:
          'Registration successful! Welcome to SIGARAM THODU. / பதிவு வெற்றிகரமாக நடந்தது! சிகரம் தொடு நிகழ்வில் உங்களை வரவேற்கிறோம்.',
        data: {
          id: registration._id,
          name: registration.name,
          email: registration.email,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key — race condition safety net
        return res.status(409).json({
          success: false,
          message: 'This phone number is already registered.',
        });
      }
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((e) => e.message).join(', ');
        return res.status(400).json({ success: false, message: messages });
      }
      console.error(`[registration] Unexpected error for phone ${phone}:`, error.message);
      return res.status(500).json({
        success: false,
        message: 'Server error. Please try again. / சர்வர் பிழை. மீண்டும் முயற்சிக்கவும்.',
      });
    }
  }
);

// ─── GET /api/register/count ──────────────────────────────────────────────────
router.get('/count', async (_req, res) => {
  try {
    const count = await Registration.countDocuments();
    return res.json({ success: true, count });
  } catch {
    return res.status(500).json({ success: false, count: 0 });
  }
});

export default router;
