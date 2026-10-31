# Courier ERP — How to use

Single-company courier ERP (modular monolith).

| Layer | Tech |
| --- | --- |
| Web | Next.js App Router + PrimeReact + TanStack Query + Axios |
| API | NestJS REST + TypeORM + PostgreSQL |
| Auth | HTTP-only cookie JWT (access + refresh) |
| Roles | `ADMIN` and `BRANCH_MANAGER` only |

---

## Where to start (URLs)

| What | URL |
| --- | --- |
| **App (open this in browser)** | http://localhost:3000 |
| **Login page** | http://localhost:3000/login |
| **Signup page** | http://localhost:3000/signup |
| **Dashboard (after login)** | http://localhost:3000/dashboard |
| **API health check** | http://localhost:3001/api/v1/health |
| **API base path** | http://localhost:3001/api/v1 |

### Data model (current)

- **No `branches` table** (removed completely)
- **`users`** — login (`email`, `password`, `role`, `isActive`)
- **`user_info`** — profile: fullName, phone, email, address, city, state, pincode, companyName, gstin, notes, isActive
- **Roles:** `ADMIN` (full) and `BRANCH_MANAGER` (ops; cannot manage Users/Pincodes)

After login you are redirected to the dashboard. Use the left sidebar for Bookings, Tracking, Delivery, Masters, Billing, and Users (Admin only).

---

## Prerequisites

- **Node.js 20+**
- **pnpm 9+** (`npm install -g pnpm`)
- Database (pick one):
  - **Option A:** Docker Desktop → `pnpm db:up`
  - **Option B:** No Docker → `pnpm db:embedded` (leave that terminal open)

---

## First-time setup (step by step)

Open a terminal in the project root (`courier software`):

```bash
# 1) Install dependencies
pnpm install

# 2) Build shared types
pnpm --filter @courier/shared build

# 3) API env file (skip if apps/api/.env already exists)
copy apps\api\.env.example apps\api\.env
# macOS/Linux: cp apps/api/.env.example apps/api/.env

# 4) Start database — keep this terminal open if using embedded
pnpm db:embedded
# OR with Docker:
# pnpm db:up
```

In a **second** terminal:

```bash
# 5) Create Admin + Branch Manager + sample branches
pnpm seed

# 6) Start API + Web together
pnpm dev
```

Then open: **http://localhost:3000**

### Useful scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | API (`:3001`) + Web (`:3000`) |
| `pnpm dev:api` | API only |
| `pnpm dev:web` | Web only |
| `pnpm db:embedded` | Local Postgres without Docker |
| `pnpm db:up` / `pnpm db:down` | Docker Postgres start/stop |
| `pnpm seed` | Seed users + sample branches |

---

## Login credentials (seed)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@courier.local` | `Admin@12345` |
| Branch Manager | `manager@courier.local` | `Manager@12345` |

- **Admin** — all branches, users, pincodes, billing, bookings, tracking.
- **Branch Manager** — bookings / tracking / delivery / customers for **their branch only**.

---

## How to use the app (daily flow)

1. Open http://localhost:3000 → sign in.
2. **Masters**
   - Admin: create **Branches**, **Pincodes**, **Customers**.
   - Branch Manager: view branches, manage **Customers**.
3. **Bookings** → **New booking** → create a consignment (AWB is generated, e.g. `CN260000001`).
4. **Tracking** → enter AWB → see timeline → update status  
   (`BOOKED` → `IN_TRANSIT` → `AT_HUB` → `OUT_FOR_DELIVERY` → `DELIVERED` / `FAILED_ATTEMPT` / `RTO`).
5. **Delivery** → list of Out-For-Delivery consignments → mark **Delivered** or **Failed**.
6. **Billing** → create a light invoice from selected consignments.
7. **Users** (Admin only) → create `ADMIN` or `BRANCH_MANAGER` users.

---

## Project structure

```text
courier-software/
  apps/
    api/                 # NestJS backend  → http://localhost:3001
    web/                 # Next.js UI      → http://localhost:3000
  packages/
    shared/              # Shared Role / status enums
  docker-compose.yml     # Optional Postgres 16
  README.md
```

---

## API notes

- Base path: `/api/v1`
- Success: `{ "data": ..., "meta": ...? }`
- Error: `{ "error": { "message": "...", "code": "..." } }`
- Auth cookies: `access_token`, `refresh_token` (HTTP-only; browser sends them automatically)

Quick health check:

```bash
curl http://localhost:3001/api/v1/health
```

Expected: `{"data":{"status":"ok","service":"courier-api"}}`

---

## Common errors — what they mean & how to fix

### App / runtime

| Problem | Why it happens | Fix |
| --- | --- | --- |
| Browser can’t open localhost:3000 | Web app not started | Run `pnpm dev` or `pnpm dev:web` |
| Login fails / Network Error | API not running, or DB down | Start `pnpm db:embedded` (or Docker), then `pnpm dev:api` |
| `ECONNREFUSED 5432` | Postgres not running | Run `pnpm db:embedded` or `pnpm db:up` |
| `Unauthorized` after refresh | Cookies cleared / API restarted | Log in again at `/login` |
| Blank page / redirect loop on `/dashboard` | Not logged in | Go to http://localhost:3000/login |
| Port already in use (`3000` / `3001` / `5432`) | Another process using the port | Stop the other app, or change `PORT` in `apps/api/.env` |
| Seed fails “database does not exist” | DB process not ready yet | Wait until embedded Postgres prints “ready”, then `pnpm seed` again |

### TypeScript / IDE (red underlines in entities)

These are **editor warnings**, not “the app is broken”.

#### 1) `Property 'id' has no initializer and is not definitely assigned in the constructor`

**Why:** TypeORM entities declare fields like `id: string` but never set them in a constructor. TypeORM assigns them when loading/saving from the DB. Strict TypeScript thinks that is invalid.

**Fix already in project:** `apps/api/tsconfig.json` has `"strictPropertyInitialization": false`.

If the warning still shows: Command Palette → **TypeScript: Restart TS Server**.

#### 2) `Option 'baseUrl' is deprecated ... TypeScript 7.0`

**Why:** Newer TypeScript versions deprecate `baseUrl`. The API tsconfig no longer needs it.

**Fix already in project:** `baseUrl` was removed from `apps/api/tsconfig.json` (no `ignoreDeprecations` — that option is only for TypeScript 6+). Restart TS Server if the IDE still shows the old warning.

---

## Environment files

- API: `apps/api/.env` (from `.env.example`) — DB, JWT secrets, seed passwords, `CORS_ORIGIN=http://localhost:3000`
- Web: `apps/web/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`

Do not commit real production secrets.

---

## Stop everything

- Stop `pnpm dev` / `pnpm db:embedded` with `Ctrl+C` in those terminals.
- Docker DB: `pnpm db:down`

---

## MVP modules included

- Masters: branches, customers, pincodes  
- Bookings + AWB generation + charge lines  
- Tracking timeline + status updates  
- Delivery OFD / POD  
- Light invoicing + customer statement API  
- Admin user management (`ADMIN` / `BRANCH_MANAGER` only)

**Not in MVP yet:** Redis, job queues, franchise portal, public tracking site, SMS/WhatsApp, native mobile apps.
