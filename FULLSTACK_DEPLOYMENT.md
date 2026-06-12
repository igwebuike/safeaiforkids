# SafeAIForKids Fullstack Deployment

## Services

1. Static Site
   - Root Directory: blank
   - Build Command: blank
   - Publish Directory: .

2. PostgreSQL
   - Name: safeaiforkids-db
   - Database: safeaiforkids
   - User: safeaiforkids_user

3. Web Service API
   - Name: safeaiforkids-api
   - Root Directory: backend
   - Build Command: npm install
   - Start Command: npm start

## Required API environment variables

```env
NODE_ENV=production
DATABASE_URL=<Render Internal Database URL>
ADMIN_TOKEN=<your-secret-admin-token>
ALLOWED_ORIGINS=https://safeaiforkids.com,https://www.safeaiforkids.com,https://safeaiforkids.onrender.com
```

## Optional welcome email variables

To send welcome emails, create a Resend account, verify your sending domain, then add:

```env
RESEND_API_KEY=<your-resend-api-key>
FROM_EMAIL=SafeAIForKids <hello@safeaiforkids.com>
```

Without `RESEND_API_KEY`, signups still save to the database, but welcome emails are skipped.

## Admin dashboard

Open:

```text
https://safeaiforkids.com/admin
```

Use your `ADMIN_TOKEN` to log in.

## Useful SQL

```sql
SELECT first_name, last_name, email, audience, country, source, welcome_email_sent, created_at
FROM waitlist_signups
ORDER BY created_at DESC
LIMIT 50;
```
