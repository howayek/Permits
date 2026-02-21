# generate-permit Edge Function

Generates an official permit PDF, stores it in Storage, inserts a row in `documents`, and updates the `permits` row to `GENERATED` with full metadata.

## Required Secrets

```bash
supabase functions secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase functions secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
supabase functions secrets set PERMITS_BASE_URL=https://your-frontend-domain
# Optional: custom QR provider
supabase functions secrets set QR_SERVICE_URL="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data="
```

## Deployment

```bash
supabase functions deploy generate-permit
```

## Invocation

```bash
curl -X POST https://<project-ref>.functions.supabase.co/generate-permit \
  -H "Authorization: Bearer <anon-or-service-key>" \
  -H "Content-Type: application/json" \
  -d '{"permitId":"PMT-TEST-0001"}'
```

## Response

```json
{
  "ok": true,
  "permit_id": "PMT-TEST-0001",
  "pdf_s3_key": "permits/PMT-TEST-0001.pdf",
  "pdf_sha256": "<hex>",
  "qr_url": "https://your-frontend-domain/permits/PMT-TEST-0001",
  "issued_at": "2025-11-17T12:00:00.000Z",
  "document_id": "<uuid>"
}
```

## What It Does
1. Fetches the permit row by `permit_id`.
2. Resolves missing owner / plot fields from `applications.data`.
3. Determines `qr_url` (front-end verification path).
4. Pulls a QR PNG from a remote service.
5. Generates PDF with metadata + embedded QR (pdf-lib).
6. Uploads PDF to the `documents` storage bucket under `permits/{permit_id}.pdf`.
7. Inserts a `documents` table row (or reuses existing) with sha256 and size.
8. Updates the permit row: `status=GENERATED`, timestamps, hash, paths.

## Database Assumptions
- Table `permits` exists with columns: permit_id, application_id, municipality_id, permit_type_id, status, issued_at, pdf_s3_key, pdf_sha256, qr_url, owner_name, plot_address.
- Table `documents` exists with columns: id (uuid), application_id (uuid), filename (text), s3_key (text), mime (text), size (int), sha256 (text), uploaded_at (timestamptz).
- Storage bucket `documents` is created and (optionally) public.

Create bucket if missing:
```sql
insert into storage.buckets (id, name, public) values ('documents','documents', true)
on conflict (id) do nothing;
```

## Optional Enhancements
- Add column `permit_pdf_document_id uuid references documents(id)` to `permits` for direct linkage:
  ```sql
  ALTER TABLE permits ADD COLUMN IF NOT EXISTS permit_pdf_document_id uuid REFERENCES documents(id);
  -- After generation: update permits set permit_pdf_document_id = '<doc_id>' where id = '<permit_row_id>';
  ```
- Digital signature layer or watermark.
- Revocation flow: set status='REVOKED', add `revoked_at`, store reason.
- Hash re-verification endpoint to compare stored sha256 with regenerated hash.

## Local Development

```bash
supabase functions serve generate-permit
curl -X POST http://localhost:54321/functions/v1/generate-permit -H "Content-Type: application/json" -d '{"permitId":"PMT-TEST-0001"}'
```

## Failure Modes
- 404 if permit not found.
- 502 if QR provider unreachable.
- 500 for storage or DB errors (message returned in JSON).

## Troubleshooting

### PDF Generation Button Shows "Generating..." Then Reverts Without Error

**Symptom**: Button shows loading state briefly, then returns to "Generate PDF" without generating anything or showing an error.

**Common Causes**:

1. **Missing Environment Variables** (Most Common)
   - The Edge Function requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PERMITS_BASE_URL`
   - Check if secrets are set:
     ```bash
     supabase functions secrets list
     ```
   - Set missing secrets:
     ```bash
     supabase functions secrets set SUPABASE_URL=https://<project-ref>.supabase.co
     supabase functions secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
     supabase functions secrets set PERMITS_BASE_URL=https://your-frontend-domain
     ```
   - Redeploy after setting secrets:
     ```bash
     supabase functions deploy generate-permit
     ```

2. **Storage Bucket Not Created**
   - Ensure the `documents` bucket exists:
     ```sql
     insert into storage.buckets (id, name, public) 
     values ('documents','documents', true)
     on conflict (id) do nothing;
     ```

3. **Permit Not Found**
   - Verify the permit exists in the database:
     ```sql
     SELECT * FROM permits WHERE permit_id = 'PMT-XXX-XXXX';
     ```

4. **Storage Permissions**
   - Check RLS policies on the `documents` bucket
   - Ensure the service role can upload to storage

5. **Check Function Logs**
   - View logs in Supabase Dashboard under Edge Functions
   - Or use CLI:
     ```bash
     supabase functions logs generate-permit
     ```

**User-Facing Error Messages**:
- The application now shows detailed error messages for common issues
- Check browser console for additional debug information
- Look for messages like:
  - "PDF generation service is not properly configured..."
  - "Permit not found..."
  - "Failed to generate QR code..."
  - "Storage download error..."

## Security Notes
- Uses Service Role key; protect function endpoint or implement auth checks if exposing publicly.
- Optionally validate caller by requiring a signed JWT or internal header.

## Next Steps
- Integrate into approval workflow (call after decision triggers).
- Add retry logic / monitoring.
- Implement PDF caching / versioning if permit details can change.
