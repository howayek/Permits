# Architecture v1

## Diagram (high-level)

```text
Applicant / Reviewer Browser (React)
        |
        | HTTPS
        v
Supabase Auth (sessions)  ----->  Postgres DB (RLS policies)
        |                                |
        |                                |
        v                                v
Supabase Storage (private docs)     Audit Log (append-only table)
        |
        | (server-side)
        v
Edge Function: Permit PDF + QR Generation
        |
        v
Public Verify Endpoint (Edge Function) -> returns valid/expired/revoked
```

## Notes
- Two main UIs: Applicant portal and Staff portal (different roles).
- Auth uses browser sessions; roles drive what each user can do.
- Postgres policies enforce authorization at the database level (not only frontend).
- Uploaded documents go to private storage; access is controlled and logged.
- Every sensitive action creates an audit event (view doc, approve/reject, issue permit).
- When approved, a server function generates a permit PDF and embeds a QR code.
- QR verification checks permit status without exposing private documents.
- Scales by separating storage and using server functions for heavy tasks (PDF generation).