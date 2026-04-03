import express from 'express';
import xlsx from 'xlsx';
import Registration from '../models/Registration.js';

const router = express.Router();

// ─── Auth middleware ───────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ success: false, message: 'Admin access is not configured.' });
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  next();
}

// ─── POST /api/admin/verify — validate password, return token ─────────────────
router.post('/verify', (req, res) => {
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ success: false, message: 'Admin access is not configured.' });
  }
  const { password } = req.body;
  if (!password || password !== ADMIN_TOKEN) {
    // Generic message — don't reveal why it failed
    return res.status(401).json({ success: false, message: 'Invalid password.' });
  }
  // The token IS the password for simplicity — no JWT required for this single-user admin
  return res.json({ success: true, token: ADMIN_TOKEN });
});

// ─── Build Mongoose query from search string ───────────────────────────────────
function buildSearchQuery(search) {
  if (!search || !search.trim()) return {};
  const s = search.trim();
  const regex = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return {
    $or: [
      { name: regex },
      { phone: regex },
      { email: regex },
      { school: regex },
      { city: regex },
      { parentName: regex },
      { howHeard: regex },
    ],
  };
}

// ─── GET /api/admin/registrations — paginated list ───────────────────────────
router.get('/registrations', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const search = req.query.search || '';
    const sortKey = ['createdAt', 'name', 'phone', 'email', 'standard', 'school', 'city'].includes(req.query.sortKey)
      ? req.query.sortKey : 'createdAt';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

    const query = buildSearchQuery(search);
    const [registrations, total] = await Promise.all([
      Registration.find(query)
        .sort({ [sortKey]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Registration.countDocuments(query),
    ]);

    return res.json({ success: true, registrations, total, page, limit });
  } catch (err) {
    console.error('[admin] list error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch registrations.' });
  }
});

// ─── GET /api/admin/export — download full list as Excel ─────────────────────
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const search = req.query.search || '';
    const query = buildSearchQuery(search);

    const registrations = await Registration.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Build worksheet rows
    const rows = registrations.map((r, i) => ({
      'S.No': i + 1,
      'Registered At': r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : '',
      'Name': r.name || '',
      'Phone': r.phone || '',
      'Email': r.email || '',
      'Grade': r.standard || '',
      'School / College': r.school || '',
      'City': r.city || '',
      'Parent Name': r.parentName || '',
      'Parent Phone': r.parentPhone || '',
      'How Heard': r.howHeard || '',
    }));

    const worksheet = xlsx.utils.json_to_sheet(rows);

    // Column widths
    worksheet['!cols'] = [
      { wch: 6 },   // S.No
      { wch: 22 },  // Registered At
      { wch: 25 },  // Name
      { wch: 14 },  // Phone
      { wch: 30 },  // Email
      { wch: 8 },   // Grade
      { wch: 35 },  // School
      { wch: 18 },  // City
      { wch: 25 },  // Parent Name
      { wch: 14 },  // Parent Phone
      { wch: 14 },  // How Heard
    ];

    // Style header row bold (xlsx supports basic styles via SheetJS Pro; use cell format trick)
    const range = xlsx.utils.decode_range(worksheet['!ref']);
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddr = xlsx.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddr]) continue;
      worksheet[cellAddr].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'F97316' } },
        alignment: { horizontal: 'center' },
      };
    }

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Registrations');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `sigaram_registrations_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[admin] export error:', err.message);
    return res.status(500).json({ success: false, message: 'Export failed.' });
  }
});

export default router;
