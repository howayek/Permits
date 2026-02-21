# Georgia Institute of Technology  
## CS 4365: IEC — Spring 2026  
## Project Checkpoint Report (Checkpoint 1)

**Group:** [Group Name / Solo]  
**Name:** Mark Howayek  
**Project:** GovStack  

---

## 1) Project Plan (Plan)

### 1.1 Point A — Current State / Context (Starting Point)
In many countries and municipalities, permit-related processes (construction permits, driver-related permits, business permits, etc.) are still paper-first and in-person. Applicants must visit offices, submit large sets of documents, and then repeatedly follow up. Reviewers handle documents manually, approvals are difficult to track, and there is limited auditability for who accessed or approved what. This creates delays, lost documents, inconsistent decisions, and opportunities for fraud.

From an enterprise computing perspective, this problem is not just “forms online.” The system must handle:
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

GovStack targets a reusable platform that can support multiple permit types through configuration, while enforcing enterprise-grade security and traceability.

Over the past 2 weeks, I validated these pain points with stakeholders. They want the workflow to stay partially manual at the beginning (human review), but they want fewer in-person visits, clearer required-document checklists, and a simple way to verify approvals. I also produced an initial architecture sketch and identified security requirements (roles, audit logs, and permit verification).

---

### 1.2 Point B — End-of-Semester Deliverables (What Will Be Shipped)

**Deliverable D1 — Workflow-configurable permit types (Admin Console)**
- Admin can create a permit type (e.g., “Construction Permit v1”).
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
- Backend: Supabase (Postgres + RLS, Auth sessions, Storage, server functions for PDF/QR)
- Forms/validation: react-hook-form + zod
- Document features: PDF generation + QR generation libraries

**High-level architecture**
1. Browser app for Applicants and Staff (two role-based UIs).
2. Supabase Auth for sessions.
3. Postgres schema for permit types, applications, review stages, decisions, audit events.
4. Storage buckets for documents (private).
5. Server-side function(s) for:
   - generating permit PDFs,
   - embedding QR code,
   - computing/storing file hashes,
   - verification endpoint for QR scans.

**Data model (planned tables — draft)**
- `users` (role metadata)
- `permit_types` (config)
- `permit_requirements` (required doc list per type)
- `applications` (status, applicant_id, permit_type_id)
- `application_documents` (file path, checksum/hash, metadata)
- `reviews` (stage, reviewer_id, decision, comments, timestamps)
- `audit_events` (append-only: actor, action, target, timestamp, IP/device if available)
- `permits` (issued permit, expiry, revocation status, verification token)

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
> This is a solo plan and may be adjusted if team roles change.

| Week | Planned work (Mark) |
|---|---|
| W5–W6 | Requirements + workflow spec, architecture sketch, checkpoint documentation |
| W7 | Implement auth + roles; scaffold Applicant + Reviewer routes/pages |
| W8 | Applicant submission v1 (create application + upload one document) |
| W9 | Reviewer queue v1 + basic status transitions (submitted/in review/needs info/approved/rejected) |
| W10 | Permit issuance PoC: generate permit record + PDF + QR verification endpoint |
| W11 | Security hardening: RLS policies, audit logging, storage access rules |
| W12 | Admin configuration v1 (define permit type + required docs + stages) |
| W13 | Integration + bug fixes; document integrity hashing |
| W14 | Final demo prep; performance/scalability notes; testing |
| W15 | Buffer + final submission |

---

## 2) Current Progress Report (Match)

**Work completed in the last 2 weeks (2–3 lines):**  
I interviewed stakeholders and documented permit workflow pain points, required document sets, and approval stages. I produced an initial architecture sketch and identified security requirements (roles, audit logs, and permit verification). I also set up the project repository, added the initial web app codebase (React/TypeScript/Vite + UI stack), and validated the app can run locally.

**Comparison vs. milestone chart:**  
I completed the W5–W6 planning work (requirements + initial architecture + initial security needs) and set up a runnable UI baseline.

**Immediate next 2 weeks (1–2 lines):**  
Finalize MVP scope and data model, then start a minimal prototype: auth → create application → upload one document.

**Plan changes due to findings:**  
I will scope the MVP to one main permit workflow first while keeping the permit-type configuration model so the platform can generalize later.

---

## 3) Supporting Evidence (Factual)

- GitHub project URL: https://github.com/howayek/Permits
- Evidence directory: `/docs/checkpoint1/`
  - `/docs/checkpoint1/ckpt1_report.md` — checkpoint report (proposal)
  - `/docs/checkpoint1/architecture_v1.md` — simple architecture diagram + notes
  - `/docs/checkpoint1/stakeholder_notes.md` — anonymized stakeholder notes
- `README.md` — how to run locally

---

## 4) Skill Learning Report

1. **Enterprise architecture design** — Practicing clear service boundaries (UI, auth, DB policies, storage, background jobs) and documenting tradeoffs.  
2. **Database security with RLS** — Learning how to enforce least-privilege authorization at the database layer, not only in frontend logic.  
3. **Secure file handling** — Implementing file validation, private storage access patterns, and integrity hashing for tamper detection.  
4. **Threat modeling and auditability** — Defining threats, mapping them to controls, and designing an append-only audit log.  
5. **Workflow systems** — Learning how to represent configurable review stages, queues, and decisions in a maintainable schema.  

---

## 5) Self-Evaluation (Scope / Match / Factual)

- **Scope (Plan): 115%**  
  The project includes workflow configuration, secure document storage, RLS security, audit logs, and QR verification—beyond basic CRUD.

- **Match: 100%**  
  I completed the planned discovery and design work for the first checkpoint period, and I have a minimal UI baseline running.

- **Factual: 95%**  
  The repo includes checkpoint documentation and a runnable project baseline. Core features (submission/review/issuance) are planned for the next milestone.

---

## 6) Risks and Mitigations (brief)

- **Risk:** MVP becomes too broad (multiple permit types + many features).  
  **Mitigation:** Build one fully working permit workflow first; keep configurability as a structured but limited admin feature.

- **Risk:** Security features take too long late in semester.  
  **Mitigation:** Implement RLS + audit logging early; treat them as core, not “extra.”

- **Risk:** Verification leaks applicant data.  
  **Mitigation:** Verification endpoint returns minimal fields (valid/expired/revoked + permit type + issue date at most).