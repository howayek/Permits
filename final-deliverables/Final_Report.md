# GovStack: A Workflow-Configurable Digital Permit Platform with LLM-Assisted Document Verification

**CS 4365/6365: Introduction to Enterprise Computing — Spring 2026**
**Georgia Institute of Technology**

**Author:** Mark Howayek
**Project:** GovStack (Lebanon Digital Permits)
**Repository:** https://github.com/howayek/Permits

---

## Table of Contents

1. Introduction
2. Motivation
3. Related Work
4. System Architecture
   4.1 High-Level Architecture
   4.2 Frontend Stack
   4.3 Backend (Supabase) Stack
   4.4 AI Integration Layer
5. Data Model
6. Security Architecture and Threat Model
   6.1 Authentication and Roles
   6.2 Row-Level Security (RLS)
   6.3 Document Integrity
   6.4 Storage Access
   6.5 Audit Logging
7. Implementation Methodology
   7.1 Implementation Phases
   7.2 Major Engineering Challenges
8. AI Integration: LLM-Assisted Document Verification and Reviewer Summaries
   8.1 Why AI in This System
   8.2 Edge Function Design
   8.3 Document Classification Flow
   8.4 Reviewer Summary Flow
   8.5 Cost and Reliability Considerations
9. Evaluation and Results
10. Conclusion
11. Future Work
12. Deliverables
13. Skill Learning Report
14. References

---

## 1. Introduction

In many countries and municipalities — Lebanon among them — the workflow to obtain a permit (construction, business license, event permit, driving permit, etc.) is still paper-first and largely in-person. Citizens must travel to municipal offices, photocopy and submit large packets of documentation, and then return repeatedly to follow up on the status of their request. Reviewers handle each application manually, decisions are recorded inconsistently across paper trails, and there is little auditability of who accessed what document and when.

This is not just a "forms online" problem. From an enterprise computing perspective, replacing this workflow requires a system that simultaneously handles sensitive personally identifiable information (PII), enforces role-separated workflows (intake clerk vs. reviewer vs. supervisor), maintains a non-repudiable audit trail, scales storage and compute as application volumes grow, and produces verifiable artifacts (a permit that can be checked as valid without re-reading the entire file set).

GovStack is a digital permit platform that addresses these requirements. It is workflow-configurable (a single platform can support multiple permit types via configuration rather than code changes), enforces enterprise-grade security at the database level (Row-Level Security on every table plus role-based access control in the UI), produces tamper-evident permits (each issued PDF carries a SHA-256 hash and a QR code linking to a public verification endpoint), and integrates large language models to assist with document verification on intake and reviewer summarization in the back office.

This report describes the motivation, architecture, implementation methodology, security model, AI integration, evaluation, and meta-skills developed during the construction of GovStack over a single semester (Weeks 5 through 15 of Spring 2026).

---

## 2. Motivation

The motivation for GovStack is rooted in a stakeholder discovery exercise conducted at the start of the semester. Discussions with potential users (citizens who had recently applied for permits, and one municipal staff member familiar with the back office side) surfaced a consistent set of pain points:

- **Time cost to citizens.** Multiple in-person visits per application. Long wait times for status updates. No clear understanding of what documents are required upfront, leading to multiple round-trips when something is missing.
- **Time cost to reviewers.** Manual handling of paper documents. No structured way to flag missing or incorrect information. No tooling to detect when an applicant has uploaded a document that is plainly the wrong type.
- **Trust deficit.** Once a permit is issued, there is no easy way for a third party (e.g., a property buyer, an inspector, a foreign embassy) to verify that the document is genuine, current, and has not been tampered with.
- **Inflexibility.** Each new permit type historically required custom paperwork, manual training, and process redesign. There is no shared platform across permit types or municipalities.

From an enterprise computing standpoint, the opportunity is to build a single, configurable, secure platform that:

1. Reduces the citizen's friction (online submission, clear required-document checklists, real-time status tracking).
2. Reduces the reviewer's friction (queue-based review, AI-assisted document classification, AI-generated summaries).
3. Produces tamper-evident, publicly verifiable artifacts (permit PDFs with QR codes that resolve to a privacy-preserving verification page).
4. Enforces security and accountability by design (every sensitive action logged; every database query gated by Row-Level Security; every document integrity-checked on upload and download).

Beyond digitization, the broader objective is to demonstrate that intelligent automation (LLM-based document classification and reviewer summarization) can shift the burden of low-value work — checking whether an upload labeled "ID Card" actually looks like an ID card, or summarizing the completeness of an application — away from human staff and toward the system, while keeping humans in control of the final decision.

---

## 3. Related Work

### 3.1 Existing Government Permit Portals

A number of governments operate online portals for specific services — for example, business license renewals or vehicle registration. These systems are typically:

- **Not workflow-configurable.** Each service is hard-coded as a separate vertical, often built by a different vendor, with separate logins, separate document stores, and no shared audit trail.
- **Weak in verification.** Issued documents are often plain PDFs without integrity hashes or revocation lookup. Verifying that a permit is still valid usually requires phoning the issuing office.
- **Limited in access control.** Government staff often share generic accounts or have no role separation between intake clerks, reviewers, and supervisors.
- **Difficult to extend.** Adding a new permit type usually means a procurement cycle and a new code release, not a configuration change.

GovStack's design directly addresses these gaps: a single platform with multiple permit types defined as data, RLS-enforced role separation, SHA-256 integrity on every uploaded and issued document, and a public QR-based verification endpoint.

### 3.2 Workflow Engines and Configurable Forms

The "workflow-configurable" deliverable in this project (D1) is closely related to commercial workflow platforms such as Camunda, ServiceNow, and Salesforce Service Cloud. Those systems generalize beyond permits to any review-decision-issuance workflow. GovStack scopes down to the permit domain specifically, which lets the platform make stronger assumptions (e.g., every workflow has a required-document checklist, every workflow ends with an issued permit and a verification token) and ship a simpler, more focused user experience.

### 3.3 Document Verification with Vision-Language Models

The use of multimodal LLMs (e.g., GPT-4o, GPT-4o-mini) for document classification is an emerging area. Earlier OCR-based approaches required fixed templates per document type (an ID card OCR template, a property deed OCR template, etc.). Modern vision-language models can answer the more flexible question "does this image look like the type of document the user said it was?" without per-document-type engineering. GovStack uses GPT-4o-mini for this purpose, treating the AI's response as advisory feedback to both the citizen (at upload time) and the reviewer (at review time), with the human always retaining the final decision.

### 3.4 Row-Level Security as a Foundation

PostgreSQL's Row-Level Security feature (introduced in 9.5 and matured through subsequent versions) underpins GovStack's authorization model. The pattern of using a `SECURITY DEFINER` helper function to centralize role checks — rather than duplicating role logic across every policy — is well documented in the Supabase community and in PostgreSQL literature. GovStack adopts this pattern and applies it consistently across all 10 tables in the schema.

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
                  ┌─────────────────────────────────────────┐
                  │  Browser (React + TypeScript + Vite)    │
                  │   ┌──────────────┐  ┌──────────────┐    │
                  │   │  Citizen UI  │  │  Reviewer UI │    │
                  │   │  (Apply,     │  │  (Queue,     │    │
                  │   │   My Permits)│  │   Decisions) │    │
                  │   └──────────────┘  └──────────────┘    │
                  └────────────────┬────────────────────────┘
                                   │ HTTPS (TLS)
                                   ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                      Supabase                               │
   │                                                             │
   │   ┌──────────────┐    ┌──────────────────────────────────┐  │
   │   │ Auth         │    │  Postgres (Row-Level Security)   │  │
   │   │ (sessions,   │───▶│  • applications, decisions,      │  │
   │   │  email/pwd)  │    │    documents, audit_log, permits │  │
   │   └──────────────┘    │  • user_roles + has_role()       │  │
   │                       └──────────────────────────────────┘  │
   │                                                             │
   │   ┌──────────────────────┐   ┌────────────────────────────┐ │
   │   │ Storage              │   │ Edge Functions (Deno)      │ │
   │   │ documents bucket:    │   │ • generate-permit          │ │
   │   │   citizen uploads,   │   │   (PDF + QR generation)    │ │
   │   │   permit PDFs        │   │ • ai-assist  ◀────────┐    │ │
   │   │ (auth-only RLS)      │   │   classify_document   │    │ │
   │   └──────────────────────┘   │   review_summary      │    │ │
   │                              └────────────────────────┘   │ │
   └────────────────────────────────────────────────┬──────────┘ │
                                                    │            │
                                                    ▼            │
                                       ┌────────────────────┐    │
                                       │ OpenAI API         │    │
                                       │ (gpt-4o-mini)      │    │
                                       │ Vision +           │    │
                                       │ Chat Completions   │    │
                                       └────────────────────┘    │
                                                                 │
   ┌─────────────────────────────────────────────────────────────┘
   │
   ▼ Public verification (anon)
   ┌────────────────────────────┐
   │ /permits/:id  → reads      │
   │ permit metadata + audit    │
   │ via anon RLS policies.     │
   │ QR codes link here.        │
   └────────────────────────────┘
```

The architecture has four logical tiers:

1. **Presentation tier** — a React + TypeScript single-page application served by Vite. Two role-aware views: Citizen UI and Government UI. Public landing page and verification page accessible without authentication.
2. **Authorization tier** — Supabase Auth handles session issuance (JWT-based). The frontend `AuthProvider` reads the user's role from the `user_roles` table on session establishment and stores it in React Context.
3. **Data tier** — PostgreSQL with Row-Level Security policies on every table. A single `has_role(role)` SECURITY DEFINER function is used by all role-based RLS checks, ensuring consistency.
4. **Compute tier** — two Supabase Edge Functions (Deno runtime) handle CPU-heavy or third-party-dependent tasks: `generate-permit` produces the PDF + QR code, and `ai-assist` calls the OpenAI API for document classification and reviewer summaries.

### 4.2 Frontend Stack

- **React 18 + TypeScript** for the UI.
- **Vite** for development server and production builds (port 8080 in development).
- **react-router-dom v6** for client-side routing with role-based guards (`ProtectedRoute` wraps every protected route and supports an optional `requiredRoles` prop).
- **TanStack React Query v5** for data fetching and cache management on heavier views (e.g., the developer dashboard).
- **Tailwind CSS 3** with **shadcn/ui** (Radix primitives) for styled components.
- **react-hook-form + zod** for form validation.
- **pdf-lib** + **qrcode** for client-side fallback PDF/QR generation (the production path uses the Edge Function instead).

### 4.3 Backend (Supabase) Stack

- **Auth:** email/password with email confirmation enforced. A Postgres trigger (`on_auth_user_created`) reads the role selected at sign-up from `raw_user_meta_data` and inserts a corresponding row into `user_roles`. Defaults to `CITIZEN` if no role is provided.
- **Postgres:** ten public tables (see Section 5). All have RLS enabled. A `has_role(p_role app_role)` SECURITY DEFINER function provides a single source of truth for role-based authorization.
- **Storage:** a single `documents` bucket holds both citizen uploads (under `applications/{appId}/`) and generated permit PDFs (under `permits/`). RLS policies restrict INSERT and SELECT to authenticated users.
- **Edge Functions:** `generate-permit` (PDF + QR + database update) and `ai-assist` (LLM-based classification and summarization).

### 4.4 AI Integration Layer

The AI integration is implemented as a dedicated Supabase Edge Function (`ai-assist`) deployed alongside the existing `generate-permit` function. Two actions are supported within the same function (multiplexed by an `action` field in the request body):

- `classify_document` — accepts a base64-encoded data URL and an `expected_doc` string (e.g., "ID Card"), then invokes GPT-4o-mini with vision input to determine whether the file matches the expected type. Returns `{ match, actual_type, confidence, notes }`.
- `review_summary` — accepts a structured summary of an application (form fields, document classifications, status, required documents) and asks GPT-4o-mini to produce a 3-5 bullet point reviewer summary covering completeness, document validity, concerns, and a recommended next action.

The OpenAI API key is stored as a Supabase Edge Function secret and is never exposed to the browser. The frontend invokes the Edge Function via `supabase.functions.invoke()`, passing the user's authenticated JWT.

---

## 5. Data Model

The complete production schema consists of ten public tables plus three Postgres enums. Every table has RLS enabled.

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `user_roles` | Role assignments per user | `user_id`, `role` (`app_role` enum) |
| `municipalities` | Municipalities served | `id`, `name`, `contact` |
| `permit_types` | Permit type definitions per municipality | `municipality_id`, `name`, `slug`, `form_schema` JSONB, `required_docs` JSONB |
| `applications` | Submitted applications | `permit_type_id`, `user_email`, `status` (`app_status` enum), `data` JSONB |
| `documents` | Uploaded document metadata | `application_id`, `filename`, `s3_key`, `sha256`, `mime`, `size` |
| `decisions` | Approve/decline/request-info decisions | `application_id`, `decision`, `issued_by`, `s3_key`, `sha256` |
| `audit_log` | Append-only audit trail | `application_id`, `action`, `meta` JSONB, `ip`, `created_at` |
| `permits` | Issued permits | `permit_id`, `application_id`, `status` (`permit_status` enum), `pdf_s3_key`, `pdf_sha256`, `qr_url` |
| `info_requests` | Government requests for additional info from the applicant | `application_id`, `requested_by`, `requested_fields`, `message`, `due_date` |
| `info_request_responses` | Applicant responses to info requests | `request_id`, `application_id`, `user_id`, `updated_fields`, `note` |

**Enums:**
- `app_status`: `SUBMITTED`, `ROUTED`, `CLARIFICATION_REQUESTED`, `DECISION_UPLOADED`, `CLOSED`
- `permit_status`: `PENDING_GENERATION`, `GENERATED`, `REVOKED`
- `app_role`: `ADMIN`, `DEVELOPER`, `CLERK`, `GOVERNMENT`, `CITIZEN`

**Key design decisions:**

- **JSONB for application data.** Applications carry a flexible `data` JSONB column instead of a fixed set of columns. This lets a single `applications` table back many different permit types — each `permit_type` defines its own `form_schema` JSONB describing the fields it expects.
- **JSONB for AI results.** The output of the AI document classifier is stored as `applications.data.ai_results` rather than in a separate column, avoiding a schema migration while still being queryable via Postgres JSON operators.
- **Append-only audit log.** Every sensitive action (submit, route, decision, document upload, info request, AI classification) inserts a new `audit_log` row. The audit log is never updated or deleted in normal operation.
- **SHA-256 in the data model.** Both `documents` and `permits` carry `sha256` (resp. `pdf_sha256`) columns, which the frontend uses to verify integrity on download.

---

## 6. Security Architecture and Threat Model

### 6.1 Authentication and Roles

GovStack uses Supabase Auth (email + password) with email confirmation enforced. At sign-up, the user picks a role (Citizen or Government) via a styled toggle in the sign-up form. The selected role travels in `raw_user_meta_data`. A Postgres trigger (`on_auth_user_created`) fires after every new row in `auth.users`, reads the role from the metadata, and inserts a `user_roles` row.

The frontend `AuthProvider` uses two-source role resolution:

1. Primary: a query against `public.user_roles` filtered by `auth.uid()`.
2. Fallback: the `user_metadata.role` field embedded in the JWT.

The fallback handles the rare case where the database query is delayed or temporarily blocked by RLS — the user still sees the correct dashboard view based on the JWT-embedded role. This dual-source approach was added after observing a race condition where a fresh sign-in produced a brief "wrong dashboard" flash before the database query returned.

### 6.2 Row-Level Security (RLS)

All ten tables have RLS enabled. Policies fall into three categories:

**Citizen-scoped policies** (e.g., on `applications`, `documents`, `decisions`, `audit_log`, `permits`):
- Citizens can SELECT rows tied to their own email or own application.
- Citizens can INSERT rows tied to their own email (e.g., create their own application, upload their own documents).

**Government-scoped policies** (on the same tables):
- `gov_read_all_<table>` (SELECT) — checks `has_role('GOVERNMENT') OR has_role('ADMIN') OR has_role('CLERK')`.
- `gov_update_<table>` / `gov_insert_<table>` / `gov_manage_<table>` for write operations.

**Public/anonymous policies** (only where strictly necessary):
- `public read municipalities` and `public read permit_types` — needed for the citizen browsing flow before login.
- `public_verify_permit` (SELECT on `permits`) — needed for QR-based public verification.
- `public read audit` and `public read documents` — needed by the public verification page to show the audit trail of a verified permit.

The `has_role(p_role app_role)` function is `SECURITY DEFINER` so it bypasses recursive RLS on `user_roles` itself when called from policies. This is the standard Supabase pattern for table-based role checks.

**Migrated policies.** The original developer-only policies in the inherited boilerplate checked `auth.jwt() -> 'app_metadata' ->> 'role' = 'DEVELOPER'`. This is a separate authorization channel from `user_roles` and was inconsistent with the rest of the system. During Week 11, all such policies were rewritten to use `has_role('DEVELOPER')`, unifying the model under a single source of truth.

**Removed policies.** The original boilerplate also included anonymous INSERT policies on `applications`, `documents`, and `audit_log` (i.e., any unauthenticated user could create rows). These were removed during Week 11. Anonymous SELECT on `audit_log` and `documents` was retained because the public QR verification page needs to read these for the audit-trail display.

### 6.3 Document Integrity

Every uploaded document is hashed client-side using the Web Crypto API (`crypto.subtle.digest("SHA-256", ...)`) before it reaches storage. The hash is stored in `documents.sha256` (or `permits.pdf_sha256` for issued permits).

When any user (citizen or government) downloads a document or a permit PDF, the frontend recomputes the SHA-256 of the downloaded blob and compares it to the stored hash. If the hashes differ, the download is blocked and the user is shown a clear warning that the file may have been tampered with.

This control directly addresses the "document tampering after upload" threat in the threat model. It also protects against accidental corruption (e.g., truncated downloads) and supply-chain compromise of the storage layer.

### 6.4 Storage Access

The single `documents` bucket has only two policies:
- `allow authenticated uploads` (INSERT) — any authenticated user can upload.
- `allow authenticated reads` (SELECT) — any authenticated user can download.

Anonymous users cannot upload or download files directly — they must go through the QR verification page, which serves the permit PDF via the public verification flow rather than direct storage access.

### 6.5 Audit Logging

Every significant action produces an immutable row in the `audit_log` table:

- `SUBMITTED` — citizen submits an application
- `ROUTED` — application enters the government queue
- `DOCUMENTS_UPLOADED` — files attached, including AI classification results in the `meta` JSONB
- `DECISION` — government records approve/decline
- `DECISION_UPLOADED` — decision document file attached
- `REQUEST_INFO` — government requests additional information from the citizen
- `USER_SUPPLEMENT` — citizen responds to an info request
- `STATUS_CHANGED` — generic status transition (via the `set_application_status` SQL function)
- `PERMIT_GENERATED` — a permit PDF was issued

Citizens can read their own audit log; government, admin, and clerk roles can read all audit entries; developers can read all audit entries. The audit log is append-only — there is no UPDATE or DELETE policy in either UI or RLS.

---

## 7. Implementation Methodology

### 7.1 Implementation Phases

The project was built incrementally over a single semester (Weeks 5-15), with each two-week period producing a working, deployable increment. The phasing was:

| Weeks | Increment | Outcome |
|-------|-----------|---------|
| W5-W6 | Discovery and architecture | Stakeholder interviews, threat model v1, architecture diagram, project repository |
| W7 | Authentication and routing | Sign-up flow with role selection, Supabase Auth integration, ProtectedRoute, role-aware Header, Citizen and Reviewer page scaffolding |
| W8 | Applicant submission v1 | Apply flow (municipality → permit type → form), document upload to Supabase Storage, client-side SHA-256 hashing, file MIME and size validation |
| W9 | Reviewer queue v1 | Government dashboard with approve/decline/request-info actions, status transitions using the actual `app_status` enum, audit logging, government RLS policies (10 new policies via the `has_role` helper) |
| W10 | Permit issuance | `generate-permit` Edge Function for server-side PDF + QR generation, public `/permits/:id` verification page |
| W11 | Security hardening | Comprehensive RLS audit, removal of dangerous anon INSERT policies, migration of legacy JWT-based policies to `has_role()`, storage policy tightening, RLS enabled on the previously-uncovered `permits` table |
| W12 | Admin configuration | `/gov/admin` page allowing government users to create municipalities and permit types, with a required-documents list shown to citizens during application |
| W13-W14 | AI integration + integrity verification | `ai-assist` Edge Function with `classify_document` and `review_summary` actions, AI verification UI in the citizen application form, AI summary panel in the reviewer details modal, SHA-256 verification on every download (citizen and government) |
| W15 | Final documentation and demo | Architecture v2 diagram, final report, presentation slides, test plan |

### 7.2 Major Engineering Challenges

Several specific challenges were resolved during implementation:

**Race condition in role-based UI.** The original `useAuth` hook stored roles in per-component local state, with a `useEffect` to fetch them on mount. This caused a brief flash where a freshly signed-in user would see the citizen dashboard before the role query resolved and the dashboard switched to the government view. The fix was to lift role state into the `AuthProvider` context and gate the entire `loading` flag on both auth resolution and role resolution. The dual-source resolution (DB primary, JWT metadata fallback) was added to make the experience instantaneous even on slow connections.

**Inconsistent authorization channels.** The inherited project boilerplate used JWT `app_metadata` for developer-only policies, while the application's own role logic used a `user_roles` table. This created a situation where the production database had one set of users with `app_metadata.role = 'DEVELOPER'` (set manually through the Supabase dashboard) and another set with rows in `user_roles`, with no overlap. During Week 11, the JWT-based policies were rewritten to use `has_role()`, unifying the model.

**Status enum drift.** Several constants in the codebase (`pending`, `needs_info`, `approved`, `rejected`, `supplemental_submitted`) referred to status values that did not exist in the actual `app_status` Postgres enum. Any UPDATE setting one of these values would silently fail with a Postgres enum violation. During Week 9, the `constants.ts` file was rewritten to mirror the actual enum (`SUBMITTED`, `ROUTED`, `CLARIFICATION_REQUESTED`, `DECISION_UPLOADED`, `CLOSED`), and all consumers were updated.

**Silent "Request Info" failure.** The `RequestInfoModal` was setting status to `APPLICATION_STATUSES.NEEDS_INFO`, which evaluated to `undefined` after the constants rewrite. The UPDATE silently failed (or partially succeeded with status set to null), so the citizen never saw the "Needs Info" badge or the "Provide Info" button. This was caught during integration testing in Week 13 and fixed to use `CLARIFICATION_REQUESTED`.

**Per-row action button gating.** In the original Government Dashboard, the Approve/Decline/Request-Info buttons were rendered for every row regardless of status. A reviewer testing the system clicked Approve three times on the same application before realizing the action had succeeded the first time but with no visible feedback, creating duplicate decision rows. The fix was twofold: (1) wire toast notifications via the `<Toaster />` component (which had been omitted from `main.tsx`), giving the reviewer immediate feedback; (2) gate the action buttons by status — only `SUBMITTED` and `ROUTED` rows show actions; `DECISION_UPLOADED`, `CLARIFICATION_REQUESTED`, and `CLOSED` rows show a status badge instead.

**AI verification timing.** The first version of the AI document classification ran inside the submit handler — after the citizen clicked "Submit application." The user could see the AI result for a fraction of a second before the page navigated to a confirmation, which defeats the purpose of upfront verification. The fix was to run the classification on dropdown change (when the citizen labels a file as a particular document type), display the result inline before submission, and disable the submit button until either all files pass AI verification or the user explicitly checks an override box.

**Reviewer summary missing required-document context.** The first version of the AI reviewer summary did not have access to the permit type's `required_docs` list — it was passing an empty array. The AI therefore couldn't say "the ID Card and SSN documents are missing." The fix was to include `required_docs` in the application detail query and pass it through to the Edge Function.

---

## 8. AI Integration: LLM-Assisted Document Verification and Reviewer Summaries

### 8.1 Why AI in This System

The project plan originally included only conventional digitization features. After mid-semester feedback emphasizing the value of intelligent automation in workflow systems, the scope was extended (in W13-W14) to include an LLM-based assistance layer.

The goal of the AI integration is not to replace human reviewers — final decisions remain a human responsibility — but to shift two specific kinds of low-value work onto the system:

1. **Plausibility checking on intake.** A citizen who labels a screenshot of a graph as their "ID Card" should be told immediately, not have it discovered by a reviewer days later.
2. **Reviewer summarization.** A reviewer opening a fresh application benefits from a 3-5 line summary highlighting completeness, document validity, and any concerns — drastically faster than reading the entire form and inspecting every uploaded file.

### 8.2 Edge Function Design

The `ai-assist` Edge Function is a single Deno-runtime function deployed to Supabase, exposing two actions multiplexed via an `action` field in the request body. This allows the OpenAI API key to be managed once (as a single Supabase secret) rather than across multiple functions, and it consolidates the OpenAI HTTP client logic.

The function uses GPT-4o-mini for both classification and summarization. GPT-4o-mini is the most cost-effective model in the GPT-4 family that supports vision input, making it appropriate for both tasks at predictable cost (typical cost per application is under $0.005 USD).

The function performs strict input validation, returns structured JSON, and handles error cases with friendly fallbacks. If the OpenAI API is unavailable or returns an error, the Edge Function returns a non-OK response that the frontend treats as "AI assistance unavailable" — the core workflow (submit, review, decide) is unaffected.

### 8.3 Document Classification Flow

When the citizen reaches the document upload step of the application form:

1. The citizen selects files via the standard file input. Each file is validated for MIME type (PDF, JPEG, PNG, WebP, DOC, DOCX) and size (10 MB max) before any further processing.
2. For each file, the citizen picks a document type from a dropdown populated from the permit type's `required_docs`.
3. As soon as a dropdown selection is made, the frontend converts the file to a base64 data URL and invokes `ai-assist` with `action: "classify_document"`.
4. The Edge Function constructs a prompt asking GPT-4o-mini to evaluate whether the attached image matches the claimed document type, and to return strict JSON with `match`, `actual_type`, `confidence`, and `notes`.
5. The frontend displays an inline banner per file: green "✓ AI Verified" if `match: true`, amber "⚠ AI Warning" otherwise, with the AI's notes shown to the citizen.
6. The "Submit application" button is disabled while:
   - Any file is still being verified, or
   - Any file has not been assigned a document type, or
   - Any file has a failed AI classification (unless the citizen explicitly checks an override box acknowledging that a government reviewer will verify manually).

PDFs cannot be visually inspected by the chat completions API, so for PDF inputs the prompt explicitly tells the model to base its judgment on the filename and the expected type. This degraded mode is functional but lower-confidence.

### 8.4 Reviewer Summary Flow

When a government reviewer opens an application's details modal:

1. The application data, document list, and AI classification results (cached from the citizen's upload step in `applications.data.ai_results`) are fetched.
2. An "AI Review Summary" section is rendered with a "Generate Summary" button.
3. On click, the frontend invokes `ai-assist` with `action: "review_summary"`, passing:
   - The permit type name and municipality
   - The applicant's email and current status
   - All form fields
   - All uploaded documents with their AI classifications
   - The list of `required_docs` from the permit type
4. The Edge Function constructs a prompt asking GPT-4o-mini to produce 3-5 bullet points covering completeness, document validity, concerns, and a recommended next action — explicitly instructing the model not to make a final decision.
5. The summary is rendered in the modal alongside the existing application details. The reviewer can regenerate the summary if they want a fresh perspective.

### 8.5 Cost and Reliability Considerations

- **Caching.** AI classifications are run once at upload time and persisted in `applications.data.ai_results`. The reviewer summary uses the cached classifications rather than re-running them, so the per-application cost stays low even if a reviewer opens the same application multiple times.
- **Cost ceiling.** With GPT-4o-mini at typical token usage, a single application with 3-4 documents costs approximately $0.002-0.005 USD end-to-end (classification + summary).
- **Graceful degradation.** If the OpenAI API is down, the citizen still submits successfully (without an AI verification banner) and the reviewer still sees the application (without an AI summary). No core workflow path depends on AI being available.
- **Key isolation.** The OpenAI API key is stored as a Supabase Edge Function secret. The browser never sees it. Even if the frontend bundle is fully reverse-engineered, the key cannot be extracted.

---

## 9. Evaluation and Results

### 9.1 Functional Evaluation

The platform was tested end-to-end through the following user journeys:

**Citizen journey.**
- Sign up with role "Citizen" → email confirmation → sign in → dashboard shows Citizen view with "Start application" and "My permits" cards.
- Browse municipalities → select Municipality A → see three permit types (Construction Permit, Business License, Event Permit) → select Construction Permit.
- Fill the form. Required documents (configurable by government admins via `/gov/admin`) are shown above the file upload as a checklist.
- Upload a document, label it via the dropdown. AI verification runs immediately and shows feedback. Submit.
- See the application in "My permits" with status "Pending" (mapped from `SUBMITTED` / `ROUTED`).
- After government action, see the status update to "Approved" / "Declined" / "Needs Info" with the corresponding download or "Provide Info" actions.

**Government journey.**
- Sign in as a Government user → dashboard shows Government view with "Review Queue" and "Applications Database" cards.
- Open the Review Queue. All applications are visible (RLS allows GOVERNMENT/ADMIN/CLERK to read all rows). Action buttons appear only on actionable rows (`SUBMITTED` or `ROUTED`); other rows show a status badge.
- Click into an application's details modal. See the AI Review Summary panel; click "Generate Summary" → receive a structured 3-5 bullet summary.
- Approve, Decline, or Request Info. Each action produces a toast notification and a fresh row in `audit_log`.
- Visit `/gov/admin` to create a new municipality or a new permit type with a custom required-documents list.

**Public verification journey.**
- Scan the QR code on a generated permit PDF (or visit `/permits/:permit_id` directly).
- The verification page loads without authentication and displays the permit's status (Generated / Revoked), municipality, permit type, issue date, and the audit trail. No private documents are exposed.

### 9.2 Security Evaluation

The following security tests were performed:

| Test | Expected Behavior | Observed |
|------|-------------------|----------|
| Citizen accesses `/gov` via direct URL | Redirected to `/dashboard` (UI guard) | ✅ Pass |
| Citizen queries another user's application via REST | Returns empty (RLS) | ✅ Pass |
| Anonymous user attempts INSERT into `applications` | Blocked (no anon INSERT policy) | ✅ Pass |
| Upload a `.exe` file | Blocked client-side (MIME whitelist) | ✅ Pass |
| Upload a 50 MB file | Blocked client-side (size limit) | ✅ Pass |
| Tamper with a stored permit PDF (via service role), download as citizen | Integrity check fails, download blocked with warning | ✅ Pass |
| Confirm `OPENAI_API_KEY` is not in client bundle | Confirmed (only in Edge Function env) | ✅ Pass |
| Confirm `permits` table has RLS enabled | Confirmed (W11) | ✅ Pass |
| Confirm no anon INSERT policies remain | Confirmed (W11) | ✅ Pass |

### 9.3 Performance Evaluation

The system has been tested informally (no formal load testing) with the following characteristics:

- **Login latency:** ~300ms median (Supabase Auth + role fetch).
- **Application form load:** ~250ms (municipality + permit type + required_docs queries in parallel).
- **AI document classification:** ~1.5-3 seconds per file (dominated by OpenAI API latency).
- **AI reviewer summary:** ~2-4 seconds (cached classifications, single OpenAI call).
- **Permit PDF generation:** ~1-2 seconds (Edge Function does the work; client triggers it on demand).
- **Public verification page load:** ~150ms (simple read from `permits` and `audit_log`).

Production deployment to Supabase's managed infrastructure means storage, database, and edge functions all scale horizontally without code changes.

---

## 10. Conclusion

GovStack is a working, deployable digital permit platform that addresses a real-world enterprise problem: the slow, paper-heavy, low-trust process of obtaining permits in many municipalities. The system was built end-to-end in a single semester, going beyond a pure CRUD application to include:

- **Workflow configurability** — government admins can define new permit types and required-document lists without writing code.
- **Defense in depth** — UI route guards backed by database-level Row-Level Security on every table, with a single helper function (`has_role`) as the source of truth for role checks.
- **Document integrity** — SHA-256 hashing on upload, automatic verification on download, with mismatches blocking the operation.
- **Tamper-evident permits** — generated PDFs carry hashes and QR codes resolving to a privacy-preserving public verification endpoint.
- **LLM-assisted workflows** — document classification at intake (catching mismatches before they reach a reviewer) and reviewer summarization (cutting review time without removing reviewer authority).

The architecture decisions taken — Supabase as the integrated backend, RLS as the authorization spine, JSONB for flexible per-permit-type form data, an Edge Function-based AI layer — produced a system that is both extensible (new permit types are configuration changes) and secure (every database query is gated, every download is integrity-checked).

---

## 11. Future Work

Several enhancements would push GovStack from a course project into a production-ready platform:

- **Multi-tenant scoping.** Currently every government user sees every application across all municipalities. A real deployment would scope government users to specific municipalities (e.g., a `municipality_id` column on `user_roles`). This is straightforward to add — the RLS pattern is already in place.
- **Email notifications.** When the status of an application changes, the citizen should receive an email. A future iteration would add a Supabase Edge Function plus a transactional email service (e.g., Resend) and trigger it from `audit_log` insertions for specific actions.
- **Signed URL access for documents.** Currently any authenticated user can read any file in the `documents` bucket. A more restrictive scheme would issue short-lived signed URLs and tie access to specific applications.
- **Form schema-driven application form.** Each `permit_type` has a `form_schema` JSONB column that is currently unused. A future version would render the application form dynamically based on this schema, allowing admins to configure not just required documents but also the form fields themselves.
- **Stage-based review.** The current model has a single review stage. A future version would support multi-stage review (e.g., Intake Clerk → Reviewer → Supervisor) with role-specific transitions.
- **OCR + structured data extraction.** Beyond classifying that an upload is "an ID card," a more advanced AI layer could extract the name, date of birth, and ID number from the document and auto-fill the application form.
- **Production observability.** Logging is currently audit-focused. A production deployment would add structured application logs, error tracking (e.g., Sentry), and performance monitoring.

---

## 12. Deliverables

**Source code:** https://github.com/howayek/Permits

**Final deliverables directory** (in this repository): `final-deliverables/`
- `Final_Report.md` — this document
- `Presentation_Slides.md` — slide-by-slide content for the 12-15 minute presentation video
- `Demo_Instructions.md` — step-by-step instructions for running a live demo
- `User_Guide.md` — end-user guide for citizens and government staff
- `Design_Document.md` — architecture and data model reference
- `Test_Plan.md` — functional and security test plan with results
- `README.md` — index of all deliverables

**Checkpoint documentation** (in this repository): `docs/checkpoint1/` through `docs/checkpoint5/`
- Five checkpoint reports tracking progress from W5 through W15
- `architecture_v1.md` (initial) and `checkpoint5/architecture_v2.md` (final with AI integration)

**Live system:** Application runnable locally on `http://localhost:8080` with a configured Supabase project. See `INSTRUCTIONS.md` and `README.md` in the repository root.

**Deployed infrastructure:**
- Supabase project with two Edge Functions deployed (`generate-permit`, `ai-assist`)
- Database with all RLS policies and helper functions in place
- Storage bucket configured

---

## 13. Skill Learning Report

The semester produced several meta-skills, summarized below in the spirit of the course's emphasis on transferable learning rather than narrow technical know-how:

### 13.1 Trend Recognition and Architecture Anticipation

The most important skill developed in this project was the ability to recognize where existing patterns were converging on something better, and to design for that convergence rather than what is most expedient.

A concrete example: the original boilerplate used two parallel authorization channels — JWT `app_metadata` for some role checks and a `user_roles` table for others. The expedient choice would have been to leave this in place and add new policies in whichever style was more convenient. Instead, recognizing that the industry trend in Supabase deployments is unequivocally toward table-based role checks via `SECURITY DEFINER` helper functions (because they support real-time role changes, are auditable, and don't depend on JWT refresh cycles), all policies were unified under a single `has_role()` helper. This produced a system that is consistent, easy to reason about, and easy to extend.

A second example: the AI integration was added in response to mid-semester feedback. The immediate temptation was to add a few one-off OpenAI API calls scattered through the frontend. Instead, recognizing that AI-assisted workflows are an emerging pattern that will likely be reused, the integration was structured as a dedicated Edge Function (`ai-assist`) with multiple actions multiplexed by a single secret. This makes adding a third or fourth AI action trivial and keeps the OpenAI key isolated to a single boundary.

### 13.2 Defense in Depth and Threat-Driven Design

This project required treating security not as a feature added at the end but as a property of every layer. The Row-Level Security audit in Week 11 was particularly instructive. Going through every public table and asking "which roles can read, which can write, what is the citizen-scoped policy, what is the government-scoped policy, what is the public-scoped policy" forced a rigor that reading a security textbook never could.

The skill developed here is not "I know how to write RLS policies." It is "I can take a threat model — for example, document tampering — and trace it through the entire stack to see how each layer responds." For document tampering specifically: the storage layer doesn't and shouldn't know whether bytes are valid; the database layer stores the hash; the frontend recomputes it on download; if the hashes differ, the download is blocked. Every layer has a role, and the failure of any one layer is caught by another.

### 13.3 Iterative Scope Management Under Real Feedback

The project plan defined at the start of the semester did not include AI integration. After Week 12, mid-semester feedback recommended incorporating intelligent automation. The choice was either to defer (and ship a strictly less ambitious project) or to absorb the feedback and re-scope.

The skill developed here is in deciding what to absorb and what to leave for future work. The feedback was concrete — "use LLMs for document verification" — but the implementation could have ranged from a token mention in the architecture document up to a full multi-stage AI pipeline. The chosen scope was a single Edge Function with two actions, both touching real user-facing surfaces (the citizen upload form and the reviewer details modal). This delivered something demonstrable in two weeks without delaying the security hardening or admin configuration milestones already in flight.

### 13.4 Differentiating Facts from Marketing

In writing the five checkpoint reports and this final report, a recurring question was: when is "we built X" honest, and when is it inflation? The discipline of checking every claim against runnable code or verifiable database state — does this RLS policy actually exist? does this Edge Function actually deploy and respond? — forced a level of factual precision that benefits the reader and protects against later surprises during the demo.

A specific example: the original CHKPT-3 plan claimed permit issuance was "validated end-to-end." When this was actually traced through the code, it became clear that one issuance path (the client-side `PermitGenerationService`) had a column-name bug that would crash on use, while the other path (the `generate-permit` Edge Function) worked correctly. The factual statement is "the Edge Function path is validated; the client-side fallback is not in active use and has a known bug." That distinction made it into the documentation.

### 13.5 Cyber-Physical Gap

This project narrows the cyber-physical gap in two specific ways:

1. **Replacing in-person visits with online submission.** A citizen who would otherwise drive to the municipal office and stand in line can now submit from a phone. This is the most obvious gap-closing.
2. **Replacing manual paper-based verification with cryptographic verification.** A third party who needs to verify a permit no longer has to phone the municipality and ask whether a particular paper document is genuine — they can scan a QR code. The cyber side (cryptographic hash + database lookup) substitutes for the physical side (manual records check).

The skill developed here is recognizing where physical-world processes can be replaced with cyber-side equivalents that are faster, cheaper, and more auditable, without losing the human accountability that those processes were originally designed to provide.

### 13.6 Reading Convoluted Specifications

The Postgres documentation on Row-Level Security, the Supabase documentation on Edge Functions and their secret management, and the OpenAI Chat Completions API reference are all written in a style that assumes the reader already knows what they want and is just looking up syntax. Building a working integration on top of all three required reading each spec, identifying the parts that were actually relevant, and combining them into a coherent design.

This skill is broadly transferable. Industry rarely hands you a tutorial — it hands you reference documentation and an unspecified problem.

### 13.7 Communicating Architecture Visually

Producing a single architecture diagram that fits on one page and is understandable to a non-technical stakeholder is harder than it looks. The first draft of the architecture diagram (`architecture_v1.md`) had eight boxes and confusing arrows. The final version (`architecture_v2.md`) has roughly the same content but organized into four logical tiers (browser, Supabase, OpenAI, public verification) with explicit data flows.

The skill is condensation: stripping away everything that isn't load-bearing for understanding while keeping the diagram accurate enough to use as a reference during implementation.

---

## 14. References

The architectural and security patterns used in this project are documented in:

- PostgreSQL Documentation. Row Security Policies. https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Supabase Documentation. Row Level Security. https://supabase.com/docs/guides/auth/row-level-security
- Supabase Documentation. Edge Functions. https://supabase.com/docs/guides/functions
- OpenAI API Reference. Chat Completions. https://platform.openai.com/docs/api-reference/chat
- OpenAI Documentation. Vision (image inputs). https://platform.openai.com/docs/guides/vision
- W3C / WHATWG. Web Crypto API — SubtleCrypto.digest(). https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
- React Documentation. Context. https://react.dev/learn/passing-data-deeply-with-context
- shadcn/ui. Component library. https://ui.shadcn.com/
- Vite Documentation. https://vitejs.dev/

The OWASP Top 10 (2021) — particularly Broken Access Control (A01) and Cryptographic Failures (A02) — informed the threat model and the controls implemented in Section 6. The audit logging design draws on the principle of immutable append-only logs as a foundation for non-repudiation.
