# Georgia Institute of Technology  
## CS 4365/6365: IEC — Spring 2026  
## Project Checkpoint 5 Report (Final)

**Group:**  
**Name:** Mark Howayek  
**Project:** GovStack  

---

## 1) Project Plan (Plan)

### 1.1 Point A — Current State / Context (Starting Point)
In many countries and municipalities, permit-related processes (construction permits, driver-related permits, business permits, etc.) are still paper-first and in-person. Applicants must visit offices, submit large sets of documents, and then repeatedly follow up. Reviewers handle documents manually, approvals are difficult to track, and there is limited auditability for who accessed or approved what. This creates delays, lost documents, inconsistent decisions, and opportunities for fraud.

From an enterprise computing perspective, this problem is not just about moving forms online. It is a larger workflow and service-delivery problem that affects citizens, government staff, and organizational trust. A weak permit process can increase wait times, create backlogs for staff, reduce transparency for applicants, and make it harder for agencies to scale services across different permit types. It also makes oversight harder because actions, decisions, and document access are not consistently recorded.

The system must handle:
- Sensitive PII documents (IDs, certificates, proof-of-address, etc.)
- Role-separated workflows (intake clerk vs. reviewer vs. supervisor)
- Auditability and non-repudiation (who approved what and when)
- Scalable storage and processing (many applicants + large files)
- Verification (a permit should be checkable as valid without reading the entire file set)

**Related Work / Existing Solutions (short)**  
Some governments use portals for specific services, but they are often:
- not workflow-configurable (hard-coded per service),
- weak in verification (no robust validity checks),
- limited in access control/audit logs,
- difficult to extend to new permit types quickly.

GovStack targets a reusable platform that can support multiple permit types through configuration, while enforcing enterprise-grade security and traceability. The broader goal is not only to digitize paperwork, but to reduce processing friction, improve accountability, and create a foundation that municipalities could reuse across many public services instead of rebuilding separate systems for each one.

Over the past 2 weeks, I validated these pain points with stakeholders. They want the workflow to stay partially manual at the beginning (human review), but they want fewer in-person visits, clearer required-document checklists, and a simple way to verify approvals. I also produced an initial architecture sketch and identified security requirements (roles, audit logs, and permit verification).

---

### 1.2 Point B — End-of-Semester Deliverables (What Will Be Shipped)

**Deliverable D1 — Workflow-configurable permit types (Admin Console)**
- Admin can create a permit type (e.g., "Construction Permit v1").
- Admin can define required document checklist, form fields, and review stages.
- Admin can configure role permissions per stage (who can review/approve/reject).

**Deliverable D2 — Applicant Portal (Submission + Tracking)**
- Applicants create an account and submit an application.
- Upload required documents to secure storage.
- Track status: Submitted → In Review → Needs Info → Approved/Rejected.

**Deliverable D3 — Reviewer Portal (Queue + Decisions + Comments)**
- Reviewers see assigned queues and SLAs.
- Can request additional information, approve, or reject with reasons.
- All actions generate immutable audit events.

**Deliverable D4 — Secure Document Handling (Core Security)**
- Strong authorization (RBAC + DB-level RLS).
- Encrypted transport; strict file validation; size/type restrictions.
- Document integrity: store file hashes and verify on retrieval.

**Deliverable D5 — Permit Issuance + QR Verification**
- On approval, system issues an official permit record + generated PDF.
- Permit contains a QR code that verifies: valid / expired / revoked.
- Verification endpoint is public but privacy-preserving (returns minimal data).

**Deliverable D6 — Enterprise Architecture + Scalability Demonstration**
- Clear architecture diagram and reasoning (client, API, DB, storage, background jobs).
- Load/performance experiment (even small-scale) showing system behavior.
- Logging/monitoring plan and security threat model.

**Deliverable D7 — Documentation and Demo**
- README + architecture docs + threat model.
- Demo walkthrough video or live demo.
- Test plan: functional tests + security tests (access control, tampering, enumeration).

---

### 1.3 A ⇒ B (Why This Plan Solves the Starting Problem)
Because the starting problem is a paper-first and trust-lacking workflow, GovStack will replace physical intake and scattered approvals with:
- a configurable digital workflow that fits multiple permit services,
- secure storage and strict access control for sensitive documents,
- auditability that makes decisions traceable,
- permit issuance that can be verified quickly through QR validation,
- an architecture designed to scale as applicant volume grows,
- intelligent automation (LLM-based document classification and reviewer summaries) that reduces manual work and helps catch incomplete or mismatched submissions before they reach a reviewer.

---

### 1.4 System Design (Implemented)

**Core stack**
- Frontend: React + TypeScript, Tailwind, shadcn/ui, react-router-dom
- Data fetching/state: TanStack React Query
- Backend: Supabase (Postgres + RLS, Auth sessions, Storage, Edge Functions)
- Forms/validation: react-hook-form + zod
- Document features: pdf-lib (PDF generation) + qrcode (QR generation)
- AI: OpenAI gpt-4o-mini (vision + chat completions) via Edge Function

**High-level architecture**
- Browser app for Applicants and Staff (two role-based UIs).
- Supabase Auth for sessions; role selection at sign-up stored in `user_roles`.
- Postgres schema with RLS on all 10 public tables.
- Storage bucket for documents and generated permit PDFs (authenticated only).
- Edge Functions: `generate-permit` (PDF + QR) and `ai-assist` (classify_document, review_summary).

See `architecture_v2.md` in this folder for the updated diagram.

**Data model (implemented tables)**
- `user_roles` (user_id, role as `app_role` enum)
- `municipalities` (name, contact)
- `permit_types` (municipality_id, name, slug, form_schema JSONB, required_docs JSONB)
- `applications` (permit_type_id, user_email, status as `app_status` enum, data JSONB — also stores ai_results)
- `documents` (application_id, filename, s3_key, sha256, mime, size)
- `decisions` (application_id, decision, issued_by, s3_key, sha256)
- `audit_log` (application_id, action, meta JSONB, ip — append-only)
- `permits` (permit_id, application_id, municipality_id, permit_type_id, status, pdf_s3_key, pdf_sha256, qr_url)
- `info_requests`, `info_request_responses` (clarification request workflow)

---

### 1.5 Security and Threat Model (Implemented)

**Threats addressed**
- Unauthorized access to documents — RLS policies require own-app ownership or government role.
- Permission escalation — single source of truth (`user_roles` + `has_role()` function); UI guards backed by DB-level RLS.
- Document tampering after upload — SHA-256 stored on upload, recomputed and verified on every download.
- Enumeration of application IDs — IDs are random UUIDs.
- Leakage through verification endpoint — public `/permits/:id` returns minimal fields only.
- Abuse via anonymous insertion — all anon INSERT policies removed in W11.

**Controls implemented**
- RLS deny-by-default on all tables with explicit role-scoped policies.
- RBAC at UI layer (`ProtectedRoute`, role-aware Header/Dashboard) backed by DB RLS.
- Storage bucket: authenticated upload + read only.
- SHA-256 hashing on upload, verification on download (citizen + gov).
- Random UUID primary keys.
- Append-only audit log on all sensitive actions.

---

### 1.6 Milestone Chart (Final)
- W5–W6: Planning + Checkpoint 1 documentation. ✅
- W7: Authentication, roles, route scaffolding. ✅
- W8: Applicant submission v1 with document upload + SHA-256. ✅
- W9: Reviewer queue v1 + status transitions. ✅
- W10: Permit issuance with PDF + QR + verification page. ✅
- W11: Security hardening — RLS audit, anon INSERT removal, storage tightened. ✅
- W12: Admin configuration v1 — municipalities + permit types + required_docs. ✅
- W13: Bug fixes; document integrity verification on download. ✅
- W14: AI integration — document classification + reviewer summary. ✅
- W15: Final documentation, architecture v2, test plan, demo prep. ✅

---

## 2) Current Progress Report (Match)

**Work completed in the last 2 weeks (W13–W15):**  
Fixed two real bugs in the reviewer flow that surfaced during integration testing: (a) the "Request Info" action silently failed because the modal referenced an undefined status constant (`NEEDS_INFO`) instead of the correct `CLARIFICATION_REQUESTED` — citizens were never notified; (b) the Approve/Decline/Request-Info buttons appeared on every row regardless of status, allowing duplicate decisions on already-decided applications. Both are fixed; the buttons now hide and show a status badge ("Awaiting citizen", "Decision recorded", "Closed") for non-actionable rows. Implemented document integrity verification on download: when a citizen or government user downloads a permit PDF or attached document, the client recomputes the SHA-256 hash and compares against the stored value. Mismatches block the download and warn the user — this directly satisfies the document tampering control in the threat model.

For the AI integration, built a new Supabase Edge Function (`ai-assist`) that exposes two actions: `classify_document` uses GPT-4o-mini's vision capability to verify whether an uploaded file actually matches the document type the citizen claimed it was (e.g., confirming an upload labeled "ID Card" looks like an ID card), and `review_summary` produces a concise reviewer-facing summary of an application's completeness, document validity, and recommended next action — without ever making the final decision. The citizen application form now includes a per-file dropdown to pick the document type, and shows AI verification feedback inline ("✓ AI Verified" / "⚠ AI Warning"). The government Details modal includes a new "AI Review Summary" section with a button that fetches a summary on demand. AI classifications are persisted in `applications.data.ai_results` (no schema change needed) so the reviewer doesn't pay to re-run classification on every modal open. The OpenAI API key is stored as a Supabase Edge Function secret; the browser never sees it.

Documentation: produced `architecture_v2.md` reflecting the AI integration, updated CLAUDE.md, and wrote this final checkpoint report.

**Comparison vs. milestone chart:**  
All milestones W5–W15 are complete. The AI integration was added in response to professor feedback in W12 and absorbed into the W13–W14 work without delaying any other milestone.

**Plan changes due to findings:**  
The original plan had W13 reserved for "integration and bug fixes; document integrity hashing." After the W12 professor feedback recommending intelligent automation, we expanded W13–W14 to include both bug fixes/integrity verification AND a real LLM integration, rather than only describing it conceptually. Email notifications (which would require an external email service like Resend) were deliberately deferred to post-semester production work — the in-app status change with the role-aware "Provide Info" button on the citizen's My Permits page is sufficient for the demo workflow.

---

## 3) Supporting Evidence (Factual)

GitHub project URL: https://github.com/howayek/Permits

Evidence directory: `/docs/checkpoint5/`
- `/docs/checkpoint5/ckpt5_report.md` — this report
- `/docs/checkpoint5/architecture_v2.md` — updated architecture with AI integration
- `/docs/checkpoint4/ckpt4_report.md` — Checkpoint 4
- `/docs/checkpoint3/ckpt3_report.md` — Checkpoint 3
- `/docs/checkpoint2/ckpt2_report.md` — Checkpoint 2
- `/docs/checkpoint1/ckpt1_report.md` — original proposal
- `/docs/checkpoint1/architecture_v1.md` — initial architecture diagram
- `/docs/checkpoint1/stakeholder_notes.md` — anonymized stakeholder notes
- `/INSTRUCTIONS.md` — AI workflow build/run/test instructions
- `README.md` — local setup

**Key commits in this checkpoint period:**
- Bug fix: RequestInfoModal status constant (CLARIFICATION_REQUESTED)
- Bug fix: GovDashboard action buttons gated by status
- New Edge Function: `ai-assist` (classify_document + review_summary)
- New file: `src/lib/aiAssist.ts` — frontend client wrapper
- ApplyStepper integrates AI document classification on upload
- GovDashboard DetailsModal integrates AI review summary
- New file: `src/lib/integrity.ts` — SHA-256 verification utility
- OwnedPermits + GovDashboard verify integrity on every download

---

## 4) Skill Learning Report

1. **Enterprise architecture design** — Designed a clean separation between UI, auth, RLS, storage, background jobs, and AI assistance. The system supports adding new permit types and AI features without restructuring.
2. **Database security with RLS** — Built and audited a complete RLS policy set across 10 tables with a single `has_role()` helper as the authorization source of truth. Migrated all legacy JWT-based policies to this consistent pattern.
3. **Secure file handling** — Implemented client-side SHA-256 hashing on upload, verification on download with explicit failure modes, MIME whitelist + size limits, and authenticated-only storage policies.
4. **Role-based access control** — UI route guards plus DB RLS form defense in depth; even if the frontend were bypassed, the DB rejects unauthorized access.
5. **LLM integration as a service layer** — Learned to build a server-side AI helper that wraps OpenAI's API behind a stable Edge Function interface. Vision classification (image upload), structured JSON outputs, and reviewer summaries — all without exposing the API key to the browser.
6. **Document integrity** — Used the Web Crypto API for SHA-256 client-side, treated tampering as a real threat (block on mismatch), and made the integrity check visible to the user.
7. **Iterative scope management** — Absorbed professor feedback mid-semester (W12) and expanded scope to include AI integration without delaying other milestones.

---

## 5) Self-Evaluation (Scope / Match / Factual)

- **Scope (Plan): 130%**  
  The project goes well beyond CRUD. It includes workflow-configurable permit types, secure document storage with integrity verification, comprehensive RLS across all tables, role-based access control, audit logs, QR-code-based permit verification, an admin configuration console, and LLM-based intelligent automation for document classification and reviewer assistance.

- **Match: 100%**  
  All milestones W5–W15 are complete. The AI integration directly addresses the W12 professor feedback. Both the bug fixes and new features were verified to compile cleanly and behave correctly.

- **Factual: 95%**  
  Evidence includes the runnable application, the ai-assist Edge Function source, the integrity verification utilities, all RLS policies verifiable in the database, and the architecture v2 documentation.

---

## 6) Risks and Mitigations (final)

- **Risk:** OpenAI API key abuse if leaked.  
  **Mitigation:** Key stored only as a Supabase Edge Function secret (server-side); never sent to the browser. The Edge Function is the only boundary.

- **Risk:** AI classification mistakes leading to false rejections.  
  **Mitigation:** AI is advisory only. Citizens can still submit even with warnings; reviewers make the final decision. The AI summary explicitly tells the reviewer "do not make the final decision."

- **Risk:** AI cost runaway.  
  **Mitigation:** Used `gpt-4o-mini` (cheap), structured prompts with low max_tokens, and persisted classification results to avoid re-running on every modal open.

- **Risk:** Document integrity check false positives (e.g., re-encoded PDFs).  
  **Mitigation:** SHA-256 is over the exact bytes — if the file changes, the hash changes. We treat any mismatch as suspicious and block the download with a clear error message.

- **Risk:** Edge Function unavailable.  
  **Mitigation:** AI features fail gracefully — the citizen application form proceeds without classification, and the reviewer simply doesn't see an AI summary. Core workflow is unaffected.

- **Risk:** Future need for email notifications.  
  **Mitigation:** Documented as a known future enhancement. Current in-app status changes (with the role-aware "Provide Info" button) cover the demo workflow.

---

## 7) Test Plan (Functional + Security)

**Functional tests (manual)**
1. Sign up as Citizen → verify `user_roles` row inserted with CITIZEN.
2. Browse municipalities → select permit type → fill form → upload a document, label it, see AI verification banner → submit.
3. Verify in DB: `applications.data.ai_results` contains classification, `documents` row has s3_key + sha256, `audit_log` has DOCUMENTS_UPLOADED event.
4. Sign in as Government → open Review Queue → verify only actionable rows show approve/decline/request-info; others show status badge.
5. Click "Generate AI Summary" → verify summary returns and is reasonable.
6. Approve an application → citizen sees "Approved" status in My Permits.
7. Click "Generate PDF" → permit PDF generated, QR works at /permits/:id.
8. Download PDF → integrity check passes (toast says "Integrity verified").

**Security tests**
1. Access `/gov` as citizen → redirected to `/dashboard` (UI guard).
2. Direct DB query as citizen for another user's application → returns empty (RLS).
3. Upload a non-allowed file type (e.g. `.exe`) → blocked client-side.
4. Tamper with a stored file (e.g. via service role) and re-download → integrity check fails, download blocked.
5. Anonymous user attempts to INSERT into `applications` via REST API → blocked (no anon INSERT policy).
6. Verify `OPENAI_API_KEY` is not in any client bundle → confirmed (only in Edge Function env).
