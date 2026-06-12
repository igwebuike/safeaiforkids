require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://safeaiforkids.com,https://www.safeaiforkids.com,https://safeaiforkids.onrender.com,http://localhost:5500,http://127.0.0.1:5500')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '50kb' }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  }
}));

app.use('/api/waitlist', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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
      email TEXT UNIQUE NOT NULL,
      audience TEXT DEFAULT 'parent',
      source TEXT DEFAULT 'website',
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'safeaiforkids-api', time: new Date().toISOString() });
});

app.post('/api/waitlist', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const audience = String(req.body.audience || 'parent').trim().slice(0, 80);
  const source = String(req.body.source || 'website').trim().slice(0, 120);

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO waitlist_signups (email, audience, source, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email)
       DO UPDATE SET audience = EXCLUDED.audience, source = EXCLUDED.source, updated_at = NOW()
       RETURNING id, email, audience, created_at`,
      [email, audience, source, req.ip, req.get('user-agent')]
    );

    res.status(201).json({
      ok: true,
      message: 'You are on the launch list. Welcome to the NovaVerse!',
      signup: result.rows[0]
    });
  } catch (error) {
    console.error('Waitlist insert failed:', error);
    res.status(500).json({ error: 'Could not save signup right now.' });
  }
});

app.get('/api/admin/waitlist', async (req, res) => {
  if (!ADMIN_TOKEN || req.query.token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const result = await pool.query(
    `SELECT id, email, audience, source, created_at, updated_at
     FROM waitlist_signups
     ORDER BY created_at DESC
     LIMIT 1000`
  );
  res.json({ count: result.rowCount, signups: result.rows });
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`SafeAIForKids API running on port ${PORT}`));
  })
  .catch(error => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
