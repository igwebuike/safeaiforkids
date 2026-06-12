require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'SafeAIForKids <hello@safeaiforkids.com>';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://safeaiforkids.com,https://www.safeaiforkids.com,https://safeaiforkids.onrender.com,http://localhost:5500,http://127.0.0.1:5500')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '80kb' }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  }
}));

app.use('/api/waitlist', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false
}));

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set. Add a Render PostgreSQL database and connect it to this service.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS waitlist_signups (
      id SERIAL PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      email TEXT UNIQUE NOT NULL,
      audience TEXT DEFAULT 'Parent',
      country TEXT,
      source TEXT DEFAULT 'website',
      ip_address TEXT,
      user_agent TEXT,
      welcome_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS first_name TEXT;`);
  await pool.query(`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS last_name TEXT;`);
  await pool.query(`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS country TEXT;`);
  await pool.query(`ALTER TABLE waitlist_signups ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN NOT NULL DEFAULT FALSE;`);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function cleanText(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requireAdmin(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token = req.query.token || bearerToken;
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

async function sendWelcomeEmail({ email, firstName }) {
  if (!RESEND_API_KEY) {
    console.log(`RESEND_API_KEY not set. Skipping welcome email for ${email}.`);
    return false;
  }

  const name = firstName ? ` ${firstName}` : '';
  const subject = 'Welcome to NovaVerse Adventures!';
  const text = `Hi${name},\n\nWelcome to NovaVerse Adventures!\n\nYou're officially on the launch list.\n\nWe'll send you early updates on episodes, songs, books, printables, and SafeAIForKids launch news.\n\nLearn. Explore. Invent. Adventure Together!\n\n- SafeAIForKids Team`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#182033;max-width:620px;margin:auto;padding:24px;">
      <h1 style="color:#2046ff;">Welcome to NovaVerse Adventures!</h1>
      <p>Hi${name},</p>
      <p><strong>You're officially on the launch list.</strong></p>
      <p>We'll send you early updates on episodes, songs, books, printables, and SafeAIForKids launch news.</p>
      <p style="background:#eef7ff;padding:16px;border-radius:12px;"><strong>Learn. Explore. Invent. Adventure Together!</strong></p>
      <p>- SafeAIForKids Team</p>
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: email, subject, text, html })
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('Welcome email failed:', response.status, body);
    return false;
  }
  return true;
}

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'safeaiforkids-api', time: new Date().toISOString() });
});

app.post('/api/waitlist', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const firstName = cleanText(req.body.firstName || req.body.first_name, 80);
  const lastName = cleanText(req.body.lastName || req.body.last_name, 80);
  const audience = cleanText(req.body.audience || 'Parent', 80);
  const country = cleanText(req.body.country, 80);
  const source = cleanText(req.body.source || 'website', 120);

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO waitlist_signups (first_name, last_name, email, audience, country, source, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email)
       DO UPDATE SET first_name = EXCLUDED.first_name,
                     last_name = EXCLUDED.last_name,
                     audience = EXCLUDED.audience,
                     country = EXCLUDED.country,
                     source = EXCLUDED.source,
                     updated_at = NOW()
       RETURNING id, first_name, last_name, email, audience, country, source, welcome_email_sent, created_at`,
      [firstName, lastName, email, audience, country, source, req.ip, req.get('user-agent')]
    );

    const signup = result.rows[0];
    let welcomeEmailSent = signup.welcome_email_sent;
    if (!welcomeEmailSent) {
      welcomeEmailSent = await sendWelcomeEmail({ email, firstName });
      if (welcomeEmailSent) {
        await pool.query('UPDATE waitlist_signups SET welcome_email_sent = TRUE WHERE id = $1', [signup.id]);
      }
    }

    res.status(201).json({
      ok: true,
      message: 'You are on the launch list. Welcome to the NovaVerse!',
      signup: { ...signup, welcome_email_sent: welcomeEmailSent }
    });
  } catch (error) {
    console.error('Waitlist insert failed:', error);
    res.status(500).json({ error: 'Could not save signup right now.' });
  }
});

app.get('/api/admin/waitlist', requireAdmin, async (req, res) => {
  const audience = cleanText(req.query.audience, 80);
  const country = cleanText(req.query.country, 80);
  const params = [];
  const where = [];
  if (audience) { params.push(audience); where.push(`audience = $${params.length}`); }
  if (country) { params.push(country); where.push(`country = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT id, first_name, last_name, email, audience, country, source, welcome_email_sent, created_at, updated_at
     FROM waitlist_signups
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT 2000`,
    params
  );
  res.json({ count: result.rowCount, signups: result.rows });
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const total = await pool.query('SELECT COUNT(*)::int AS total FROM waitlist_signups');
  const byAudience = await pool.query(`SELECT COALESCE(NULLIF(audience,''),'Unknown') AS audience, COUNT(*)::int AS count FROM waitlist_signups GROUP BY 1 ORDER BY count DESC`);
  const byCountry = await pool.query(`SELECT COALESCE(NULLIF(country,''),'Unknown') AS country, COUNT(*)::int AS count FROM waitlist_signups GROUP BY 1 ORDER BY count DESC LIMIT 20`);
  const last7Days = await pool.query(`SELECT COUNT(*)::int AS count FROM waitlist_signups WHERE created_at >= NOW() - INTERVAL '7 days'`);
  res.json({ total: total.rows[0].total, last7Days: last7Days.rows[0].count, byAudience: byAudience.rows, byCountry: byCountry.rows });
});

app.get('/api/admin/waitlist.csv', requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT first_name, last_name, email, audience, country, source, welcome_email_sent, created_at
     FROM waitlist_signups
     ORDER BY created_at DESC`
  );
  const header = ['first_name', 'last_name', 'email', 'audience', 'country', 'source', 'welcome_email_sent', 'created_at'];
  const rows = result.rows.map(row => header.map(key => csvEscape(row[key])).join(','));
  const csv = [header.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="safeaiforkids-waitlist.csv"');
  res.send(csv);
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`SafeAIForKids API running on port ${PORT}`));
  })
  .catch(error => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
