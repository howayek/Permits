# GovStack — AI Workflow Instructions

This file enables an LLM to understand, build, run, and test the GovStack project.

## Project Overview

GovStack is a digital permit application platform for Lebanese municipalities. Citizens submit permit applications with documents online; government staff review, approve/reject, and issue verifiable permits with QR codes. Built as a course project for Georgia Tech CS 4365/6365 (Introduction to Enterprise Computing), Spring 2026.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript, Vite 5, Tailwind CSS 3, shadcn/ui (Radix primitives) |
| Routing | react-router-dom v6 |
| Data fetching | TanStack React Query v5 |
| Forms | react-hook-form + zod |
| Backend | Supabase (Postgres + RLS, Auth, Storage, Edge Functions) |
| PDF/QR | pdf-lib, qrcode |
| Icons | lucide-react |

## Repository Structure

```
├── src/
│   ├── main.tsx                  # App entry point (routing, providers)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives + Header, ProtectedRoute
│   │   ├── AppErrorBoundary.tsx
│   │   ├── GeneratePermitButton.tsx
│   │   ├── RequestInfoModal.tsx
│   │   └── RequestInfoModalWrapper.tsx
│   ├── hooks/                    # use-mobile, use-toast
│   ├── integrations/supabase/    # Generated Supabase types + alternate client
│   ├── lib/
│   │   ├── auth.tsx              # AuthProvider + useAuth hook (session, roles)
│   │   ├── constants.ts          # DB enums, allowed MIME types, size limits
│   │   ├── db.ts                 # createApplication helper
│   │   ├── PermitGenerationService.ts  # Client-side PDF + QR generation
│   │   ├── supabase.ts           # Supabase client (primary)
│   │   └── utils.ts              # cn(), formatFieldLabel()
│   └── pages/
│       ├── Index.tsx             # Landing page
│       ├── AuthLogin.tsx         # Sign in / sign up with role selection
│       ├── Dashboard.tsx         # Citizen or Developer dashboard
│       ├── ApplyIndex.tsx        # Municipality selection
│       ├── ApplyPermitTypes.tsx  # Permit types for a municipality
│       ├── ApplyStepper.tsx      # Application form + document upload
│       ├── OwnedPermits.tsx      # My Permits (tabs, QR, decisions, PDF)
│       ├── ProvideInfo.tsx       # Supplemental info for CLARIFICATION_REQUESTED apps
│       ├── GovDashboard.tsx      # Government review queue + approve/reject
│       ├── GovDatabase.tsx       # Government database view
│       ├── VerifyPermit.tsx      # Public permit verification (QR landing)
│       └── NotFound.tsx          # 404 catch-all
├── supabase/
│   ├── functions/generate-permit/  # Edge Function for server-side PDF generation
│   └── migrations/                 # Historical SQL migrations
├── docs/
│   ├── checkpoint1/              # Checkpoint 1 report + architecture + stakeholder notes
│   └── checkpoint2/              # Checkpoint 2 report
├── env.example                   # Template for .env.local
├── package.json
├── vite.config.ts                # Vite config (port 8080, @ alias)
├── tailwind.config.ts
└── tsconfig.json
```

## Prerequisites

- Node.js 18+ and npm
- A Supabase project with the correct schema (see Database Schema below)

## Build & Run

```bash
# Install dependencies
npm install

# Copy env template and fill in Supabase credentials
cp env.example .env.local
# Edit .env.local: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Start dev server (default: http://localhost:8080)
npm run dev

# Type-check
npx tsc --noEmit

# Lint
npm run lint

# Production build
npm run build
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (e.g., `https://xxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_SUPABASE_FUNCTIONS_URL` | No | Override for local Edge Functions URL |

Get these from Supabase Dashboard → Project Settings → API.

## Database Schema

The Supabase Postgres database uses these tables:

| Table | Purpose |
|-------|---------|
| `municipalities` | Municipality names and contact info |
| `permit_types` | Permit type definitions per municipality (name, slug, form_schema, required_docs) |
| `applications` | Submitted applications (permit_type_id, user_email, status, data JSONB) |
| `documents` | Uploaded document metadata (application_id, filename, s3_key, sha256, mime, size) |
| `decisions` | Review decisions (application_id, decision, issued_by, s3_key, sha256) |
| `audit_log` | Append-only audit trail (application_id, action, meta JSONB) |
| `permits` | Issued permits (permit_id, application_id, pdf_s3_key, qr_url, status) |
| `user_roles` | User role assignments (user_id, role as app_role enum) |
| `info_requests` | Government info requests to applicants |
| `info_request_responses` | Applicant responses to info requests |

**Key enums:**
- `app_status`: SUBMITTED, ROUTED, CLARIFICATION_REQUESTED, DECISION_UPLOADED, CLOSED
- `permit_status`: PENDING_GENERATION, GENERATED, REVOKED
- `app_role`: ADMIN, DEVELOPER, CLERK, GOVERNMENT, CITIZEN

**Storage buckets:** `documents` (file uploads), `permits` (generated PDFs)

## Authentication & Roles

- Supabase Auth handles email/password sign-up and sign-in
- On sign-up, users select a role (Citizen or Government) which is stored in `raw_user_meta_data`
- A database trigger (`on_auth_user_created`) auto-inserts a `user_roles` row
- `useAuth()` hook exposes: `user`, `session`, `roles`, `isDeveloper`, `loading`
- `ProtectedRoute` component guards routes by auth state and optionally by role

## Route Map

| Route | Auth | Roles | Component |
|-------|------|-------|-----------|
| `/` | Public | — | Landing page |
| `/auth/login` | Public | — | Sign in / sign up |
| `/apply` | Public | — | Browse municipalities |
| `/apply/:municipalityId` | Public | — | Browse permit types |
| `/apply/:municipalityId/:permitType` | Required | — | Application form |
| `/dashboard` | Required | — | User dashboard |
| `/my-permits` | Required | — | My applications & permits |
| `/applications/:id/provide-info` | Required | — | Provide supplemental info |
| `/gov` | Required | government, developer, admin, clerk | Government review queue |
| `/gov/database` | Required | government, developer, admin, clerk | Government database |
| `/permits/:permitId` | Public | — | Permit verification |

## Testing Approach

**Functional tests (manual):**
1. Sign up as Citizen → verify role assignment in `user_roles`
2. Browse municipalities → select permit type → fill form → attach document → submit
3. Verify: application row in `applications`, document in Storage bucket, `documents` row has s3_key + sha256, `audit_log` entries exist
4. Sign in as Government → verify gov dashboard loads → approve/reject applications
5. Verify permit generation, QR code, and verification page

**Security tests:**
- Attempt to access `/gov` as citizen → should redirect to `/dashboard`
- Attempt to access `/dashboard` while logged out → should redirect to `/auth/login`
- Upload a file with disallowed MIME type → should be rejected client-side
- Upload a file over 10 MB → should be rejected client-side

## Key Design Decisions

- **Client-side SHA-256 hashing**: Documents are hashed before upload using Web Crypto API for integrity verification
- **Status enums in DB**: Application workflow uses Postgres enums to enforce valid state transitions
- **JSONB data column**: Applications store flexible form data in a JSONB column to support multiple permit types
- **Role-based UI**: Header and routes adapt based on user roles fetched from `user_roles` table
- **Audit logging**: Every significant action (submit, route, decision, upload) creates an `audit_log` entry
