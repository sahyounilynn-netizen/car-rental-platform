# Car Rental Platform

Multi-tenant car rental platform (SuperAdmin / Shop Admins / Users). Express + TypeScript + Prisma + PostgreSQL backend, React + TypeScript + Vite frontend.

## Prerequisites

- Node.js 20+ and npm (already set up)
- Docker Desktop, running (used to run PostgreSQL locally)

## First-time setup

```bash
# 1. Install all workspace dependencies (root, server, client)
npm install

# 2. Start PostgreSQL in Docker
npm run db:up

# 3. Copy env files and fill in secrets
cp server/.env.example server/.env
cp client/.env.example client/.env
# Generate JWT secrets, e.g.:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Generate the Prisma client, run migrations, and seed demo data
npm run prisma:generate --workspace server
npm run prisma:migrate --workspace server
npm run prisma:seed --workspace server
```

## Database

- `npm run prisma:studio --workspace server` — browse/edit data in a GUI.
- `npm run prisma:migrate --workspace server` — create + apply a new migration after editing `schema.prisma`.
- Seeded accounts (all share the password `Password123!`):
  - SuperAdmin: `superadmin@carrental.dev`
  - Admins: `admin.downtown@carrental.dev`, `admin.airport@carrental.dev` (each owns one demo shop)
  - Users: `user1@carrental.dev`, `user2@carrental.dev`, `user3@carrental.dev`
- The `Booking` table has DB-level `CHECK` constraints (valid date range, exactly one of `renterUserId`/walk-in fields, positive prices) layered on top of API-level zod validation — see `server/prisma/migrations/*/migration.sql`.

## Running in development

```bash
npm run dev:server   # http://localhost:4000
npm run dev:client   # http://localhost:5173
```

The client dev server proxies `/api/*` to the backend, so no CORS issues locally.

## Project layout

```
server/   Express + TypeScript API (feature modules under src/modules)
client/   React + TypeScript + Vite frontend (feature folders under src/features)
docker-compose.yml   Local PostgreSQL
```

This project is being built phase by phase per the build spec — see the current phase status in conversation history with the assistant that scaffolded it.
