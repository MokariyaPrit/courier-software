# Courier ERP

Single-company courier ERP (modular monolith) with:

- **Web:** Next.js App Router + PrimeReact + TanStack Query + Axios
- **API:** NestJS REST + TypeORM + PostgreSQL
- **Auth:** HTTP-only cookie JWT (access + refresh)
- **Roles:** `ADMIN` and `BRANCH_MANAGER` only

## Structure

```text
apps/api          NestJS API (:3001)
apps/web          Next.js UI (:3000)
packages/shared   Shared enums/types
docker-compose.yml PostgreSQL 16
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Postgres) **or** a local PostgreSQL matching `.env`

## Setup

```bash
pnpm install
pnpm --filter @courier/shared build

# Configure API env (defaults already present for local)
cp apps/api/.env.example apps/api/.env

# Start database (pick one):
# A) Docker Postgres
pnpm db:up
# B) No Docker — embedded Postgres (leave terminal open)
pnpm db:embedded

# Seed Admin + Branch Manager + sample branches
pnpm seed

# Run API + Web
pnpm dev
```


- Web: http://localhost:3000
- API: http://localhost:3001/api/v1/health

### Seed logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@courier.local` | `Admin@12345` |
| Branch Manager | `manager@courier.local` | `Manager@12345` |

## API conventions

- Base path: `/api/v1`
- Success envelope: `{ data, meta? }`
- Error envelope: `{ error: { message, code?, details? } }`
- Cookies: `access_token`, `refresh_token` (HTTP-only)

## MVP modules

- Masters: branches, customers, pincodes
- Bookings / AWB generation
- Tracking timeline + status transitions
- Delivery OFD / POD (Branch Manager)
- Light invoicing
- Admin user management (fixed roles)
