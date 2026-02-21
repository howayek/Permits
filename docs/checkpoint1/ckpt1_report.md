# CS 4365/6365 (IEC) — Spring 2026
## Project Checkpoint Report — Checkpoint 1 (Proposal)

**Group:**
**Name(s):** Mark Howayek
**Project Name:** PermitFlow — Secure Permit Intake + Review + Verification Platform  
**GitHub Repo:** [PASTE URL]

---

# 1) Project Plan (Plan)

## 1.1 Point A — Current state / context (starting point)
In many countries, permit processes are still paper-based and require in-person visits. Applicants must submit many documents physically, and staff review them manually. This causes delays, missing paperwork, and inconsistent processing. There is also limited auditability (it is hard to tell who accessed or approved what) and limited verification (it is hard to quickly confirm if a permit is valid).

Over the past 2 weeks, we talked to stakeholders and confirmed that the current workflow is intentionally manual at the beginning because offices want control, but they still want a system that reduces repeated visits and makes decisions trackable. We also produced an initial architecture sketch and identified security requirements (role separation, audit logs, and permit verification).

## 1.2 Point B — End-of-semester deliverables
**D1 — Configurable permit workflows (Admin setup)**
- Define a permit type (e.g., “Telecom line permit”, “Construction permit”) with required documents.
- Define review stages (intake → review → supervisor approval) and who can approve.

**D2 — Applicant portal**
- Applicant submits application and uploads documents.
- Applicant can track status and receive requests for missing documents.

**D3 — Reviewer portal**
- Staff can see a queue, review submissions, request more info, approve, or reject.
- All actions produce an audit record.

**D4 — Security + compliance core**
- Authentication + role-based access.
- Database-level authorization using Postgres policies (RLS-style enforcement).
- Audit log of sensitive actions (view document, approve/reject, generate permit).

**D5 — Permit issuance + verification**
- When approved, the system generates a permit record and a simple PDF.
- The permit includes a QR code that verifies validity (valid/expired/revoked) using a public verification endpoint.

**D6 — Enterprise architecture + scalability demonstration**
- Architecture documentation (components, trust boundaries, storage, background jobs).
- A small performance / load experiment or staged scaling plan (what breaks first, how to scale).

**D7 — Documentation + demo**
- Setup instructions, threat model, and final demo video or live demo walkthrough.

---

## 1.3 A ⇒ B (why this plan addresses the current state)
The current state is slow and manual mainly because documents are sensitive and decisions need accountability. PermitFlow keeps a controlled review workflow but moves submission, tracking, and verification into a secure digital platform. This reduces in-person paperwork, improves traceability with audit logs, and allows fast verification using QR-based validity checks.

---

## 1.4 Milestone chart (weekly plan)
> Fill teammate names. This is an adaptive plan and may change after early implementation.

| Week | Mark | Teammate A | Teammate B | Teammate C |
|---|---|---|---|---|
| W5–W6 | Requirements + scope + checkpoint docs | Workflow mapping | Architecture sketch | Security/threat model v1 |
| W7 | Repo setup + basic auth | Applicant UI skeleton | DB schema draft | Storage upload POC |
| W8 | Reviewer UI skeleton | Applicant submission flow | RLS policies v1 | Audit log events v1 |
| W9 | Permit issuance + PDF/QR POC | UI polish | Verification endpoint | Test cases |
| W10 | End-to-end MVP demo | Fixes + UX | Security hardening | Docs + diagrams |
| W11–W12 | Configurable permit types | Admin UI | Scaling/perf notes | Monitoring/logging |
| W13–W15 | Final integration + report + demo | Final integration + report + demo | Final integration + report + demo | Final integration + report + demo |

---

# 2) Current progress report (Match)

**Work done in the last 2 weeks (2–3 lines):**  
We validated the problem and workflow with stakeholders and documented key requirements for submission, manual review stages, and verification. We drafted an initial architecture and identified core security needs: role separation, auditability, and permit verification.

**Compare with initially planned milestone chart:**  
This matches the W5–W6 planning goals (requirements + early architecture + security plan).

**Immediate planned work for next 2 weeks (1–2 lines):**  
Finalize the MVP scope and data model, then start a minimal prototype: auth + create application + upload one document.

**Changes to original plan (if any):**  
For the MVP, we will focus on one permit workflow end-to-end first, then generalize to multiple permit types.

---

# 3) Supporting Evidence (Factual)

- GitHub Repo: [PASTE URL]
- Evidence directory: `/docs/checkpoint1/`
  - `ckpt1_report.md` (this document)
  - `architecture_v1.md` (simple architecture sketch)
  - `stakeholder_notes.md` (anonymized notes)

---

# 4) Skill Learning Report

- **Enterprise architecture:** We are learning how to define components, trust boundaries, and scaling paths for a workflow-driven platform.  
- **Security design (RBAC + auditability):** We are learning how to enforce least privilege and how to record actions for accountability.  
- **Secure document handling:** We are learning best practices for uploads, private storage, and verification patterns (QR-based validity).  

---

# 5) Self-Evaluation

- **Scope (Plan):** 110% — The plan includes workflow, security controls, audit logs, and QR-based verification, not only a CRUD app.  
- **Match:** 100% — We completed the discovery and planning work expected for Checkpoint 1.  
- **Factual:** 90–95% — Evidence is design/stakeholder-based (no code yet), but supports the progress claimed.