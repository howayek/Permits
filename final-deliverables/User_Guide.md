# GovStack — User Guide

This guide explains how to use the GovStack platform from the perspective of each end-user role:

- [For Citizens](#for-citizens) — apply for a permit, track status, download issued permits.
- [For Government Staff](#for-government-staff) — review applications, request more info, approve or decline, manage the catalog.
- [For Anyone (Public Verification)](#for-anyone-public-verification) — verify whether a permit is genuine.

---

## For Citizens

### Creating an account

1. Go to the homepage and click **Sign in** (or any link that requires login).
2. Click **New here? Create an account**.
3. Fill in:
   - **Full name** — appears on your permits.
   - **Role** — select **Citizen**.
   - **Email** — must be valid; you'll receive a confirmation email.
   - **Password** — at least 6 characters.
4. Click **Create account**. You'll see a confirmation screen.
5. Check your inbox and click the confirmation link.
6. Return to the sign-in page and sign in.

### Applying for a permit

1. From the dashboard, click **Start application**.
2. Choose your **municipality**.
3. Choose the **permit type** you want to apply for. Each permit type lists its required documents at the top of the application form.
4. Fill in:
   - Personal info (name, email, phone, preferred language)
   - Permit-specific fields (e.g., plot number, project description)
5. Upload your documents:
   - Click **Choose Files** and select all your documents at once.
   - For each file, **pick the document type from the dropdown** (e.g., "ID Card", "Property Deed").
   - Wait a moment for the AI verification banner to appear.
   - Green ✓ AI Verified — your file matches the document type.
   - Amber ⚠ AI Warning — the file doesn't appear to match. You can either re-pick the correct type, or check the "I want to submit anyway" override box.
6. When all files are verified (or overridden), click **Submit application**.
7. You'll see "Creating application…" and "Uploading file… of N…" progress messages.
8. After successful submission, you'll be redirected to the homepage with a confirmation toast.

### Tracking your applications

1. Click **My Permits** in the header.
2. The table shows all your applications with their current phase:
   - **Pending** — submitted, awaiting government review.
   - **Needs Info** — government has requested more information from you.
   - **Approved** — your application has been approved.
   - **Declined** — your application has been declined.
3. Use the tabs at the top to filter by phase.

### Responding to a "Needs Info" request

If government staff requested more information:

1. In **My Permits**, find the application with the orange "Needs Info" badge.
2. Click the **Provide Info** button on that row.
3. You'll see:
   - The fields the reviewer wants you to clarify.
   - The reviewer's instructions.
   - A due date (if specified).
4. Add supplemental text and/or attach additional files.
5. Click **Submit Information**.

After submission, your application returns to the review queue.

### Downloading your approved permit

When your application is approved:

1. In **My Permits**, find the row with the green "Approved" badge.
2. If a permit PDF has been generated:
   - Click **Download**.
   - The file downloads to your computer with **integrity verification** — a toast confirms the file's hash matches the recorded value.
3. If no PDF exists yet:
   - Click **Generate PDF**.
   - The system generates a permit PDF with an embedded QR code.
   - The PDF is then downloadable.

### Viewing the QR verification page

You can scan the QR code on your permit PDF, or open the link directly. The QR resolves to `https://your-instance/permits/PMT-2026-NNNNNN` and shows:

- The permit's status (Generated, Revoked).
- The municipality and permit type.
- The issue date.
- An audit trail of major events.

Anyone with the link can view this page — no login required. This is intentional, because verification is a use case that needs to work across organizational boundaries (e.g., for inspectors, banks, or other agencies).

---

## For Government Staff

### Creating a Government account

1. Go to the homepage and click **Sign in**.
2. Click **New here? Create an account**.
3. Fill in:
   - **Full name**
   - **Role** — select **Government**.
   - **Email** — must be a valid government email (no special validation, but use one that distinguishes you from citizens).
   - **Password**
4. Click **Create account** and confirm your email.
5. Sign in.

### Government Dashboard

After sign-in, your dashboard shows:

- **Review Queue** — applications awaiting your decision.
- **Applications Database** — searchable database of all applications (any status).
- **Admin Configuration** — manage municipalities and permit types.

### Reviewing an application

1. Click **Review Queue**.
2. The table shows all applications. Apply filters as needed:
   - Search by ID, email, or permit type.
   - Filter by permit type.
   - Show only "pending" (SUBMITTED or ROUTED) applications.
3. **Action buttons** appear only for actionable rows:
   - **Approve** — approves the application and triggers permit PDF generation.
   - **Decline** — rejects the application.
   - **Request info** — opens a modal to ask the citizen for clarification.
4. For non-actionable rows, you'll see a status badge:
   - "Awaiting citizen" (CLARIFICATION_REQUESTED)
   - "Decision recorded" (DECISION_UPLOADED)
   - "Closed" (CLOSED)
5. Click anywhere on a row (other than action buttons) to open the **Details Modal**.

### The Details Modal

The Details Modal shows:

- **Applicant** — name, contact info, email.
- **Application Details** — all form fields submitted.
- **AI Review Summary** — click "Generate Summary" to get a 3-5 bullet AI-generated summary covering completeness, document validity, concerns, and a recommended next action. This is **advisory only** — you make the final decision.
- **Files** — every uploaded document with:
  - Filename, size, MIME type
  - The document type the citizen claimed it was
  - The AI's verdict (✓ verified or ⚠ flagged) with confidence percentage
  - A **View** button — downloads and verifies SHA-256 integrity before opening.
- **Upload decision document** — attach an official decision PDF (e.g., a stamped approval letter).
- **Request Additional Information** — opens the same modal as the queue's "Request Info" button.
- **Audit / Events** — a chronological list of every action on this application: SUBMITTED, ROUTED, DOCUMENTS_UPLOADED, DECISION, REQUEST_INFO, USER_SUPPLEMENT, etc.

### Approving an application

1. From the queue or the details modal, click **Approve**.
2. Watch the button briefly show "…" while the operation runs.
3. A toast appears: "Application Approved — Decision recorded for application…"
4. The status updates to DECISION_UPLOADED. The action buttons are replaced by a "Decision recorded" badge.
5. The citizen now sees the application as "Approved" in their My Permits view.
6. The citizen can generate and download the permit PDF.

### Declining an application

Same flow as Approve, but click **Decline** instead. The citizen sees the application as "Declined."

### Requesting information from an applicant

1. Click **Request info** (or the "Request Additional Information" button in the details modal).
2. The Request Info modal opens. Fill in:
   - **Select Fields to Request** — pick which form fields the citizen needs to clarify. Each is shown with its formatted label.
   - **Instructions for Citizen** — free text. Be specific. You can include examples or links.
   - **Due Date** (optional) — pick a date.
   - **Requires new documents** — check if the citizen needs to upload additional files.
3. Click **Send Request**.
4. The application's status changes to CLARIFICATION_REQUESTED.
5. The citizen sees an orange "Needs Info" badge in their My Permits with a **Provide Info** button.

When the citizen submits supplemental info, the application returns to the queue (status ROUTED) for your review.

### Searching the Applications Database

1. Click **Applications** in the header (or "Open database" on the dashboard).
2. Filter by:
   - Free-text search (ID, email, or permit type).
   - Municipality name.
   - Permit type name.
   - Status (all enum values: SUBMITTED, ROUTED, CLARIFICATION_REQUESTED, DECISION_UPLOADED, CLOSED).
3. Click any row to open the Details Modal (same as the Review Queue).

### Admin: Managing Municipalities and Permit Types

1. Click **Admin** in the header (or "Open admin" on the dashboard).
2. The Admin Configuration page has two sections.

**To create a municipality:**
- Enter a name (e.g., "Beirut Municipality").
- Optionally enter a contact email or phone.
- Click **Create Municipality**.
- It immediately appears in the list below.

**To create a permit type:**
- Select a municipality.
- Enter a name (e.g., "Demolition Permit").
- Optionally enter a slug (otherwise it's auto-generated from the name).
- Enter required documents as a comma-separated list (e.g., "Demolition Plan, Site Survey, Insurance Certificate").
- Click **Create Permit Type**.

The new permit type is immediately available to citizens. The required-documents list:
- Is shown as a checklist on the citizen's application form.
- Powers the dropdown next to each uploaded file.
- Is passed to the AI for verification and reviewer summaries.

---

## For Anyone (Public Verification)

### Verifying a permit

You don't need an account to verify a permit. There are two ways to access the verification page:

**Option 1: Scan the QR code**
- Use any QR scanner app on your phone. Point it at the QR code on the permit PDF.
- Your phone opens the verification page in its browser.

**Option 2: Open the URL directly**
- Find the permit ID on the PDF (e.g., `PMT-2026-000007`).
- Open `https://your-instance/permits/PMT-2026-000007` in any browser.

### What you'll see

The verification page displays:

- **Verification status** — "Generated" (valid), "Revoked," or "Pending Generation."
- **Permit ID** — the unique identifier.
- **Municipality** — which municipality issued it.
- **Permit type** — what kind of permit.
- **Issue date** — when it was issued.
- **Owner** — the person/entity the permit was issued to (if recorded).
- **Audit trail** — major events in the application's lifecycle (submitted, decided, generated).
- **A "Download Official PDF" button** — lets you grab the canonical PDF.

### What you WON'T see

The verification page does NOT show:
- The applicant's full address, phone number, or other PII.
- The contents of the application form.
- The applicant's uploaded source documents.

This is by design. Verification is meant to confirm authenticity, not expose private data.

### What "verification" means in this context

- The permit ID exists in the system's database.
- The status (Generated / Revoked) is current.
- The audit trail shows the legitimate workflow happened (submitted → reviewed → approved → generated).
- The downloadable PDF carries a SHA-256 hash that matches what's recorded in the database.

This is sufficient to confirm that the permit holder didn't fabricate the document. It is NOT a substitute for cross-checking the issuing authority's identity (i.e., that the municipality is who they say they are) — that's a separate trust relationship outside the scope of GovStack.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Sign-up email not received | Email confirmation enabled but spam folder | Check spam; resend from the sign-in page if needed |
| "Loading…" forever after sign-in | Network issue or Supabase down | Refresh the page; check browser console for errors |
| Can't see Government links after sign-up | Role not assigned (trigger may have failed) | Contact admin to manually insert the row in `user_roles` |
| AI verification doesn't appear | OpenAI API down or key missing | The application can still be submitted without AI; in production this should be reported to support |
| "Integrity check failed" on download | Stored file corrupted or tampered | Contact support; the file should be re-issued or re-uploaded |
| Permit PDF won't generate | Edge function down or permit data incomplete | Try again; if persistent, contact support |
| Can't access `/gov/admin` | Account doesn't have ADMIN or GOVERNMENT role | Contact admin |
