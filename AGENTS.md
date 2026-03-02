# AGENTS.md

## Cursor Cloud specific instructions

### Overview

WhatSend is a multi-user web app for bulk WhatsApp messaging. It consists of two services:

| Service | Directory | Port | Command |
|---------|-----------|------|---------|
| Backend (Express API) | `backend/` | 3001 | `npm run dev` |
| Frontend (React/Vite) | `frontend/` | 5173 | `npm run dev` |

Infrastructure (PostgreSQL on port 15432, Redis on port 16379) is managed via `docker compose up -d` from the repo root.

### Important caveats

- **Vite proxy mismatch**: `frontend/vite.config.js` proxies `/api` to port 4100, but the backend runs on port 3001. To work around this without modifying code, create `frontend/.env` with `VITE_API_URL=http://localhost:3001` so Axios calls go directly to the backend.
- **Backend .env**: Copy `backend/.env.example` to `backend/.env` before first run. Default credentials for the seed admin are `admin@whatsend.local` / `ChangeMe123!`.
- **Prisma migrations**: Run `npx prisma migrate dev` from `backend/` after pulling changes that modify `backend/src/prisma/schema.prisma`.
- **No ESLint or linter** is configured in this project. No pre-commit hooks either.
- **No automated test suite** exists in this project.
- **Docker must be running** before starting the backend — it connects to PostgreSQL on startup and exits with code 1 if unavailable. Redis is semi-optional (campaign sending won't work without it, but the server starts).

### Running services

See `README.md` for the standard dev setup commands. Quick reference:

```bash
# Infrastructure
docker compose up -d

# Backend (from backend/)
npm run dev

# Frontend (from frontend/)
npm run dev
```

### Build

```bash
# Frontend production build
cd frontend && npx vite build
```
