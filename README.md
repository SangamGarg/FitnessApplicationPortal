# MusclePlay Management Portal

Frontend portal for the MusclePlay fitness ecosystem, built with React, TypeScript, and Vite.
This repository contains portal code only: it does not implement backend services, database
schemas, migrations, or persistence. The frontend communicates with backend APIs through the
Vite `/api` proxy and never connects directly to PostgreSQL.

## Run locally

```sh
npm install
npm run dev
```

The Vite development server proxies `/api` to `http://localhost:8080`. Use `npm run build`
for TypeScript checks and a production build, or `npm run lint` for ESLint.

## Authentication and existing integrations

- Portal login, one-time account setup, session validation, refresh, and logout use
  `/api/portal/auth/*`.
- Admin developer account management uses `/api/portal/admin/developers`.
- The Developer Fitness Tools console calls the listed `/api/portal/dev/*` endpoints.
- Developer technical monitoring checks `/api/health`.
- API routes are integration contracts, not a substitute for backend authorization. The
  backend must enforce permissions and validate every request.

## Current implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Portal authentication | Integrated | Requires the separate backend and its configured session/auth routes. |
| Developer management | Integrated | Uses backend developer-management routes. |
| Developer fitness tools | Partially integrated | Existing console sends API requests; verify the target environment before using write, delete, email, or notification actions. |
| Developer overview and API reference | Partially integrated | Health check calls the configured API; analytics and endpoint catalog entries are not verified telemetry or a live API catalogue. |
| Admin overview and operations modules | UI preview | Uses explicit demo fixtures or unavailable states. No production analytics or operational records are presented as live data. |
| Cashout, MP Coins, store billing, referrals, and fraud review | Not operational | No financial, balance, payout, or automated enforcement action is implemented in this frontend preview. |
| Support, content publication, and other CMS modules | Not connected | Navigation and readiness screens are present; corresponding backend services are required. |

Admin demo actions are in-memory UI previews only. They do not issue backend requests, update balances,
approve payments, ban users, or create audit records. Any production implementation must rely on
server-side authorization, a reason for sensitive actions, ledger-backed financial changes, and
auditable backend workflows.

## Project organization

- `src/features/admin/` — Admin workspace and its portal-specific styles.
- `src/pages/` — Authentication, Developer workspace, developer account management, and API tools.
- `src/lib/` — Shared portal API/session helpers.
