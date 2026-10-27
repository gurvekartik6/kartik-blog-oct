# Field Notes — Personal Blogging Platform

A local-first MERN application for documenting a personal diploma-to-engineering journey, internships, teaching, projects, and lessons learned. It includes a public editorial blog and a private admin CMS, with both light and dark themes.

## Stack
- React 18 + Vite + React Router
- Express 4 + Mongoose + MongoDB
- Redis + BullMQ for asynchronous newsletter announcements
- TipTap rich-text editor, server-side `sanitize-html`, client-side DOMPurify
- HTTP-only session cookies and MongoDB-backed sessions
- Resend adapter for transactional email (local log fallback)
- Local image uploads for development, with a storage adapter migration required for production
- Docker Compose, API health endpoint, seed script, test commands, production checklist

## Prerequisites
- Node.js 20+
- npm 10+
- Docker Desktop or compatible Docker Engine

## Local setup
1. Extract the archive and open a terminal in the repository root.
2. Copy `.env.example` to `.env`; set a unique `SESSION_SECRET` (at least 32 characters), `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (12+ characters).
3. Start local infrastructure:
   ```bash
   docker compose up -d mongo redis
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Create the first administrator:
   ```bash
   npm run seed:admin
   ```
6. Start frontend, API and worker:
   ```bash
   npm run dev
   ```
7. Visit `http://localhost:5173`, and open `http://localhost:5173/admin` for the admin studio. API health is at `http://localhost:4000/api/health`.

## What is included
- Public home, about, blog, article, journey, and contact routes
- Persistent light/dark theme
- Searchable article listing and article details
- Rich-text editor with headings, lists, links and blockquotes
- Admin login, dashboard stats, post create/edit/publish/delete
- Admin comment moderation, subscriber list/CSV export, editable home/about/blog/journey/contact pages and site settings (including page imagery), local media library, newsletter campaign history, contact messages
- Likes with per-browser cookie identifier and uniqueness constraint
- Comment submission requiring moderation
- Double-opt-in newsletter with explicit confirmation/unsubscribe forms (to reduce link-scanner side effects), queue retries, and campaign status
- Contact form persistence
- SEO fields on posts/pages, dynamic sitemap endpoint at `/sitemap.xml`, and a production readiness checklist

## Local database backups (Windows PowerShell)

Install MongoDB Database Tools (`mongodump` and `mongorestore`) and ensure both commands are on `PATH`. With the local MongoDB service running:

```powershell
.\scripts\backup-mongodb.ps1
.\scripts\restore-mongodb.ps1 -ArchivePath .\backups\personal-blog-YYYYMMDD-HHMMSS.archive.gz
```

Restore asks for explicit confirmation and uses `--drop` for collections in the archive. Back up the current database before restoring. Backup files are excluded from Git. This is a local convenience, not a substitute for automated encrypted backups and restore drills on the production database.

## Tests and verification

Run the unit tests with `npm test`. The API health-route integration smoke test is opt-in because it initializes the Mongo-backed session store: start MongoDB, then run `RUN_INTEGRATION_TESTS=1 npm run test -w apps/api` (PowerShell: `$env:RUN_INTEGRATION_TESTS='1'; npm run test -w apps/api`). Full browser/database/Redis/email-provider integration still requires the corresponding services and credentials.

## Email behavior
Without `RESEND_API_KEY` and `EMAIL_FROM`, email sends are logged to the API/worker terminal. This is for local development only. For actual delivery, verify a sender domain and configure SPF/DKIM/DMARC with your provider. Publishing a post creates a campaign and enqueues it automatically; the worker sends to confirmed subscribers. Failed campaigns can be retried from the admin Newsletter history.

## Media behavior
Uploads are stored in `./uploads` for local development. Do not deploy this local storage adapter to an ephemeral serverless filesystem. Before production, replace it with Cloudinary or S3-compatible object storage, update URL generation, and configure backups/retention.

## Important production limitations
This is a production-oriented implementation, but not a certified or audited hosted service. Before launch:
- Use durable object storage for media.
- Configure provider webhook signature verification and bounce/complaint suppression.
- Add CSRF protection to cookie-authenticated mutations and consider MFA/password recovery.
- Configure managed MongoDB/Redis with TLS, network access controls and backup/restore tests.
- Add integration/e2e tests, monitoring, accessibility checks and a security review.
- Review privacy policy, consent retention, export/deletion workflows and applicable laws.
- Configure the public site canonical URL and mail provider links for your final domain.

See `docs/PRODUCTION_CHECKLIST.md`.
