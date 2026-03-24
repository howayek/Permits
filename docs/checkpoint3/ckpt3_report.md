# Georgia Institute of Technology  
## CS 4365/6365: IEC — Spring 2026  
## Project Checkpoint 3 Report

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

**Work completed in the last 2 weeks (W9–W10):**  
Built the Reviewer portal with a working government dashboard: government users now see a dedicated Government Dashboard with links to the Review Queue and Applications Database. Implemented Row-Level Security policies for the government role using a `has_role()` SECURITY DEFINER helper function that checks the `user_roles` table, enabling government staff to read all applications, decisions, documents, and audit logs, and to update application status and create decisions. Fixed a critical auth architecture issue where roles were stored in per-component local state instead of shared context—roles are now fetched once in `AuthProvider` and shared via React Context, with a JWT metadata fallback for reliability. Built the Applications Database view with status filters matching the actual Postgres `app_status` enum (SUBMITTED, ROUTED, CLARIFICATION_REQUESTED, DECISION_UPLOADED, CLOSED). Fixed municipality display across the application to show names instead of UUIDs by joining through `permit_types` to `municipalities`. Improved role-aware UI: government users see Review Queue and Applications links in the header, while citizen-specific links (Apply, My Permits) are hidden for government accounts.

**Comparison vs. milestone chart:**  
W9 (reviewer queue + status transitions) and W10 (permit issuance POC) are substantially complete. The reviewer queue is functional with approve/reject/request-info actions, status transitions using real Postgres enum values, and audit logging. Permit issuance with QR verification has been validated end-to-end.

**Immediate next 2 weeks (W11–W12):**  
Security hardening: audit all RLS policies for consistency (migrate legacy JWT-based policies to use the `has_role()` pattern), tighten storage bucket access, and add signed URL support. Then build Admin configuration v1: a page for government users to create permit types with custom form schemas and required document lists.

**Plan changes due to findings:**  
Discovered that the original RLS policies used a JWT `app_metadata` approach (set manually per user in the Supabase dashboard) while our system uses a `user_roles` table. We now use a hybrid approach: new policies check `user_roles` via `has_role()`, and the frontend reads roles from both JWT metadata and the database for maximum reliability. Legacy JWT-based policies still exist and will be migrated in W11.

---

## 3) Supporting Evidence (Factual)

GitHub project URL: https://github.com/howayek/Permits

Evidence directory: `/docs/checkpoint3/`
- `/docs/checkpoint3/ckpt3_report.md` — this checkpoint report
- `/docs/checkpoint2/ckpt2_report.md` — Checkpoint 2 report
- `/docs/checkpoint1/ckpt1_report.md` — original project proposal (Checkpoint 1)
- `/docs/checkpoint1/architecture_v1.md` — architecture diagram + notes
- `/docs/checkpoint1/stakeholder_notes.md` — anonymized stakeholder notes
- `/INSTRUCTIONS.md` — AI workflow instructions (build, run, test)
- `/CLAUDE.md` — project memory file for AI assistants
- `README.md` — how to run locally

**Key commits in this checkpoint period:**
- Government RLS policies using `has_role()` SECURITY DEFINER function (8 new policies across 4 tables)
- Auth architecture rewrite: roles moved from per-hook local state to shared AuthProvider context with JWT metadata fallback
- Government-specific dashboard view with Review Queue and Applications Database cards
- Role-aware Header: government users see Review Queue / Applications; citizens see Apply / My Permits
- Municipality name display fixed across all views (joined through permit_types → municipalities)
- GovDatabase status filters aligned with actual Postgres `app_status` enum values
- Welcome message shows user's full name from signup metadata instead of email

---

## 4) Skill Learning Report

1. **Enterprise architecture design** — Practiced clear separation between UI, auth, database policies, storage, and background jobs. Updated the data model from a draft to a working schema with proper foreign keys and enums.
2. **Database security with RLS** — Configured Row-Level Security policies on all tables. Learned that RLS applies to storage buckets as well (storage upload failed until a proper policy was added). Built a `has_role()` SECURITY DEFINER function as the single source of truth for role checks in RLS policies.
3. **Secure file handling** — Implemented client-side SHA-256 hashing using the Web Crypto API, file type validation against a MIME whitelist, and size limits. Documents are stored with integrity hashes for tamper detection.
4. **Role-based access control** — Built a role system using a `user_roles` table, a database trigger for auto-assignment, a frontend `ProtectedRoute` component that gates routes by role, and RLS policies that enforce the same roles server-side.
5. **Supabase Auth integration** — Learned how to pass custom metadata during sign-up (`options.data`), read it in a database trigger, manage sessions with `onAuthStateChange`, and use JWT metadata as a fast fallback for role resolution when database queries are subject to RLS.

---

## 5) Self-Evaluation (Scope / Match / Factual)

- **Scope (Plan): 115%**  
  The project includes workflow configuration, secure document storage with integrity hashing, RLS security, role-based access control, audit logs, and QR verification—significantly beyond basic CRUD.

- **Match: 100%**  
  W9 and W10 milestones are complete: the reviewer queue is functional with approve/reject/request-info actions and real status transitions, and permit issuance with QR verification has been validated.

- **Factual: 95%**  
  Evidence includes the working application (runnable locally), government dashboard with all applications visible, RLS policies verified in the database, document uploads with SHA-256 hashes, audit log entries, and role assignments.

---

## 6) Risks and Mitigations (brief)

- **Risk:** MVP becomes too broad (multiple permit types + many features).  
  **Mitigation:** Built one fully working permit workflow first; keep configurability as a structured but limited admin feature.

- **Risk:** Security features take too long late in semester.  
  **Mitigation:** Already implemented RLS policies on tables, role-based route guards, and file validation in W7–W8. Security is being built incrementally, not deferred.

- **Risk:** Verification leaks applicant data.  
  **Mitigation:** Verification endpoint returns minimal fields (valid/expired/revoked + permit type + issue date at most).

- **Risk:** Document integrity not verifiable after upload.  
  **Mitigation:** SHA-256 hashes are computed client-side before upload and stored alongside the document metadata. Verification on download can compare hashes.

- **Risk:** RLS policies inconsistent between legacy JWT-based and new table-based approaches.  
  **Mitigation:** New policies use `has_role()` consistently. Legacy policies will be migrated in W11 security hardening.
