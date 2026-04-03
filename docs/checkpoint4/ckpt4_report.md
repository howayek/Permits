# Georgia Institute of Technology  
## CS 4365/6365: IEC — Spring 2026  
## Project Checkpoint 4 Report

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
- an architecture designed to scale as applicant volume grows.

---

### 1.4 System Design (Planned Technical Approach)

**Core stack**
- Frontend: React + TypeScript, Tailwind, shadcn/ui, react-router-dom
- Data fetching/state: TanStack React Query
- Backend: Supabase (Postgres + RLS, Auth sessions, Storage, Edge Functions for PDF/QR)
- Forms/validation: react-hook-form + zod
- Document features: pdf-lib (PDF generation) + qrcode (QR generation)

**High-level architecture**
- Browser app for Applicants and Staff (two role-based UIs).
- Supabase Auth for sessions; role selection at sign-up stored in `user_roles`.
- Postgres schema for permit types, applications, review stages, decisions, audit events.
- Storage buckets for documents (uploads) and permits (generated PDFs).
- Edge Function for server-side permit PDF generation with QR embedding.

**Data model (implemented tables)**
- `user_roles` (user_id, role as `app_role` enum: CITIZEN, GOVERNMENT, DEVELOPER, CLERK, ADMIN)
- `municipalities` (name, contact)
- `permit_types` (municipality_id, name, slug, form_schema JSONB, required_docs JSONB)
- `applications` (permit_type_id, user_email, status as `app_status` enum, data JSONB)
- `documents` (application_id, filename, s3_key, sha256, mime, size)
- `decisions` (application_id, decision, issued_by, s3_key, sha256)
- `audit_log` (application_id, action, meta JSONB, ip — append-only)
- `permits` (permit_id, application_id, municipality_id, permit_type_id, status as `permit_status` enum, pdf_s3_key, qr_url, owner_name)
- `info_requests` (application_id, requested_by, requested_fields, message, due_date)
- `info_request_responses` (request_id, application_id, user_id, updated_fields, note)

---

### 1.5 Security and Threat Model (Planned)

**Threats to be addressed**
- Unauthorized access to documents (broken access control)
- Permission escalation across roles
- Document tampering after upload
- Enumeration of application IDs
- Leakage through verification endpoint (privacy)
- Abuse (spam submissions, upload flooding)

**Controls to be implemented**
- RLS policies in Postgres (deny-by-default)
- RBAC in UI + enforced server-side by RLS (UI never trusted alone)
- Private storage buckets; signed URLs for short-lived access
- Hashing documents on upload and verifying on download
- Random, non-guessable IDs for permits/applications
- Rate limiting on verification endpoint and anti-scraping mitigations
- Full audit logging of sensitive actions

---

### 1.6 Milestone Chart (Weekly Plan)
- W5–W6: Finalize requirements and workflow specification, produce the initial architecture sketch, and complete Checkpoint 1 documentation.
- W7: Implement authentication and roles, and scaffold the Applicant and Reviewer routes/pages.
- W8: Build Applicant submission v1 (create an application and upload one required document).
- W9: Build Reviewer queue v1 and basic status transitions (Submitted → In Review → Needs Info → Approved/Rejected).
- W10: Implement permit issuance proof-of-concept: generate a permit record, generate a simple PDF, and add a QR verification endpoint.
- W11: Security hardening: add database authorization policies (RLS), audit logging, and secure storage access rules.
- W12: Admin configuration v1: allow creating a permit type and defining required documents and review stages.
- W13: Integration and bug fixes; add document integrity hashing (store/verify file hashes).
- W14: Final demo preparation; performance/scalability notes; functional and security test plan execution.
- W15: Buffer week for fixes and final submission.

---

## 2) Current Progress Report (Match)

**Work completed in the last 2 weeks (W11–W12):**  
Completed a comprehensive security hardening pass across the entire database. Enabled RLS on the `permits` table (the last table without it) and added citizen, government, and public verification policies. Removed all dangerous anonymous INSERT policies that allowed unauthenticated users to create applications, documents, and audit log entries. Migrated all legacy JWT-based developer policies (which checked `app_metadata` in the token) to use the consistent `has_role()` SECURITY DEFINER function that checks the `user_roles` table. Removed unused anonymous CRUD policies on the `permits` storage bucket. All 10 public tables now have RLS enabled with properly scoped policies.

For W12 (Admin Configuration), added RLS policies allowing government/admin users to create and manage municipalities and permit types. Built a new Admin Configuration page (`/gov/admin`) where government users can create municipalities with contact info and define permit types with a name, slug, and required document list. The required documents list from `permit_types.required_docs` is now displayed on the citizen's application form, so applicants know exactly which documents they need to upload.

**Comparison vs. milestone chart:**  
W11 (security hardening) and W12 (admin configuration v1) are complete. All milestones through W12 are on track.

**Immediate next 2 weeks (W13–W14):**  
Integration testing and bug fixes. Add document integrity verification on download. Prepare final demo, write up performance/scalability notes, and execute the functional and security test plan.

**Plan changes due to findings:**  
The security audit revealed that the original codebase had two inconsistent authorization systems: JWT-based `app_metadata` checks (set manually per user) and our `user_roles` table approach. We unified everything under `has_role()`, which queries the `user_roles` table. This is now the single source of truth for all RLS policies. The `permits` storage bucket was found to be unused (all files are stored in the `documents` bucket), so its demo policies were removed.

---

## 3) Supporting Evidence (Factual)

GitHub project URL: https://github.com/howayek/Permits

Evidence directory: `/docs/checkpoint4/`
- `/docs/checkpoint4/ckpt4_report.md` — this checkpoint report
- `/docs/checkpoint3/ckpt3_report.md` — Checkpoint 3 report
- `/docs/checkpoint2/ckpt2_report.md` — Checkpoint 2 report
- `/docs/checkpoint1/ckpt1_report.md` — original project proposal (Checkpoint 1)
- `/docs/checkpoint1/architecture_v1.md` — architecture diagram + notes
- `/docs/checkpoint1/stakeholder_notes.md` — anonymized stakeholder notes
- `/INSTRUCTIONS.md` — AI workflow instructions (build, run, test)
- `README.md` — how to run locally

**Key commits in this checkpoint period:**
- RLS enabled on all 10 tables with properly scoped policies
- Removed 3 dangerous anon INSERT policies (applications, documents, audit_log)
- Migrated 4 legacy JWT-based developer policies to use `has_role()`
- Removed 4 unused anon CRUD policies on permits storage bucket
- Added `gov_manage_municipalities` and `gov_manage_permit_types` RLS policies
- Built Admin Configuration page (`/gov/admin`) for creating municipalities and permit types
- Wired `required_docs` from permit types into the citizen application form

---

## 4) Skill Learning Report

1. **Enterprise architecture design** — Practiced clear separation between UI, auth, database policies, storage, and background jobs. Updated the data model from a draft to a working schema with proper foreign keys and enums.
2. **Database security with RLS** — Completed a full security audit. All 10 tables now have RLS with properly scoped policies. Learned the difference between JWT-based and table-based role checks, and why a single source of truth (the `has_role()` function) is critical for consistency.
3. **Secure file handling** — Implemented client-side SHA-256 hashing using the Web Crypto API, file type validation against a MIME whitelist, and size limits. Removed anonymous upload capabilities to prevent unauthenticated abuse.
4. **Role-based access control** — Built a complete RBAC system: database trigger for auto-assignment, `has_role()` helper for RLS, `ProtectedRoute` for frontend guards, and role-aware UI (header, dashboard, admin page).
5. **Admin configuration** — Learned how to build workflow-configurable systems where permit types, required documents, and form schemas are data-driven rather than hardcoded. Government users can now extend the system without code changes.

---

## 5) Self-Evaluation (Scope / Match / Factual)

- **Scope (Plan): 120%**  
  The project now includes workflow configuration via an admin console, secure document storage with integrity hashing, comprehensive RLS across all tables, role-based access control at both UI and database layers, audit logs, QR verification, and a unified authorization framework using `has_role()`.

- **Match: 100%**  
  W11 and W12 milestones are complete. Security hardening covered all tables and storage. Admin configuration allows creating municipalities and permit types with required document definitions.

- **Factual: 95%**  
  Evidence includes the working application, all 10 tables with RLS verified via database queries, admin page tested with municipality and permit type creation, and required documents displayed on the citizen application form.

---

## 6) Risks and Mitigations (brief)

- **Risk:** MVP becomes too broad (multiple permit types + many features).  
  **Mitigation:** Built one fully working permit workflow first; admin configuration is now available but scoped to municipalities and permit types.

- **Risk:** Security features take too long late in semester.  
  **Mitigation:** Completed comprehensive security hardening in W11. All tables have RLS, anonymous insert policies removed, legacy JWT-based policies migrated.

- **Risk:** Verification leaks applicant data.  
  **Mitigation:** Verification endpoint returns minimal fields (permit status + type + issue date). Anonymous SELECT on permits is allowed but only for the QR verification use case.

- **Risk:** Document integrity not verifiable after upload.  
  **Mitigation:** SHA-256 hashes are computed client-side before upload and stored alongside the document metadata. Verification on download can compare hashes.

- **Risk:** Inconsistent authorization between JWT and database approaches.  
  **Mitigation:** Unified all RLS policies under `has_role()` which checks the `user_roles` table. Legacy JWT-based policies have been fully migrated.
