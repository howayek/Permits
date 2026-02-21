import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

// Edge Function to generate a permit PDF, upload to storage, insert a documents row,
// and update the permits table (status -> GENERATED, pdf metadata, qr_url, issued_at).
//
// Required secrets (set via `supabase functions secrets set`):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   PERMITS_BASE_URL            (e.g. https://your-frontend-domain)
//   QR_SERVICE_URL (optional)   (default uses api.qrserver.com)
//
// Deploy:   supabase functions deploy generate-permit
// Invoke:   curl -X POST https://<project-ref>.functions.supabase.co/generate-permit \
//            -H "Authorization: Bearer <anon-or-service-key>" \
//            -H "Content-Type: application/json" \
//            -d '{"permitId":"PMT-TEST-0001"}'
//
// Request body: { "permitId": "PMT-..." } OR { "permit_id": "PMT-..." }
// Response: { ok: true, permit_id, pdf_s3_key, pdf_sha256, qr_url, issued_at, document_id }

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json"
  };
}

function toHex(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, "0");
  return s;
}

async function sha256Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
  const buf = data instanceof Uint8Array ? data.buffer : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return toHex(hash);
}

type PermitRow = {
  id: string;
  permit_id: string;
  application_id: string;
  municipality_id: string;
  permit_type_id: string;
  status: string | null;
  issued_at: string | null;
  pdf_s3_key: string | null;
  pdf_sha256: string | null;
  qr_url: string | null;
  owner_name: string | null;
  plot_address: string | null;
};

type AppRow = { id: string; data: Record<string, unknown> | null };

import { createClient as createAnonClient } from "https://esm.sh/@supabase/supabase-js@2"; // alias if needed

denoServe();

function denoServe() {
  Deno.serve(async (req) => {
    try {
      if (req.method === "OPTIONS") {
        return new Response("", { status: 200, headers: cors() });
      }
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors() });
      }

      const body = await req.json().catch(() => ({}));
      const permitId: string | undefined = body.permitId || body.permit_id;
      if (!permitId) {
        return new Response(JSON.stringify({ error: "Missing permitId" }), { status: 400, headers: cors() });
      }

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL");
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
      const PERMITS_BASE_URL = Deno.env.get("PERMITS_BASE_URL") ?? Deno.env.get("PUBLIC_BASE_URL");
      const QR_SERVICE_URL = Deno.env.get("QR_SERVICE_URL") || "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=";

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(JSON.stringify({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }), { status: 500, headers: cors() });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // 1. Fetch permit
      const { data: permit, error: permErr } = await supabase
        .from("permits")
        .select("*")
        .eq("permit_id", permitId)
        .maybeSingle<PermitRow>();
      if (permErr) throw permErr;
      if (!permit) {
        return new Response(JSON.stringify({ error: `Permit not found: ${permitId}` }), { status: 404, headers: cors() });
      }

      // 2. Resolve owner/plot from application if missing
      let ownerName = permit.owner_name;
      let plotAddress = permit.plot_address;
      if (!ownerName || !plotAddress) {
        const { data: app } = await supabase
          .from("applications")
          .select("id, data")
          .eq("id", permit.application_id)
          .maybeSingle<AppRow>();
        if (app?.data) {
          ownerName = ownerName || String((app.data as any)?.owner_name || "(unknown)");
          plotAddress = plotAddress || String((app.data as any)?.plot_address || "(unknown)");
        }
      }

      // 3. Determine verification URL
      let verificationUrl = permit.qr_url || null;
      if (!verificationUrl) {
        const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
        const scheme = req.headers.get("x-forwarded-proto") || "https";
        const base = PERMITS_BASE_URL ? (PERMITS_BASE_URL.startsWith("http") ? PERMITS_BASE_URL : `https://${PERMITS_BASE_URL}`) : (hostHeader ? `${scheme}://${hostHeader}` : null);
        if (!base) {
          return new Response(JSON.stringify({ error: "Cannot infer base URL; set PERMITS_BASE_URL" }), { status: 500, headers: cors() });
        }
        verificationUrl = `${base}/permits/${permit.permit_id}`;
      }

      // 4. Fetch QR PNG
      const qrResp = await fetch(QR_SERVICE_URL + encodeURIComponent(verificationUrl));
      if (!qrResp.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch QR image" }), { status: 502, headers: cors() });
      }
      const qrPngBytes = new Uint8Array(await qrResp.arrayBuffer());

      // 5. Build PDF
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const margin = 50;

      page.drawText("Official Building Permit", { x: margin, y: page.getHeight() - margin - 10, size: 20, font: fontBold, color: rgb(0.12,0.12,0.12) });

      const rows: [string, string | null][] = [
        ["Permit ID", permit.permit_id],
        ["Owner", ownerName],
        ["Address / Plot", plotAddress],
        ["Municipality", permit.municipality_id],
        ["Verification Link", verificationUrl],
      ];

      let y = page.getHeight() - margin - 50;
      const lineH = 18;
      for (const [label, value] of rows) {
        page.drawText(label + ":", { x: margin, y, size: 12, font: fontBold });
        page.drawText(String(value ?? "—"), { x: margin + 140, y, size: 12, font });
        y -= lineH;
      }

      const qrImg = await pdfDoc.embedPng(qrPngBytes);
      const qrSize = 180;
      page.drawImage(qrImg, { x: page.getWidth() - margin - qrSize, y: page.getHeight() - margin - qrSize, width: qrSize, height: qrSize });

      page.drawText("Scan the QR or visit the link to verify authenticity.", { x: margin, y: margin, size: 10, font, color: rgb(0.3,0.3,0.3) });

      const pdfBytes = await pdfDoc.save();
      const pdfU8 = new Uint8Array(pdfBytes);
      const pdfSha256 = await sha256Hex(pdfU8);

      // 6. Upload to storage bucket 'documents'
      const bucket = "documents";
      const filename = `${permit.permit_id}.pdf`;
      const path = `permits/${filename}`; // folder path under bucket
      const blob = new Blob([pdfU8], { type: "application/pdf" });

      const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType: "application/pdf" });
      if (uploadErr) {
        return new Response(JSON.stringify({ error: uploadErr.message }), { status: 500, headers: cors() });
      }

      // 7. Insert a documents row (if not already present for this application & filename)
      const { data: existingDoc } = await supabase
        .from("documents")
        .select("id")
        .eq("application_id", permit.application_id)
        .eq("filename", filename)
        .maybeSingle();

      let documentId: string | null = null;
      if (!existingDoc) {
        const { data: docInsert, error: docErr } = await supabase
          .from("documents")
          .insert({
            application_id: permit.application_id,
            filename,
            s3_key: path,
            mime: "application/pdf",
            size: pdfU8.byteLength,
            sha256: pdfSha256,
            uploaded_at: new Date().toISOString()
          })
          .select("id")
          .maybeSingle();
        if (docErr) {
          return new Response(JSON.stringify({ error: docErr.message }), { status: 500, headers: cors() });
        }
        documentId = docInsert?.id || null;
      } else {
        documentId = existingDoc.id;
      }

      // 8. Update permit row
      const issuedAt = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("permits")
        .update({
          status: "GENERATED",
          pdf_s3_key: path,
          pdf_sha256: pdfSha256,
          qr_url: verificationUrl,
          issued_at: issuedAt,
          owner_name: ownerName,
          plot_address: plotAddress
        })
        .eq("id", permit.id);
      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: cors() });
      }

      return new Response(JSON.stringify({
        ok: true,
        permit_id: permit.permit_id,
        pdf_s3_key: path,
        pdf_sha256: pdfSha256,
        qr_url: verificationUrl,
        issued_at: issuedAt,
        document_id: documentId
      }), { status: 200, headers: cors() });
    } catch (e: any) {
      console.error(e);
      return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: cors() });
    }
  });
}
