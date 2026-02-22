# Moments — Environment Setup

## Prerequisites

- Node.js 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (v4+)
- Cloudflare account (for remote deploy)

## 1. Install Dependencies

From the project root:

```bash
npm install
```

## 2. Create Cloudflare Resources (First-Time Only)

### D1 Database

```bash
cd moments
wrangler d1 create moments-db
```

Copy the `database_id` from the output and update `moments/wrangler.json` and `moments-admin/wrangler.json`:

```json
"database_id": "YOUR_ACTUAL_DATABASE_ID"
```

Replace `REPLACE_AFTER_wrangler_d1_create` with the actual ID.

### R2 Bucket

```bash
wrangler r2 bucket create moments-media
```

### WebDAV (for photo uploads)

Photos are stored on your WebDAV server (e.g. NAS) and served via an authenticated proxy.

1. Set `moments-admin/wrangler.json` var:
   - `WEBDAV_BASE_URL` — base URL (e.g. `https://photo.zelen.uk/originals`)
2. Add secrets for local dev (`.dev.vars`) or production:

```bash
cd moments-admin
wrangler secret put WEBDAV_USERNAME
wrangler secret put WEBDAV_PASSWORD
```

For local dev, create `moments-admin/.dev.vars`:

```
WEBDAV_USERNAME=your_username
WEBDAV_PASSWORD=your_password
```

(Ensure `.dev.vars` is in `.gitignore` — it is by default.)

### PhotoPrism integration

To import photos from PhotoPrism (e.g. on your NAS):

1. Set `moments-admin/wrangler.json` var:
   - `PHOTOPRISM_BASE_URL` — your PhotoPrism URL (e.g. `https://photo.zelen.uk`)
2. Use the same `WEBDAV_USERNAME` and `WEBDAV_PASSWORD` (PhotoPrism login).
3. In the admin, open an album and click **Add from PhotoPrism** to browse and select photos to publish.

## 3. Default Admin User

After migrations, a default admin user is available:

- **Email:** `ozelen@example.com` (or `ozelen`)
- **Password:** `Abcd1234`

Change the password in production.

## 4. Apply Database Migrations

**Local development** (uses `.wrangler/state/`):

```bash
npm run db:migrate:local
```

**Remote** (Cloudflare D1):

```bash
npm run db:migrate:remote
```

## 5. Run Development Servers

**Astro site (portfolio):**

```bash
npm run dev
```

**Admin panel:**

```bash
npm run dev:admin
```

**Both at once:**

```bash
npm run dev:all
```

For local D1 persistence, use:

```bash
cd moments && wrangler dev --persist
```

(Astro dev server uses platform proxy; D1 state persists in `.wrangler/state/`)

## 6. Pre-Commit Hooks (Optional)

After `git init`:

```bash
npm install
npx husky init
```

Add to `.husky/pre-commit`:

```sh
npm run test
```

## 7. Project Structure

```
/moments          — Astro site (Cloudflare Pages)
/moments-admin    — React admin SPA
/docs             — Product spec, setup
```

## 8. CI/CD (GitHub Actions)

The monorepo has path-based deployments:

- **moments** deploys when `moments/**`, `package.json`, or `package-lock.json` change
- **moments-admin** deploys when `moments-admin/**`, `moments/db/**`, or root package files change

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — API token with Workers/Pages edit and D1 edit
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID

## 9. Key Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Astro dev server |
| `npm run dev:admin` | Start admin dev server |
| `npm run build` | Build all workspaces |
| `npm run db:migrate:local` | Apply migrations to local D1 |
| `npm run db:migrate:remote` | Apply migrations to remote D1 |
| `npm run test` | Run tests |
| `npm run deploy` | Deploy to Cloudflare |
