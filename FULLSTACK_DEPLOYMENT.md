# SafeAIForKids Fullstack Deployment

This update turns the waitlist from browser-only storage into a real database-backed signup flow.

## What changed

- Frontend `script.js` now sends waitlist signups to a backend API.
- New `/backend` folder contains an Express API.
- Backend stores emails in PostgreSQL.
- Admin endpoint lets you view signups.

## Render setup

### 1. Push this repo to GitHub

```bash
git add .
git commit -m "Add database-backed waitlist API"
git push origin main
```

Your existing static site will auto-deploy.

### 2. Create Render PostgreSQL

Render Dashboard → New → PostgreSQL

Name:
`safeaiforkids-db`

Copy the Internal Database URL.

### 3. Create Render Web Service for backend

Render Dashboard → New → Web Service → select the same GitHub repo.

Settings:

- Name: `safeaiforkids-api`
- Root Directory: `backend`
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`

Environment variables:

- `DATABASE_URL` = your Render PostgreSQL Internal Database URL
- `NODE_ENV` = `production`
- `ADMIN_TOKEN` = create a long private password/token
- `ALLOWED_ORIGINS` = `https://safeaiforkids.com,https://www.safeaiforkids.com,https://safeaiforkids.onrender.com`

### 4. Confirm backend works

Open:

`https://safeaiforkids-api.onrender.com/health`

You should see:

```json
{"ok":true}
```

### 5. Test waitlist

Go to:

`https://safeaiforkids.com`

Submit an email.

### 6. View signups

Open:

`https://safeaiforkids-api.onrender.com/api/admin/waitlist?token=YOUR_ADMIN_TOKEN`

