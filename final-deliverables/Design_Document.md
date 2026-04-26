# GovStack — Design Document

This document is the technical reference for GovStack's architecture, data model, security, and key implementation decisions. It complements `Final_Report.md` (which is the narrative report) by serving as a quick-lookup reference for engineers maintaining or extending the system.

---

## 1. Architecture Overview

```
                  ┌─────────────────────────────────────────┐
                  │  Browser (React + TypeScript + Vite)    │
                  │   ┌──────────────┐  ┌──────────────┐    │
                  │   │  Citizen UI  │  │  Reviewer UI │    │
                  │   └──────────────┘  └──────────────┘    │
                  └────────────────┬────────────────────────┘
                                   │ HTTPS (TLS)
                                   ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                      Supabase                               │
   │                                                             │
   │   ┌──────────────┐    ┌──────────────────────────────────┐  │
   │   │ Auth         │    │  Postgres (RLS on every table)   │  │
   │   │ (JWT)        │───▶│  + has_role() helper             │  │
   │   └──────────────┘    └──────────────────────────────────┘  │
   │                                                             │
   │   ┌──────────────────────┐   ┌────────────────────────────┐ │
   │   │ Storage              │   │ Edge Functions (Deno)      │ │
   │   │ documents bucket     │   │ • generate-permit          │ │
   │   │ (auth-only RLS)      │   │ • ai-assist  ──► OpenAI    │ │
   │   └──────────────────────┘   └────────────────────────────┘ │
   └─────────────────────────────────────────────────────────────┘
```

**Tier responsibilities:**

- **Browser** — UI only. No business logic worth bypassing. Stores nothing sensitive client-side except an ephemeral JWT.
- **Auth** — issues JWTs after email/password verification. Triggers a Postgres function on first user creation to assign role.
- **Postgres** — single source of truth for data. RLS policies enforce all authorization. All sensitive logic runs here, in `SECURITY DEFINER` functions.
- **Storage** — opaque blob storage for files. Access controlled by storage policies on `storage.objects`.
- **Edge Functions** — server-side compute. Do CPU-heavy work (PDF generation) and call third-party APIs (OpenAI) without exposing secrets to the client.

---

## 2. Frontend Architecture

### 2.1 File Structure

```
src/
├── main.tsx                     # App entry point, providers, routing
├── components/
│   ├── ui/                      # shadcn/ui primitives + Header, ProtectedRoute
│   ├── AppErrorBoundary.tsx
│   ├── GeneratePermitButton.tsx
│   ├── RequestInfoModal.tsx
│   └── RequestInfoModalWrapper.tsx
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── integrations/
│   └── supabase/
│       ├── client.ts            # (Legacy alt client — see "Two Supabase clients")
│       └── types.ts             # Generated DB types (stale — regenerate when schema settles)
├── lib/
│   ├── auth.tsx                 # AuthProvider + useAuth hook (context-based)
│   ├── constants.ts             # DB enums, MIME whitelist, size limits, role labels
│   ├── db.ts                    # createApplication() helper
│   ├── PermitGenerationService.ts  # Client-side PDF (legacy fallback, has known column-mismatch bug)
│   ├── supabase.ts              # Primary Supabase client
│   ├── aiAssist.ts              # AI Edge Function client wrapper
│   ├── integrity.ts             # SHA-256 + verifyIntegrity utilities
│   └── utils.ts                 # cn(), formatFieldLabel()
└── pages/
    ├── Index.tsx                # Public landing
    ├── AuthLogin.tsx            # Sign in / sign up with role selection
    ├── Dashboard.tsx            # Role-aware dashboard (citizen / gov / developer)
    ├── ApplyIndex.tsx           # Browse municipalities
    ├── ApplyPermitTypes.tsx     # Browse permit types for a municipality
    ├── ApplyStepper.tsx         # Application form with AI verification
    ├── OwnedPermits.tsx         # Citizen's My Permits with integrity-checked downloads
    ├── ProvideInfo.tsx          # Citizen responds to clarification request
    ├── GovDashboard.tsx         # Government review queue with AI summary
    ├── GovDatabase.tsx          # Searchable applications database
    ├── GovAdmin.tsx             # Manage municipalities + permit types
    ├── VerifyPermit.tsx         # Public QR verification
    ├── DeveloperDashboard.tsx   # Developer-only diagnostic view
    └── NotFound.tsx             # 404 catch-all

supabase/
└── functions/
    ├── generate-permit/         # Server-side PDF + QR generation
    └── ai-assist/               # LLM document classification + reviewer summary
```

### 2.2 AuthProvider Design

**Pattern:** roles fetched once in the provider, stored in React Context, with JWT metadata as a fallback.

```tsx
// src/lib/auth.tsx (simplified)
const AuthCtx = createContext<{
  user, session, roles, isDeveloper, isGovernment, loading
}>({...});

function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dbRoles, setDbRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => { /* fetch session */ }, []);
  useEffect(() => { /* fetch dbRoles when user.id changes */ }, [userId]);

  const value = useMemo(() => {
    const roles = mergeRoles(dbRoles, session?.user);  // DB primary, JWT fallback
    return {
      session,
      user: session?.user,
      roles,
      isDeveloper: roles.includes("developer"),
      isGovernment: roles.includes("government") || roles.includes("admin") || roles.includes("clerk"),
      loading: authLoading || rolesLoading,
    };
  }, [...]);
}
```

**Why this pattern:**
- A single fetch per session, cached in context. Components don't trigger duplicate queries.
- `loading` is `true` until BOTH session and roles are resolved. This prevents the "wrong dashboard flash" bug where the citizen view appeared briefly before the government roles loaded.
- JWT fallback (`user.user_metadata.role`) provides instant role resolution even before the database query returns, fixing race conditions when RLS or network latency delays the query.

### 2.3 ProtectedRoute Design

```tsx
<ProtectedRoute requiredRoles={["government", "admin", "clerk"]}>
  <GovDashboard />
</ProtectedRoute>
```

- If `loading` → render loading state.
- If `!user` → redirect to `/auth/login` with the current location captured in `state.from`.
- If `requiredRoles` provided AND user's roles don't intersect → redirect to `/dashboard`.
- Otherwise render children.

### 2.4 Routes

| Path | Auth | Roles | Component |
|------|------|-------|-----------|
| `/` | Public | — | Index |
| `/auth/login` | Public | — | AuthLogin |
| `/apply` | Public | — | ApplyIndex |
| `/apply/:municipalityId` | Public | — | ApplyPermitTypes |
| `/apply/:municipalityId/:permitType` | Required | — | ApplyStepper |
| `/dashboard` | Required | — | Dashboard |
| `/my-permits` | Required | — | OwnedPermits |
| `/applications/:id/provide-info` | Required | — | ProvideInfo |
| `/gov` | Required | gov/dev/admin/clerk | GovDashboard |
| `/gov/database` | Required | gov/dev/admin/clerk | GovDatabase |
| `/gov/admin` | Required | gov/dev/admin | GovAdmin |
| `/permits/:permitId` | Public | — | VerifyPermit |
| `*` | Public | — | NotFound |

---

## 3. Backend (Supabase) Architecture

### 3.1 Database Schema

#### Tables (10)

```sql
-- Roles
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  role app_role NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now()
);

-- Configuration
CREATE TABLE municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  contact text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE permit_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid REFERENCES municipalities(id),
  name text NOT NULL,
  slug text NOT NULL,
  form_schema jsonb NOT NULL DEFAULT '{}',
  required_docs jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Workflow data
CREATE TABLE applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_type_id uuid REFERENCES permit_types(id),
  user_email text,
  status app_status NOT NULL DEFAULT 'SUBMITTED',
  data jsonb NOT NULL,                    -- form fields + ai_results
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id),
  filename text NOT NULL,
  s3_key text,
  mime text,
  size integer,
  sha256 text,
  uploaded_at timestamptz DEFAULT now()
);

CREATE TABLE decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id),
  s3_key text,
  sha256 text,
  issued_by text,
  issued_at timestamptz DEFAULT now(),
  decision text,                          -- APPROVED / DECLINED / REQUEST_INFO
  note jsonb DEFAULT '{}'
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id),
  action text NOT NULL,
  meta jsonb DEFAULT '{}',
  ip text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id text NOT NULL UNIQUE,
  application_id uuid REFERENCES applications(id) NOT NULL,
  municipality_id uuid REFERENCES municipalities(id) NOT NULL,
  permit_type_id uuid REFERENCES permit_types(id) NOT NULL,
  status permit_status NOT NULL DEFAULT 'PENDING_GENERATION',
  issued_at timestamptz,
  pdf_s3_key text,
  pdf_sha256 text,
  qr_url text,
  owner_name text,
  plot_address text,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoke_reason text,
  permit_pdf_document_id uuid REFERENCES documents(id)
);

CREATE TABLE info_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) NOT NULL,
  requested_by uuid REFERENCES auth.users(id),
  requested_fields jsonb DEFAULT '[]',
  message text,
  due_date timestamptz,
  requires_new_documents boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE info_request_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES info_requests(id) NOT NULL,
  application_id uuid REFERENCES applications(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  updated_fields jsonb DEFAULT '{}',
  note text,
  created_at timestamptz DEFAULT now()
);
```

#### Enums (3)

```sql
CREATE TYPE app_status AS ENUM (
  'SUBMITTED', 'ROUTED', 'CLARIFICATION_REQUESTED', 'DECISION_UPLOADED', 'CLOSED'
);

CREATE TYPE permit_status AS ENUM (
  'PENDING_GENERATION', 'GENERATED', 'REVOKED'
);

CREATE TYPE app_role AS ENUM (
  'ADMIN', 'DEVELOPER', 'CLERK', 'GOVERNMENT', 'CITIZEN'
);
```

### 3.2 SECURITY DEFINER Functions

```sql
-- Single source of truth for role checks. Used by all RLS policies.
CREATE OR REPLACE FUNCTION public.has_role(p_role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = p_role
  );
$$;

-- On user creation, auto-assigns role from signup metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
BEGIN
  BEGIN
    _role := UPPER(COALESCE(NEW.raw_user_meta_data->>'role', 'CITIZEN'))::app_role;
  EXCEPTION WHEN OTHERS THEN
    _role := 'CITIZEN'::app_role;
  END;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Status transition with audit logging.
CREATE OR REPLACE FUNCTION public.set_application_status(
  p_app_id uuid, p_status app_status, p_note jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE applications SET status = p_status, updated_at = now() WHERE id = p_app_id;
  INSERT INTO audit_log(application_id, action, meta)
  VALUES (p_app_id, 'STATUS_CHANGED',
          jsonb_build_object('to', p_status) || coalesce(p_note,'{}'::jsonb));
END;
$$;
```

### 3.3 Row-Level Security Policies

#### applications
| Policy | Cmd | Roles | Predicate |
|--------|-----|-------|-----------|
| `citizen insert app` | INSERT | authenticated | `lower(user_email) = lower(auth.email())` |
| `citizen read own apps` | SELECT | authenticated | `lower(user_email) = lower(auth.email())` |
| `gov_read_all_applications` | SELECT | authenticated | `has_role('GOVERNMENT' / 'ADMIN' / 'CLERK')` |
| `gov_update_applications` | UPDATE | authenticated | `has_role('GOVERNMENT' / 'ADMIN' / 'CLERK')` |
| `dev_read_all_applications` | SELECT | authenticated | `has_role('DEVELOPER')` |

#### decisions
| Policy | Cmd | Roles | Predicate |
|--------|-----|-------|-----------|
| `citizen_read_own_app_decisions` | SELECT | authenticated | EXISTS app where lower(user_email) = lower(auth.email()) |
| `Allow users to read and insert their own decisions` | ALL | authenticated | `issued_by = auth.email()` |
| `gov_read_all_decisions` | SELECT | authenticated | `has_role('GOVERNMENT' / 'ADMIN' / 'CLERK')` |
| `gov_insert_decisions` | INSERT | authenticated | `has_role('GOVERNMENT' / 'ADMIN' / 'CLERK')` |
| `gov_update_decisions` | UPDATE | authenticated | `has_role('GOVERNMENT' / 'ADMIN' / 'CLERK')` |

#### documents
| Policy | Cmd | Roles | Predicate |
|--------|-----|-------|-----------|
| `citizen insert docs` | INSERT | authenticated | EXISTS app where user owns the app |
| `citizen read own docs` | SELECT | authenticated | EXISTS app where user owns the app |
| `gov_read_all_documents` | SELECT | authenticated | `has_role('GOVERNMENT' / 'ADMIN' / 'CLERK')` |
| `dev_read_all_documents` | SELECT | authenticated | `has_role('DEVELOPER')` |
| `public read documents` | SELECT | anon | `true` (needed by public verify page) |

#### audit_log
| Policy | Cmd | Roles | Predicate |
|--------|-----|-------|-----------|
| `citizen insert audit` | INSERT | authenticated | EXISTS app where user owns the app |
| `citizen read own audit` | SELECT | authenticated | EXISTS app where user owns the app |
| `gov_read_all_audit` | SELECT | authenticated | `has_role('GOVERNMENT' / 'ADMIN' / 'CLERK')` |
| `gov_insert_audit` | INSERT | authenticated | `has_role('GOVERNMENT' / 'ADMIN' / 'CLERK')` |
| `dev_read_all_audit` | SELECT | authenticated | `has_role('DEVELOPER')` |
| `public read audit` | SELECT | anon | `true` (needed by public verify page) |

#### permits
| Policy | Cmd | Roles | Predicate |
|--------|-----|-------|-----------|
| `citizen_read_own_permits` | SELECT | authenticated | EXISTS app where user owns the app |
| `gov_read_all_permits` | SELECT | authenticated | `has_role('GOVERNMENT' / 'ADMIN' / 'CLERK')` |
| `gov_manage_permits` | ALL | authenticated | `has_role('GOVERNMENT' / 'ADMIN')` |
| `public_verify_permit` | SELECT | anon | `true` (needed for QR verification) |

#### municipalities
| Policy | Cmd | Roles | Predicate |
|--------|-----|-------|-----------|
| `public read municipalities` | SELECT | anon, authenticated | `true` |
| `gov_manage_municipalities` | ALL | authenticated | `has_role('GOVERNMENT' / 'ADMIN')` |

#### permit_types
| Policy | Cmd | Roles | Predicate |
|--------|-----|-------|-----------|
| `public read permit_types` | SELECT | anon, authenticated | `true` |
| `gov_manage_permit_types` | ALL | authenticated | `has_role('GOVERNMENT' / 'ADMIN')` |

#### user_roles
| Policy | Cmd | Roles | Predicate |
|--------|-----|-------|-----------|
| `authenticated_read_own_roles` | SELECT | authenticated | `user_id = auth.uid()` |
| `select_own_roles` | SELECT | public | `user_id = auth.uid()` |
| `select_all_for_gov_admin` | SELECT | public | EXISTS user_roles where role IN (GOVERNMENT, ADMIN) |
| `insert_admin_any_role` | INSERT | public | EXISTS user_roles where role = ADMIN |
| `delete_admin` | DELETE | public | EXISTS user_roles where role = ADMIN |

#### info_requests, info_request_responses
| Policy | Cmd | Roles | Predicate |
|--------|-----|-------|-----------|
| Various | INSERT/SELECT | public | Custom: gov can create; applicant or gov can read |

#### storage.objects (documents bucket)
| Policy | Cmd | Roles |
|--------|-----|-------|
| `allow authenticated uploads` | INSERT | authenticated |
| `allow authenticated reads` | SELECT | authenticated |

---

## 4. Edge Functions

### 4.1 generate-permit

**Inputs:** `{ permitId: "PMT-2026-NNNNNN" }`
**Outputs:** `{ ok: true, permit_id, pdf_s3_key, pdf_sha256, qr_url, issued_at }`

**Behavior:**
1. Loads the `permits` row for the given permit_id.
2. Builds a PDF via `pdf-lib` with permit metadata.
3. Generates a QR code pointing to `https://<frontend>/permits/<permit_id>` using the QR service URL.
4. Embeds the QR into the PDF.
5. Computes SHA-256 of the PDF bytes.
6. Uploads to `documents` bucket under `permits/<permit_id>.pdf`.
7. Updates the `permits` row: `status = 'GENERATED'`, `pdf_s3_key`, `pdf_sha256`, `qr_url`, `issued_at`.
8. Inserts a `documents` row referencing the PDF.
9. Inserts an `audit_log` entry: `PERMIT_GENERATED`.

**Required secrets:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — for DB + storage access.
- `PERMITS_BASE_URL` — used as the prefix for the QR code URL.
- `QR_SERVICE_URL` (optional) — defaults to `api.qrserver.com`.

### 4.2 ai-assist

**Inputs:** `{ action: "classify_document" | "review_summary", ... }`

**Action: classify_document**
- **Inputs:** `file_data_url` (base64 data URL), `expected_doc` (string), `filename` (optional)
- **Outputs:** `{ ok, match, actual_type, confidence, notes }`
- **Behavior:** Constructs a prompt for GPT-4o-mini asking whether the file matches the expected document type. For images, sends the data URL as a vision input. For PDFs, falls back to filename heuristic (vision API doesn't support PDF input directly).

**Action: review_summary**
- **Inputs:** `application: { permit_type_name, municipality_name, user_email, status, form_fields, documents[], required_docs[] }`
- **Outputs:** `{ ok, summary }`
- **Behavior:** Constructs a structured prompt with the application context and the per-document AI classifications. Asks GPT-4o-mini for a 3-5 bullet point summary covering completeness, document validity, concerns, and recommended next action — explicitly instructing the model not to make a final decision.

**Required secret:** `OPENAI_API_KEY`

**Model:** `gpt-4o-mini` (vision-capable, low cost, structured JSON output via `response_format: {type: "json_object"}`).

---

## 5. Storage Layout

**Bucket: `documents`** (single bucket for all files)

| Path | Contents |
|------|----------|
| `applications/{appId}/{timestamp}_{sanitized_filename}` | Citizen-uploaded documents |
| `decisions/{appId}/{timestamp}_{filename}` | Government-uploaded decision documents |
| `permits/PMT-{year}-{NNNNNN}.pdf` | Generated permit PDFs |
| `user_amendments/{appId}/{timestamp}_{sanitized_filename}` | Citizen-uploaded supplemental files in response to info requests |

**Bucket: `permits`** — exists but is unused. All files (including issued permit PDFs) are stored in `documents`.

---

## 6. Critical Implementation Patterns

### 6.1 Document upload flow with AI verification

```
ApplyStepper component
  ↓ user picks files (file input)
  ↓ user picks doc type from dropdown for each file (handleAssignmentChange)
  ↓ for each file: read as base64 → call ai-assist (classify_document)
  ↓ display banner per file (verified / warning)
  ↓ submit button gated until all verified or override checked
  ↓ on submit:
     ↓ createApplication() → INSERT into applications
     ↓ for each file: upload to storage + compute sha256 + insert documents row
     ↓ persist ai_results in applications.data.ai_results (JSONB)
     ↓ INSERT audit_log: DOCUMENTS_UPLOADED
     ↓ navigate home with success toast
```

### 6.2 Government decision flow

```
GovDashboard component → user clicks Approve/Decline
  ↓ decide(id, decision)
  ↓ call set_application_status RPC (or direct UPDATE as fallback)
  ↓ INSERT decisions row
  ↓ INSERT audit_log: DECISION
  ↓ refetch applications
  ↓ toast success
```

### 6.3 Information request flow

```
GovDashboard → click "Request info"
  ↓ open RequestInfoModal
  ↓ user picks fields, writes message, sets due date
  ↓ INSERT info_requests row
  ↓ UPDATE applications SET status = 'CLARIFICATION_REQUESTED'
  ↓ INSERT audit_log: REQUEST_INFO

Citizen sees "Needs Info" badge in My Permits → clicks "Provide Info"
  ↓ ProvideInfo component loads
  ↓ user uploads supplements + writes notes
  ↓ INSERT info_request_responses row
  ↓ UPDATE applications SET status = 'ROUTED' (re-enters review queue)
  ↓ INSERT audit_log: USER_SUPPLEMENT
```

### 6.4 Integrity verification

```
On upload (computeSHA256):
  arrayBuffer → crypto.subtle.digest("SHA-256", buf) → hex string
  store in documents.sha256 (or permits.pdf_sha256)

On download (verifyIntegrity):
  fetch storage object → compute SHA-256 → compare to stored hash
  if mismatch → block + warn user
  if match → toast "Integrity verified"
```

---

## 7. Known Issues / Future Refactors

- **Two Supabase clients.** `src/lib/supabase.ts` (primary) and `src/integrations/supabase/client.ts` (legacy alt). The primary handles all production paths; the alt is used by some scaffolded pages that aren't actively wired. Should consolidate.
- **Stale generated types.** `src/integrations/supabase/types.ts` only describes the original 3-table schema. Code uses untyped queries. Regenerate when schema settles.
- **`PermitGenerationService.ts` column mismatch.** Line 148 inserts `permit_type` (a string) into a column actually called `permit_type_id` (UUID). Will crash if invoked. Currently NOT invoked from any code path — `generate-permit` Edge Function is the production path. Either fix or delete.
- **No multi-tenant scoping.** All government users see all applications. Production deployment would scope by `municipality_id` on `user_roles`.
- **Email notifications not implemented.** Status changes are visible only inside the UI. Production would integrate Resend or similar via a `notify` Edge Function triggered by `audit_log` insertions.

---

## 8. Configuration Reference

### 8.1 Frontend environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_SUPABASE_FUNCTIONS_URL` | No | Override for local Edge Functions URL |

### 8.2 Edge Function secrets

| Secret | Used by | Description |
|--------|---------|-------------|
| `SUPABASE_URL` | generate-permit | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | generate-permit | Service role key for DB + storage writes |
| `PERMITS_BASE_URL` | generate-permit | Frontend URL prefix for QR codes |
| `QR_SERVICE_URL` | generate-permit | (optional) QR generator endpoint |
| `OPENAI_API_KEY` | ai-assist | OpenAI API key |

### 8.3 Default ports

| Service | Port |
|---------|------|
| Vite dev server | 8080 |
| Supabase local (if used) | 54321 |
