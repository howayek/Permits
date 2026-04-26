# GovStack — Presentation Slides

**Target length:** 12-15 minute video
**Format:** Each `---` is a slide break. Bullets are speaker bullets; speaker notes follow each slide.
**Recommended export:** Paste into Google Slides, Keynote, or PowerPoint. Or render with [Marp](https://marp.app/) (`npx @marp-team/marp-cli@latest Presentation_Slides.md`).

---

## Slide 1 — Title (≈30s)

# GovStack
### A Workflow-Configurable Digital Permit Platform with LLM-Assisted Document Verification

**Mark Howayek**
CS 4365/6365 — Introduction to Enterprise Computing — Spring 2026
Georgia Institute of Technology

GitHub: github.com/howayek/Permits

**Speaker notes:** Hi, I'm Mark Howayek. This is GovStack, my final project for CS 6365. It's a digital permit platform with LLM-assisted document verification, built on React, TypeScript, and Supabase. Over the next 12-15 minutes I'll walk you through the problem, the architecture, the security model, the AI integration, and a live demo.

---

## Slide 2 — The Problem (≈45s)

### Permits today are paper-first and trust-poor

- Citizens make repeated in-person trips. Multiple weeks per application.
- Reviewers handle paper manually. Decisions are inconsistent.
- No audit trail of who accessed what, when.
- No way to verify a permit later — call the office and hope.
- Each permit type is hard-coded as a separate system.

**Stakeholder pain points (from W5-W6 discovery):**
1. Time cost to citizens (multiple visits, missing documents)
2. Time cost to reviewers (manual paper handling)
3. Trust deficit (no third-party verification)
4. Platform inflexibility (each permit type a separate system)

**Speaker notes:** I started by talking to people who had recently applied for permits and one staff member familiar with the back office. The problems were consistent. Citizens lose hours to in-person trips. Reviewers waste time on paper handling. Once a permit is issued, there's no way to verify it later. And every new permit type is a new system. This is a workflow problem, not a forms problem.

---

## Slide 3 — End-of-Semester Deliverables (≈45s)

### Seven deliverables, all shipped

| # | Deliverable | Status |
|---|-------------|--------|
| D1 | Workflow-configurable permit types (Admin Console) | ✅ |
| D2 | Applicant Portal (submission + tracking) | ✅ |
| D3 | Reviewer Portal (queue + decisions + comments) | ✅ |
| D4 | Secure document handling (RBAC + RLS + integrity) | ✅ |
| D5 | Permit issuance + QR verification | ✅ |
| D6 | Enterprise architecture + scalability demonstration | ✅ |
| D7 | Documentation, demo, and test plan | ✅ |

**Plus (from mid-semester feedback):** LLM-assisted document classification + reviewer summaries.

**Speaker notes:** Seven deliverables defined at the start of the semester. All shipped. Plus the AI integration that I added in W13-W14 in response to mid-semester feedback recommending intelligent automation.

---

## Slide 4 — High-Level Architecture (≈90s)

### Four tiers, integrated platform

```
Browser (React + TypeScript + Vite)
   ├─ Citizen UI  ─────┐
   └─ Reviewer UI ─────┤
                       ▼
        Supabase (managed backend)
        ├─ Auth (JWT sessions, role at sign-up)
        ├─ Postgres (RLS on every table)
        ├─ Storage (auth-only bucket)
        └─ Edge Functions (Deno runtime)
              ├─ generate-permit  → PDF + QR
              └─ ai-assist  ────► OpenAI gpt-4o-mini

Public verification: /permits/:id  (anon RLS)
```

**Why this stack?**
- **Supabase** → integrated auth + Postgres + storage + functions, eliminates plumbing.
- **Postgres RLS** → authorization at the database, not just the UI.
- **Edge Functions** → server-side compute for PDF generation and AI calls. Secrets never reach the browser.

**Speaker notes:** The architecture is four tiers. The browser runs a React app with separate citizen and reviewer views. Everything else runs in Supabase: auth, Postgres with RLS on every table, a storage bucket for documents, and two Deno edge functions — one for generating permit PDFs with QR codes, the other for AI assistance. The public verification endpoint at /permits/:id reads through anon RLS and shows just enough info to verify a permit without exposing private documents.

---

## Slide 5 — Data Model (≈45s)

### Ten tables, three enums, JSONB where flexibility matters

| Table | Purpose |
|-------|---------|
| `user_roles` | Role assignments per user |
| `municipalities` | Municipalities served |
| `permit_types` | Definitions per municipality (`form_schema`, `required_docs`) |
| `applications` | Submitted apps with JSONB `data` (form fields, AI results) |
| `documents` | Upload metadata with `s3_key` + `sha256` |
| `decisions` | Approve/decline/request-info |
| `audit_log` | Append-only |
| `permits` | Issued permits with QR URL + PDF hash |
| `info_requests` / `info_request_responses` | Clarification workflow |

**Enums:**
`app_status` · `permit_status` · `app_role` (CITIZEN / GOVERNMENT / CLERK / ADMIN / DEVELOPER)

**Speaker notes:** Ten tables, three Postgres enums. Applications carry a flexible JSONB data column so one table backs many permit types. The audit log is append-only — never updated, never deleted. The hash columns on documents and permits enable integrity verification on download.

---

## Slide 6 — Security: Row-Level Security on Every Table (≈90s)

### Authorization at the database, not just the UI

```sql
CREATE FUNCTION has_role(p_role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = p_role
  );
$$;

CREATE POLICY "gov_read_all_applications"
ON applications FOR SELECT TO authenticated
USING (has_role('GOVERNMENT') OR has_role('ADMIN') OR has_role('CLERK'));
```

- **Single source of truth.** All policies use `has_role()` against the same `user_roles` table.
- **Defense in depth.** UI guards + DB-level RLS — even if the frontend is bypassed, RLS rejects the query.
- **Migrated.** Original boilerplate had inconsistent JWT-based and table-based authorization. Unified in W11.
- **Audited.** All 10 tables have RLS enabled. No anon INSERT anywhere.

**Speaker notes:** The authorization spine of the system is Postgres Row-Level Security. Every table has it enabled. Every policy uses a single helper function called has_role, which queries the user_roles table for the current user. This pattern is the industry standard for Supabase and it gives me a single source of truth — both the UI and the database check the same place. I did a comprehensive RLS audit in Week 11, removed dangerous anonymous insert policies, and migrated all the legacy JWT-based policies to use has_role.

---

## Slide 7 — Security: Document Integrity (≈45s)

### Tamper-evident on upload AND download

**On upload:**
1. Compute SHA-256 client-side using the Web Crypto API.
2. Store hash in `documents.sha256` (or `permits.pdf_sha256`).
3. Upload bytes to Storage with a deterministic key.

**On download (citizen OR government):**
1. Fetch the file from Storage.
2. Recompute SHA-256.
3. **Compare to the stored hash.**
4. Mismatch → block download with a clear warning.

This directly addresses the "document tampering after upload" threat.

**Speaker notes:** Document integrity is verified at both upload and download. Every uploaded file is hashed client-side using the Web Crypto API before storage. On download, we recompute the hash and compare. If they differ — for any reason, including a compromised storage layer — the download is blocked and the user sees a clear warning. This addresses the document tampering threat at the protocol level, not just the policy level.

---

## Slide 8 — Permit Issuance + Public Verification (≈45s)

### Tamper-evident, publicly verifiable artifacts

```
Government approves
        ↓
generate-permit Edge Function:
  ├─ Builds PDF with permit metadata
  ├─ Embeds QR code → /permits/PMT-2026-NNNNNN
  ├─ Computes pdf_sha256
  └─ Uploads + updates permits row

QR scan → Public verification page (no login)
  ├─ Status: GENERATED / REVOKED
  ├─ Permit type, issue date, municipality
  └─ Audit trail (sanitized)
```

- **Privacy-preserving.** Public page shows minimal fields, no documents.
- **Cryptographic.** PDF carries a hash; verification page reads from RLS-controlled `permits` row.
- **Anti-enumeration.** Permit IDs are non-sequential UUIDs.

**Speaker notes:** When a government reviewer approves an application, the generate-permit edge function produces a PDF, embeds a QR code, computes a hash, and updates the permits table. The QR resolves to a public page that anyone can scan — no login. That page reads through anonymous RLS policies, shows the status, type, and audit trail, but never exposes private documents.

---

## Slide 9 — AI Integration: Why and Where (≈60s)

### LLM-assisted document verification + reviewer summaries

**Why?**
Beyond CRUD: shift low-value work onto the system, keep humans in control of decisions.

**Two touchpoints:**

| Where | Action | What the LLM does |
|-------|--------|-------------------|
| Citizen upload form | `classify_document` | Vision-checks each file against the claimed doc type |
| Reviewer details modal | `review_summary` | Generates 3-5 bullet summary: completeness, validity, concerns |

**Both via one Edge Function (`ai-assist`)** — single secret, multiplexed by an `action` field.
**Model:** `gpt-4o-mini` (vision-capable, cheap: ~$0.005 per application end-to-end).

**Speaker notes:** The AI integration was added in response to mid-semester feedback. The design principle is: AI assists, humans decide. There are two touchpoints. On the citizen side, when they upload a file and label it "ID Card," the AI verifies the file actually looks like an ID card. On the reviewer side, the AI generates a 3-5 bullet point summary of the application's completeness. Both are implemented as actions inside a single Edge Function, so the OpenAI key is managed in one place.

---

## Slide 10 — AI Integration: Citizen Upload Flow (≈60s)

### AI verification BEFORE submission, not during

1. Citizen selects files. Standard MIME + size validation runs.
2. For each file, the citizen picks a document type from a dropdown of the permit's `required_docs`.
3. **As soon as a type is selected**, the file (base64) is sent to `ai-assist` → OpenAI vision.
4. Inline banner appears: ✓ AI Verified or ⚠ AI Warning with the AI's notes.
5. **Submit button is disabled** until either:
   - Every file has been verified and matches its claimed type, OR
   - The citizen explicitly checks an override box (with a clear acknowledgment).

**Earlier bug, now fixed:** verification used to happen during submit, so the user saw the warning for a fraction of a second before being navigated away. Now it happens upfront with a clear gate.

**Speaker notes:** The flow took some iteration to get right. The first version ran AI verification inside the submit handler, so the user saw the warning for a fraction of a second before being navigated to the confirmation page. That's worse than no AI at all. The fix was to run classification as soon as the citizen labels a file, show the result inline, and disable the submit button until things look right. There's an explicit override checkbox for cases where the AI is wrong — but the citizen has to consciously check it.

---

## Slide 11 — AI Integration: Reviewer Summary (≈45s)

### Cached classifications + structured prompt

The reviewer's details modal includes an "AI Review Summary" panel:

- Reviewer clicks "Generate Summary."
- Frontend invokes `ai-assist` with `action: "review_summary"`.
- Edge Function constructs a prompt including:
  - Permit type, municipality, applicant email, status
  - Form fields
  - All uploaded documents WITH cached AI classifications
  - The required-documents list (from `permit_types.required_docs`)
- AI returns 3-5 bullet points: **completeness · validity · concerns · recommended action.**
- Reviewer makes the final decision. Always.

Cost-wise: cached classifications mean we don't re-pay per modal open.

**Speaker notes:** The reviewer summary is structured — completeness, validity, concerns, recommended next action — and explicitly tells the model not to make a final decision. We pass the cached AI classifications from the citizen's upload step, so we're not paying OpenAI to re-classify every time a reviewer opens the modal. We also pass the required-documents list, so the AI can flag genuinely missing documents instead of guessing.

---

## Slide 12 — Engineering Challenges Resolved (≈60s)

### Five real bugs caught during integration testing

1. **Race condition in role-based UI.** Roles were per-component local state; users saw the wrong dashboard for a brief flash. Fixed by lifting roles into AuthProvider context with JWT fallback.
2. **Inconsistent authorization channels.** Boilerplate had JWT `app_metadata` and `user_roles` table both used for role checks, with no overlap. Unified to `has_role()` in W11.
3. **Status enum drift.** Several constants referred to non-existent enum values; UPDATEs silently failed. Constants rewritten to mirror real enum.
4. **Silent "Request Info" failure.** Modal set status to undefined value → citizen never saw the "Needs Info" badge. Fixed in W13.
5. **Action buttons always visible.** Reviewers could click Approve multiple times on the same row, creating duplicate decisions. Gated by status; toast feedback added.

**Lesson:** Fact-check every claim against runnable code or database state.

**Speaker notes:** During integration testing in Week 13 I caught five real bugs. The most subtle was the silent Request Info failure — the modal was setting status to a constant that evaluated to undefined after a rename, the database UPDATE silently failed, and the citizen never saw any change. The lesson is to fact-check every claim against actual runnable code or database state. The five-checkpoint structure of this course made that habit unavoidable.

---

## Slide 13 — Live Demo (≈4 min)

### What I'll show, in order

1. **Public landing page** at localhost:8080
2. **Sign up as Citizen** with role selection
3. **Browse municipalities → permit types → application form**
4. **Upload a "wrong" document** → AI flags it → submit blocked
5. **Override and submit** OR re-pick correct type
6. **Sign in as Government** → Review Queue → details modal → AI summary
7. **Approve** → toast notification → status updates
8. **Citizen downloads PDF** → integrity verified
9. **Scan QR code** (or paste `/permits/PMT-2026-...` in incognito) → public verification page
10. **Visit `/gov/admin`** → create a new permit type

**Speaker notes:** [Switch to live demo. Allow ~4 minutes. Speaker notes for the demo are in `Demo_Instructions.md`.]

---

## Slide 14 — Test Plan and Results (≈45s)

### Functional + security tests, all passing

**Functional (citizen + government + public):** all paths tested end-to-end.

**Security tests, all passing:**

| Test | Result |
|------|--------|
| Citizen accesses `/gov` via direct URL → redirected | ✅ |
| Citizen queries another user's app → empty (RLS) | ✅ |
| Anon attempts INSERT into applications → blocked | ✅ |
| Upload `.exe` or 50 MB file → blocked client-side | ✅ |
| Tampered storage object → integrity check blocks download | ✅ |
| `OPENAI_API_KEY` in client bundle? → No | ✅ |

**Performance (informal):** login <300ms · form load <250ms · AI classify ~2s · permit gen <2s · public verify <150ms.

**Speaker notes:** I ran a structured test plan — functional and security. All security tests pass. Direct URL access to government routes redirects citizens. Cross-user data queries return empty thanks to RLS. Storage tampering is caught by integrity verification. The OpenAI API key is confirmed absent from the client bundle.

---

## Slide 15 — Skill Learning (≈75s)

### Seven meta-skills developed

1. **Trend recognition.** Choosing convergent industry patterns (table-based RBAC) over expedient hacks.
2. **Defense in depth.** Threat → trace through every layer → confirm each layer responds.
3. **Iterative scope management.** Absorbing mid-semester feedback (AI integration) without delaying milestones.
4. **Facts vs. fiction.** Verifying every claim against runnable code; documenting known limitations honestly.
5. **Cyber-physical gap.** Replacing in-person verification with cryptographic verification.
6. **Reading reference docs.** Combining Postgres RLS, Supabase Edge Functions, and OpenAI Chat Completions into a coherent system.
7. **Visual communication.** Architecture diagrams that fit on a page and load-bear for understanding.

**Speaker notes:** Seven meta-skills developed across the semester. The most important is trend recognition — choosing convergent industry patterns over expedient hacks. Defense in depth was second — treating security as a property of every layer, not a feature added at the end. And third was iterative scope management — when the professor's feedback recommended AI integration mid-semester, I didn't defer to "future work." I absorbed it and shipped a real implementation in two weeks without delaying anything else.

---

## Slide 16 — Future Work + Conclusion (≈45s)

### What's next, what I'd build with another semester

**Production-readiness gaps:**
- Multi-tenant scoping (gov users → specific municipalities)
- Email notifications via Resend
- Signed URLs for short-lived document access
- Form-schema-driven application form (form_schema column already in DB)
- Multi-stage review workflows
- OCR + structured data extraction (beyond classification)
- Production observability (Sentry, structured logs)

**Conclusion:**
GovStack is a working, deployable platform that goes beyond CRUD: configurable permit types, defense-in-depth security, tamper-evident permits, and LLM-assisted workflows — all in one semester.

**Thank you.** Repo: github.com/howayek/Permits

**Speaker notes:** Future work is mostly about production-readiness — multi-tenant scoping, email notifications, signed URLs, and structured OCR rather than just classification. But the core platform is working today. Configurable permit types, defense in depth, tamper-evident permits, and LLM-assisted workflows. All in one semester. Thank you.

---

## Total time estimate

| Slide | Time |
|-------|------|
| 1 — Title | 0:30 |
| 2 — Problem | 0:45 |
| 3 — Deliverables | 0:45 |
| 4 — Architecture | 1:30 |
| 5 — Data model | 0:45 |
| 6 — RLS | 1:30 |
| 7 — Integrity | 0:45 |
| 8 — Permits + QR | 0:45 |
| 9 — AI: why | 1:00 |
| 10 — AI: citizen | 1:00 |
| 11 — AI: reviewer | 0:45 |
| 12 — Bugs | 1:00 |
| 13 — Demo | 4:00 |
| 14 — Tests | 0:45 |
| 15 — Skills | 1:15 |
| 16 — Conclusion | 0:45 |
| **Total** | **≈18 min** |

Trim by 3-5 minutes by tightening: slide 4 (architecture talk-through), slide 6 (RLS code reading), and the demo (skip the admin page if running long).

To hit 12 min: cut slides 5, 8, and 12; keep the rest tight. To hit 15 min: as listed above with the 3-min trim.
