# Secure Sheets – System Architecture

## 1. High-Level Overview

```
┌─────────────────┐     HTTPS / WSS      ┌──────────────────────┐
│   Next.js 15    │ ◄──────────────────► │      NestJS API       │
│   (Frontend)    │                      │  + WebSocket Gateway │
└─────────────────┘                      └──────────┬───────────┘
                                                    │
                          ┌─────────────────────────┼─────────────────────────┐
                          │                         │                         │
                          ▼                         ▼                         ▼
                   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
                   │ PostgreSQL  │          │    Redis    │          │  S3 / MinIO │
                   │ + RLS       │          │ (sessions,  │          │  (files)    │
                   │             │          │  rate limit,│          │             │
                   │             │          │  presence,  │          │             │
                   │             │          │  BullMQ)    │          │             │
                   └─────────────┘          └─────────────┘          └─────────────┘
```

## 2. Multi-Tenancy Strategy (Defense in Depth)

1. **Application Layer**
   - Every request carries a verified JWT.
   - NestJS Guards extract `userId` and load the list of `organizationIds` the user belongs to.
   - All queries are automatically scoped by `organizationId`.

2. **Database Layer (PostgreSQL Row Level Security)**
   - RLS is enabled + forced on every tenant table.
   - On every request we execute:
     ```sql
     SET LOCAL app.current_user_id = '...';
     SET LOCAL app.current_org_ids = 'org1,org2';
     SET LOCAL app.is_platform_admin = 'false';
     SET LOCAL app.is_org_admin = 'true';
     ```
   - Even if a developer forgets a `WHERE organizationId = ...` filter, the database still blocks the query.

3. **Result**
   - Cross-tenant data leakage is extremely difficult.
   - Platform Super Admin can bypass via a special flag (used only in admin panel).

## 3. Authentication Flow

1. User logs in (email/password, magic link, or phone OTP).
2. Backend issues:
   - Short-lived Access Token (15 min) – JWT containing `sub`, `email`, `globalRole`
   - Long-lived Refresh Token (7–30 days) – stored hashed in `sessions` table + Redis
3. Frontend stores Access Token in memory (or httpOnly cookie) and Refresh Token in httpOnly cookie.
4. On every API call the Access Token is sent.
5. When Access Token expires, frontend calls `/auth/refresh`.
6. Admin can revoke any session → token becomes invalid immediately.

## 4. Authorization Model

| Level            | Who can manage                         | Granularity              |
|------------------|----------------------------------------|--------------------------|
| Platform         | Platform Super Admin                   | All organizations        |
| Organization     | Org Admin                              | Members + all workbooks  |
| Workbook         | Org Admin or FULL_ACCESS holder        | Entire workbook          |
| Sheet            | Org Admin or FULL_ACCESS holder        | Single sheet             |

Permission values: `VIEWER` | `COMMENTER` | `EDITOR` | `FULL_ACCESS`

## 5. Real-time Collaboration

- Each Sheet has a Yjs document.
- Clients connect via WebSocket to NestJS Gateway.
- Gateway authenticates the socket (JWT) and checks sheet permission.
- Yjs updates are broadcast only to users who have at least VIEWER permission on that sheet.
- Periodic snapshots of Yjs state can be stored in `sheets.yjsState` or external object storage.

## 6. Audit Trail

- Every mutating action writes an immutable row to `audit_logs`.
- Cell-level changes also write to `cell_history` for fine-grained “who changed A1” queries.
- No UPDATE or DELETE is allowed on these tables from normal application roles.

## 7. Key Security Controls

- Helmet + strict CSP + CORS
- Rate limiting (Redis) on auth and sensitive endpoints
- Brute-force protection
- Input validation with Zod on every DTO
- Parameterized queries only (Prisma)
- Instant session revocation
- Force WebSocket disconnect on permission revoke
- Secrets only via environment variables

## 8. Project Structure (Backend)

```
backend/
├── prisma/
│   ├── schema.prisma
│   └── rls_policies.sql
├── src/
│   ├── auth/
│   ├── organizations/
│   ├── workbooks/
│   ├── sheets/
│   ├── permissions/
│   ├── audit/
│   ├── websocket/
│   ├── common/          # guards, interceptors, decorators, filters
│   ├── prisma/
│   └── main.ts
└── docker-compose.yml
```
