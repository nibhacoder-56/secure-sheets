# How to Run & Test Secure Sheets

## Prerequisites on your machine

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL client (optional)

## 1. Start infrastructure

```bash
cd secure-sheets
docker compose up -d
```

This starts:
- PostgreSQL on port `5432`
- Redis on port `6379`

## 2. Backend setup

```bash
cd backend
cp .env.example .env          # already done if you copied the project
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db execute --file prisma/rls_policies.sql   # apply RLS
npm run start:dev
```

You should see:
```
Secure Sheets API running on http://localhost:4000
```

## 3. Quick health check (the file you asked for)

Open a new terminal and run:

```bash
cd backend
./test-api.sh
```

Or manually:

```bash
curl http://localhost:4000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "secure-sheets-api",
  "timestamp": "...",
  "database": "ok",
  "version": "0.1.0"
}
```

## 4. Full smoke test flow

```bash
# Register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"TestPass123!","name":"Admin"}'

# Login (copy the accessToken)
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"TestPass123!"}'

# List organizations (replace TOKEN)
curl http://localhost:4000/api/organizations \
  -H "Authorization: Bearer TOKEN"
```

## 5. Test the Admin Permission feature

After you have a workbook + sheet IDs:

```bash
curl -X POST http://localhost:4000/api/permissions/grant \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "colleague@company.com",
    "sheetIds": ["SHEET_ID_HERE"],
    "permission": "EDITOR"
  }'
```

This is the core feature you requested:  
Admin grants access to a specific sheet by email (or phone).

## Current working endpoints

| Method | Endpoint                          | Auth? | Description                      |
|--------|-----------------------------------|-------|----------------------------------|
| GET    | /api/health                       | No    | Health + DB check                |
| POST   | /api/auth/register                | No    | Register user                    |
| POST   | /api/auth/login                   | No    | Login                            |
| POST   | /api/auth/refresh                 | No    | Refresh tokens                   |
| POST   | /api/auth/logout                  | Yes   | Logout                           |
| GET    | /api/organizations                | Yes   | List orgs                        |
| POST   | /api/organizations                | Yes   | Create org (platform admin)      |
| POST   | /api/organizations/:id/members    | Yes   | Add member by email/phone        |
| POST   | /api/organizations/:orgId/workbooks | Yes | Create workbook + first sheet  |
| GET    | /api/organizations/:orgId/workbooks | Yes | List workbooks                 |
| POST   | /api/workbooks/:id/sheets         | Yes   | Create new sheet                 |
| POST   | /api/permissions/grant            | Yes   | **Grant access by email/phone**  |
| POST   | /api/permissions/revoke           | Yes   | Revoke access                    |
| GET    | /api/permissions/workbooks/:id    | Yes   | List who has access              |

## What is still missing (next)

- Audit log query API
- WebSocket + Yjs real-time collaboration
- Frontend (Next.js)
- Spreadsheet UI (Univer / FortuneSheet)
- 2FA / magic link / phone OTP full flow

The backend core (auth + multi-tenant orgs + workbooks/sheets + admin permission granting) is ready to test.

---

## Spreadsheet UI (new)

1. Start backend + frontend
2. Login at http://localhost:3000
3. Create a workbook from the dashboard (or via API)
4. Click a sheet name (e.g. "Sheet1 →")
5. You will open the collaborative grid at `/sheet/[sheetId]`

### What works in the grid right now
- Click any cell to edit
- Enter / Tab to move
- Changes are broadcast in real-time to other users in the same sheet
- Remote cursors show who is editing which cell
- "History" button opens the audit panel for that sheet
- If an admin revokes your access, you are force-disconnected

### Open the same sheet in two browser windows
- Login as two different users (or same user in two windows)
- Join the same sheet
- Edit cells → you should see live updates and cursors
