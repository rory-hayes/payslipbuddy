# PaySlip Buddy (V1)

PaySlip Buddy V1 is a **Payslip OS** for UK/IE users:

- Upload one monthly payslip (PDF/image path in this bootstrap)
- AI extraction with schema validation (`UK_v1` / `IE_v1`)
- Editable review before confirm
- MoM insights including line-item change detection
- Annual dashboard + premium exports (PDF/XLSX)
- Household sharing (Owner + Member, Pro-gated)
- Stripe-backed billing gates (Free / Plus / Pro)
- Monthly reminder preference API (default on, opt-out)

## Scope alignment

Implemented for V1:

- Payslip ingestion + extraction review + confirm
- Multi-employer logic with plan gating
- MoM deltas and new/irregular line item detection
- Annual report generation and export pipeline
- Household invites with owner-only management
- Server-side entitlements and usage meter

Deferred to V1.5 (explicitly gated/deferred in API):

- Budget board
- Bank CSV import
- Numeric TaxBack estimation
- Bulk upload

## Tech stack

- Next.js App Router + TypeScript
- Supabase (schema + RLS migrations included)
- Stripe (checkout + webhook handlers, mock mode fallback)
- Zod schemas for strict validation
- XLSX export via `exceljs`

## Quick start

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Copy env file:

```bash
cp .env.example .env.local
```

4. Run dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Environment variables

Required for full integrations:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PLUS_MONTHLY`
- `STRIPE_PRICE_PLUS_ANNUAL`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_ANNUAL`
- `APP_BASE_URL`

If Stripe keys are missing, billing routes run in **mock mode** so flows remain testable.
Extraction currently runs in a deterministic simulated mode for local bootstrap; swap in your vision/OCR provider in `src/lib/services/payslip-extraction.ts`.
Runtime state persists locally in `.data/payslip-buddy-state.json` (disable with `PAYSLIP_BUDDY_PERSIST_STATE=false`).

## API coverage

Core endpoints from spec are implemented:

- `POST /api/payslips/upload`
- `POST /api/payslips/:id/extract`
- `POST /api/payslips/:id/confirm`
- `GET /api/payslips`
- `GET|POST /api/employers`
- `GET /api/analytics/mom`
- `GET /api/reports/annual`
- `POST /api/reports/annual/export`
- `POST /api/household/invite`
- `POST /api/household/accept`
- `POST /api/billing/checkout`
- `POST /api/billing/webhook`

Additional support endpoints:

- `POST /api/onboarding/profile`
- `GET /api/dashboard/overview`
- `GET /api/household/summary`
- `GET|POST /api/reminders/preference`
- `POST /api/reminders/run`
- `GET /api/billing/summary`
- `GET /api/files/:id/download` (signed URL / proxy pattern)
- `DELETE /api/files/:id` (manual delete)
- `POST /api/files/retention/run` (retention cleanup)
- `GET /api/jobs` (queue observability)
- `GET /api/audit/logs` (user-scoped audit trail)

Deferred endpoints return `501`:

- `POST /api/bank/import`
- `GET|POST /api/budget/expenses`
- `GET /api/taxback`

## Supabase setup

Migrations:

- `supabase/migrations/0001_core.sql`
- `supabase/migrations/0002_seed_taxback_catalog.sql`

Apply with Supabase CLI in your project.

## Testing

```bash
npm test
```

Current tests focus on service-layer logic and can be expanded to API integration/E2E.
