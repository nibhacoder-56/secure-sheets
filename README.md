# Secure Sheets

A multi-tenant, collaborative spreadsheet platform with enterprise-grade security, admin access control by email/phone, and immutable audit history.

## What is built

### Backend (NestJS) – Ready
| Module | Status | Key features |
|--------|--------|--------------|
| Auth | Done | Register, Login, Refresh, Logout, JWT + rotating refresh tokens |
| Organizations | Done | Multi-tenant orgs, add members by email/phone |
| Workbooks & Sheets | Done | Create workbooks, multiple sheets |
| Permissions | Done | Admin grant/revoke access to sheets/workbooks by email or phone |
| Audit | Done | Query org logs, sheet history, cell history |
| WebSocket | Done | Real-time presence, Yjs update relay, force-leave on revoke |
| Health | Done | /api/health for monitoring |
| Security | Done | RLS policies, Helmet, validation, org isolation |

### Frontend (Next.js) – Scaffold ready
- Login / Register page
- Dashboard with organizations + workbooks list
- Auth store (Zustand + persist)
- API client ready for all backend endpoints

## Quick Start

### 1. Infrastructure
```bash
cd secure-sheets
docker compose up -d
```

### 2. Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db execute --file prisma/rls_policies.sql
npm run start:dev
```

API → http://localhost:4000/api

### 3. Test it works
```bash
cd backend
./test-api.sh
```

Or:
```bash
curl http://localhost:4000/api/health
```

### 4. Frontend
```bash
cd frontend
npm install
# create .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:4000/api
npm run dev
```

Frontend → http://localhost:3000

## Core Admin Feature (your original request)

Grant access to a sheet by email:

```bash
curl -X POST http://localhost:4000/api/permissions/grant \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "sheetIds": ["SHEET_ID"],
    "permission": "EDITOR"
  }'
```

Same works with phone number and multiple sheets/workbooks at once.

## Project structure

```
secure-sheets/
├── docker-compose.yml
├── HOW_TO_TEST.md
├── README.md
├── docs/ARCHITECTURE.md
├── backend/
│   ├── prisma/schema.prisma + rls_policies.sql
│   ├── src/
│   │   ├── auth/
│   │   ├── organizations/
│   │   ├── workbooks/
│   │   ├── permissions/
│   │   ├── audit/
│   │   ├── websocket/
│   │   └── ...
│   └── test-api.sh          ← use this to verify
└── frontend/
    └── src/app/             ← Login + Dashboard
```

## Security highlights

- PostgreSQL Row Level Security (RLS) as final defense
- Short-lived access tokens + rotating refresh tokens
- Instant permission revoke + WebSocket force-leave
- Immutable audit trail
- Strict organization isolation

## Still to build (future phases)

- Full spreadsheet UI (Univer / FortuneSheet + Yjs binding)
- Magic link / Phone OTP complete flow
- 2FA (TOTP)
- File import/export (xlsx/csv)
- Production hardening (rate limits, monitoring)
