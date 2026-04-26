# GovStack — Demo Instructions

This document walks the reviewer (or anyone running the demo) through a full end-to-end demonstration of the GovStack platform. Each section below corresponds to a real user journey.

**Estimated demo time:** ~5-6 minutes for the full happy path.

---

## 0. Prerequisites for Running the Demo

### 0.1 Local environment

1. Clone the repository: `git clone https://github.com/howayek/Permits.git`
2. Install dependencies: `npm install`
3. Copy environment template: `cp env.example .env.local`
4. Fill in `.env.local` with your Supabase credentials:
   ```bash
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```
5. Start the dev server: `npm run dev`
6. Open `http://localhost:8080`

### 0.2 Supabase project requirements

The Supabase project must have:

- All ten public tables created (`user_roles`, `municipalities`, `permit_types`, `applications`, `documents`, `decisions`, `audit_log`, `permits`, `info_requests`, `info_request_responses`).
- The three Postgres enums (`app_status`, `permit_status`, `app_role`).
- The `has_role()` SECURITY DEFINER function and the `handle_new_user()` trigger function.
- All RLS policies (see `final-deliverables/Design_Document.md` for the full list).
- Both Edge Functions deployed: `generate-permit` and `ai-assist`.
- The `OPENAI_API_KEY` secret set on the project.
- At least one row in `municipalities` and one row in `permit_types` (or use the Admin page to create them during the demo).

### 0.3 Test accounts

Have ready (sign up beforehand if needed):

| Email | Role | Purpose |
|-------|------|---------|
| `citizen.demo@example.com` | CITIZEN | For the citizen journey |
| `gov.demo@example.com` | GOVERNMENT | For the government journey |

Both should have email-confirmed accounts. The role is selected at sign-up via the dropdown.

### 0.4 Demo files to have ready

Prepare two image files on the demo machine:

- `id-card-real.png` — a clearly recognizable mock ID card image (placeholder text is fine, e.g. a screenshot of a driver's license template).
- `random-graph.png` — any irrelevant image, e.g., a screenshot of a graph or a meme.

These will be used to demonstrate the AI document classification.

---

## 1. Demo Script

### Step 1: Public landing page (≈20s)

1. Open `http://localhost:8080` in an incognito window.
2. **Show:** the landing page with the four feature cards (Submit Application, Track Progress, Secure Processing, Government Review).
3. Click "Get Started" → notice you're redirected to `/auth/login` (because the dashboard is a protected route).

**Talking point:** The landing page is public. Anyone can visit. The protected routes (dashboard, my-permits, gov, etc.) require authentication.

---

### Step 2: Sign up as a Citizen (≈30s)

1. On `/auth/login`, click "New here? Create an account."
2. **Show:** the sign-up form with the role picker (Citizen / Government). Role selection is the first thing.
3. Fill in:
   - Full name: e.g., "Demo Citizen"
   - Role: Citizen (the default)
   - Email: a fresh email
   - Password: 6+ chars
4. Submit. **Show:** the styled "Check your email" confirmation card (not a browser alert).

**Talking point:** Role is captured at sign-up and travels in the user's metadata. A Postgres trigger reads it and inserts a row into `user_roles`. This is the single source of truth for the user's permissions everywhere — frontend AND database RLS policies.

(For the demo, sign in instead with the pre-existing `citizen.demo@example.com` account so we don't have to wait for email confirmation.)

---

### Step 3: Citizen Dashboard (≈15s)

1. After sign-in, you land on `/dashboard`.
2. **Show:** the citizen view: "Welcome, Demo Citizen" + two cards: "Start a new application" and "My permits."
3. **Show:** the header has "Apply", "My Permits", "Dashboard", "Sign out" — but NOT "Government Portal" or "Admin." Role-aware UI.

**Talking point:** The header and dashboard adapt to the user's role. A citizen never sees government links.

---

### Step 4: Submit an application (≈90s)

1. Click "Start application" → land on `/apply`.
2. **Show:** the list of municipalities loaded from the database (this query is public — anyone, even unauthenticated, can browse what permits exist).
3. Click "Municipality A" → see permit types.
4. Click a permit type that has required documents configured (e.g., one created via the Admin page in Step 9 below — for the demo, prepare one in advance with required docs `["ID Card", "Property Deed"]`).
5. **Show:** the application form. Above the file upload, there's a clear "Required Documents" checklist showing what's expected.
6. Fill in: full name, email, phone, plot number, description.
7. **Click "Choose Files"** and select TWO files:
   - `id-card-real.png`
   - `random-graph.png`
8. **For the first file** (`id-card-real.png`): pick "ID Card" from the dropdown.
   - Within ~2 seconds: green "✓ AI Verified" banner appears with the AI's notes.
9. **For the second file** (`random-graph.png`): pick "Property Deed" from the dropdown.
   - Within ~2 seconds: amber "⚠ AI Warning" banner appears explaining the file does not look like a Property Deed and what it actually appears to be.
10. **Show:** the submit button is disabled. A bullet list under the form explains why ("1 file(s) flagged by AI. Re-pick the correct type or check the override box.").
11. **Option A — re-pick:** Change the dropdown for `random-graph.png` to a correct value or remove the file. Submit becomes enabled when verification passes.
12. **Option B — override:** Check the override box ("I understand the AI flagged some of my documents but I want to submit anyway. A government reviewer will verify them manually."). Submit becomes enabled.
13. Click "Submit application." Watch the upload progress: "Creating application…" → "Uploading file 1 of 2…" → "Uploading file 2 of 2…"
14. Get redirected to home with a success toast.

**Talking points:**
- AI verification runs as soon as the citizen labels a file — BEFORE submission.
- Submit is gated until verification passes or is explicitly overridden.
- AI is advisory; the override checkbox respects citizen autonomy.
- All files are SHA-256 hashed client-side and the hashes are stored alongside the storage keys.

---

### Step 5: My Permits view (≈30s)

1. Click "My Permits" in the header → land on `/my-permits`.
2. **Show:** the new application appears in the "All" tab with status "Pending."
3. **Show:** the Municipality column displays "Municipality A" (the readable name), not a UUID. Joined query through `permit_types` → `municipalities`.

**Talking point:** Citizens only see their own applications. RLS at the database level enforces this — even a direct API call as the citizen, bypassing the UI, would return only their own rows.

---

### Step 6: Government Sign-In (≈15s)

1. Sign out (button in the header, only visible when logged in).
2. Sign in with the government account: `gov.demo@example.com`.
3. **Show:** the dashboard now reads "Government Dashboard" with two cards: "Review Queue" and "Applications Database."
4. **Show:** the header now has "Review Queue", "Applications", "Admin" — but NOT "Apply" or "My Permits."

**Talking point:** Same Header component, completely different navigation. Driven entirely by the role from `user_roles`.

---

### Step 7: Review Queue + AI Summary (≈90s)

1. Click "Open review queue" or "Review Queue" in the header.
2. **Show:** the new application from Step 4 is in the queue. Status: SUBMITTED.
3. **Show:** the action buttons (Approve / Decline / Request info) appear ONLY for actionable rows. Older rows with status DECISION_UPLOADED show a blue "Decision recorded" badge instead.
4. Click on the row to open the **details modal**.
5. Show the modal sections in order:
   - **Applicant** (name, contact, email)
   - **Application Details** (form fields)
   - **AI Review Summary** panel with a "Generate Summary" button.
6. Click "Generate Summary."
7. Within ~3 seconds, see a 3-5 bullet AI-generated summary covering:
   - Completeness
   - Document validity (per-document AI verdict)
   - Concerns / missing items
   - Recommended next action
8. Scroll to the **Files** section. **Show:** each file has its AI classification badge (green ✓ verified or amber ⚠ flagged).
9. Click "View" on a file → integrity check happens behind the scenes → file opens.
10. Close the modal.

**Talking points:**
- AI summary uses CACHED classifications from the citizen's upload step — we don't re-run OpenAI vision per modal open. Cost stays low.
- The summary explicitly does NOT make a final decision. The reviewer's job is preserved.
- Required documents (from `permit_types.required_docs`) are passed into the prompt so the AI can flag genuinely missing docs.

---

### Step 8: Approve and verify (≈45s)

1. Back in the review queue, click "Approve" on the row.
2. Toast notification appears: "Application Approved — Decision recorded for application…"
3. **Show:** the row's status updates from SUBMITTED → DECISION_UPLOADED.
4. The action buttons disappear; a blue "Decision recorded" badge appears instead.
5. Sign out, sign back in as the citizen.
6. Go to "My Permits."
7. **Show:** the application's status is now "Approved" with a green badge.
8. Click "Generate PDF" (or it may auto-generate via the Edge Function).
9. After the PDF is generated, click "Download."
10. **Show:** a toast confirming "Integrity verified — SHA-256 hash matches the recorded value."

**Talking points:**
- Status changes are visible to the citizen in real time.
- Permit PDF generation runs in the Edge Function — server-side, with the QR code embedded.
- Every download verifies SHA-256 against the stored hash.

---

### Step 9: QR Verification (Public) (≈30s)

1. Open the downloaded PDF. Show the QR code.
2. Scan it with a phone (or copy the URL inside the PDF) → it links to `http://localhost:8080/permits/PMT-2026-NNNNNN`.
3. Open that URL **in an incognito window** (no login).
4. **Show:** the public verification page. Permit ID, status (GENERATED), municipality, type, issue date, audit trail.
5. **Show:** the page does NOT expose private documents or PII beyond what's needed for verification.

**Talking points:**
- This is the bridge between cyber and physical. A third party (e.g., a building inspector, a buyer) can verify the permit without phoning the municipality.
- The page reads through anonymous RLS policies — only minimal fields are accessible.
- IDs are non-sequential UUIDs / random tokens to prevent enumeration.

---

### Step 10: Admin Configuration (Optional, ≈45s)

1. Sign back in as government.
2. Navigate to `/gov/admin` (or click "Admin" in the header).
3. **Show:** the Admin Configuration page with two sections.
4. Create a new municipality: enter a name and a contact, click "Create Municipality."
5. **Show:** it appears in the existing list immediately.
6. Create a new permit type:
   - Select the new municipality.
   - Name: e.g., "Demolition Permit"
   - Slug: leave blank (auto-generated from name)
   - Required documents: e.g., `Demolition Plan, Insurance Certificate`
7. Click "Create Permit Type."
8. **Show:** it appears in the list.
9. Sign out, sign in as citizen, navigate to `/apply`.
10. **Show:** the new municipality appears. Click into it. **Show:** the new permit type appears with its required-documents list ready for use.

**Talking points:**
- This is Deliverable D1 — workflow-configurable permit types.
- Government users add new permit types as data, not as code.
- The required-documents list flows directly into the citizen's experience and into the AI verification prompts.

---

## 2. Demo Cleanup

After the demo:

1. Sign out from all browser windows.
2. (Optional) Delete the demo application via SQL: `DELETE FROM applications WHERE user_email = 'citizen.demo@example.com';` (cascade handles the related rows).
3. (Optional) Delete the test municipalities and permit types created in Step 10 if you want a clean state.

---

## 3. Common Demo Issues and Fixes

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| AI verification banner never appears | OpenAI API key not set on Supabase | Add `OPENAI_API_KEY` as a Supabase Edge Function secret |
| AI verification fails with "function not found" | Edge function not deployed | `supabase functions deploy ai-assist` (or via the Dashboard) |
| Citizen can't see their own application | RLS denying SELECT | Verify `user_roles` row exists for the citizen with role `CITIZEN` |
| Government can't see any applications | RLS denying SELECT for gov | Verify `user_roles` row exists with role `GOVERNMENT`, `ADMIN`, or `CLERK` |
| Dev server starts on `:8081` instead of `:8080` | Stale node process holding `:8080` | `lsof -ti:8080 \| xargs kill -9` then restart |
| Submit button stays disabled even after override | All required-docs assignments must still be made | Ensure each file has a doc type selected; only the AI failures can be overridden, not the missing-type errors |
| QR verification page returns 404 | Permit row missing or RLS misconfigured | Confirm the permit row exists in `permits` and `public_verify_permit` policy is in place |

---

## 4. Recommended Recording Setup

For recording the demo video:

- **Resolution:** 1920×1080 minimum (4K recommended for clarity of small UI text and AI banners).
- **Browser:** Chrome with the dev tools closed and zoom at 100%.
- **Audio:** External mic if possible. Quiet room. Audio normalization in post.
- **Cursor visibility:** macOS "Big Cursor" or a dedicated tool like `Mouseposé` to make the cursor visible in screencasts.
- **Pacing:** Pause briefly (~1s) on critical screens like the AI verification banner so viewers can read it.
- **Voice over:** Record voice separately and edit in. Live narration plus screen recording often results in mismatches.
- **Length target:** 12-15 minutes. Use the slide deck (`Presentation_Slides.md`) for non-demo segments.

A good cadence:
1. Slides 1-3 (intro, problem, deliverables) — ~2 min
2. Slides 4-8 (architecture, security) — ~5 min
3. Slides 9-12 (AI integration, bugs) — ~3 min
4. Live demo (slide 13) — ~4 min
5. Slides 14-16 (tests, skills, conclusion) — ~2 min

Total: ~16 min. Trim slide-talking time to hit 12-15 min.
