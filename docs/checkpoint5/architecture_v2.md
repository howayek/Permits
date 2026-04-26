# Architecture v2 (W15 — Final)

## Diagram (high-level)

```text
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

## Notes

- **Two role-based UIs:** Citizen Portal and Government Portal. Roles drive what each user sees.
- **Auth:** Supabase Auth issues JWTs. Roles stored in `user_roles` table. Role selection at sign-up triggers a database hook to insert the role row.
- **Authorization (RBAC + RLS):** Every public table has RLS enabled. Policies use a single `has_role(p_role)` SECURITY DEFINER function that checks `user_roles` for `auth.uid()`. Frontend `ProtectedRoute` plus DB-level RLS form defense in depth.
- **Document storage:** Private bucket policies — only authenticated users can upload/read. Each upload computes SHA-256 client-side; hash + storage key stored in the `documents` table.
- **Document integrity:** When citizens or reviewers download a permit PDF or document, the client recomputes SHA-256 and compares against the stored hash. Mismatches block the download and warn the user.
- **Permit issuance:** Approval triggers an Edge Function that generates a PDF with embedded QR code, computes its hash, uploads it to Storage, and updates the `permits` table with `pdf_s3_key`, `pdf_sha256`, `qr_url`.
- **Public verification:** The QR resolves to `/permits/:id`, which reads minimal data via anon RLS — confirms valid/revoked status and shows audit trail without exposing private documents.
- **AI Integration (W15):**
  - **On document upload:** the citizen labels each file with a required-doc type. The frontend calls the `ai-assist` Edge Function with the file as base64 + the expected type. The function uses GPT-4o-mini (vision) to classify the document and returns `{ match, actual_type, confidence, notes }`. Results are stored in `applications.data.ai_results` JSONB (no schema change needed).
  - **For reviewers:** the Government Details modal includes an "AI Review Summary" button that sends the application's structured data + AI classifications to the same Edge Function (using the `review_summary` action). GPT-4o-mini returns a 3–5 bullet-point summary covering completeness, document validity, concerns, and a recommended next action. The reviewer always makes the final decision; the AI only assists.
  - **Security:** The `OPENAI_API_KEY` is stored as a Supabase Edge Function secret — never exposed to the browser.
- **Audit logging:** Every sensitive action (submit, route, decision, document upload, info request, AI classification, decision upload) appends an immutable row to `audit_log`. Citizens can read their own audit; gov/admin/dev can read all.
- **Scalability:** Storage and DB are managed by Supabase. Edge Functions handle CPU-heavy work (PDF generation, AI calls) so they don't block the client. Adding more permit types or municipalities is a config change via the Admin page — no code deployment.
