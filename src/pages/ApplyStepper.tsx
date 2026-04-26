import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { createApplication } from "@/lib/db";
import { ALLOWED_DOC_MIME_TYPES, MAX_DOC_SIZE_BYTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { classifyDocument, type DocumentClassification } from "@/lib/aiAssist";

type PermitType = { id: string; name: string; slug: string; required_docs: string[] };
type Muni = { id: string; name: string };

interface UploadedDoc {
  name: string;
  size: number;
  type: string;
  sha256: string;
  s3Key: string;
  ai_classification?: DocumentClassification | null;
  expected_doc?: string;
}

export default function ApplyStepper() {
  const { municipalityId, permitType } = useParams();
  const navigate = useNavigate();

  const [muni, setMuni] = useState<Muni | null>(null);
  const [ptype, setPtype] = useState<PermitType | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<"ar" | "fr" | "en">("en");
  const [plotNumber, setPlotNumber] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileAssignments, setFileAssignments] = useState<Record<number, string>>({});
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<number, DocumentClassification | null>>({});

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!municipalityId || !permitType) {
          setErr("Missing municipality or permit type in URL.");
          setLoading(false);
          return;
        }

        const { data: m, error: em } = await supabase
          .from("municipalities")
          .select("id,name")
          .eq("id", municipalityId)
          .maybeSingle();
        if (em) throw em;
        if (!m) {
          setErr("Municipality not found.");
          setLoading(false);
          return;
        }
        setMuni(m);

        const { data: pt, error: ept } = await supabase
          .from("permit_types")
          .select("id,name,slug,required_docs")
          .eq("municipality_id", m.id)
          .eq("slug", permitType)
          .maybeSingle();
        if (ept) throw ept;
        if (!pt) {
          setErr("Permit type not found for this municipality.");
          setLoading(false);
          return;
        }
        setPtype(pt);
        setLoading(false);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? "Failed to load form.");
        setLoading(false);
      }
    })();
  }, [municipalityId, permitType]);

  function validateFiles(selected: File[]): string[] {
    const errors: string[] = [];
    for (const f of selected) {
      if (!ALLOWED_DOC_MIME_TYPES.includes(f.type as any)) {
        errors.push(`"${f.name}" has an unsupported file type (${f.type || "unknown"}). Allowed: PDF, JPEG, PNG, WebP, DOC, DOCX.`);
      }
      if (f.size > MAX_DOC_SIZE_BYTES) {
        errors.push(`"${f.name}" exceeds the 10 MB size limit (${(f.size / 1024 / 1024).toFixed(1)} MB).`);
      }
    }
    return errors;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    setFiles(selected);
    setFileErrors(validateFiles(selected));
    setFileAssignments({});
    setAiResults({});
  }

  function handleAssignmentChange(index: number, expectedDoc: string) {
    setFileAssignments((prev) => ({ ...prev, [index]: expectedDoc }));
  }

  async function computeSHA256(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  async function uploadFiles(applicationId: string): Promise<UploadedDoc[]> {
    const uploaded: UploadedDoc[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setUploadProgress(`Uploading file ${i + 1} of ${files.length}: ${f.name}…`);

      const sha256 = await computeSHA256(f);
      const safeName = sanitizeFilename(f.name);
      const s3Key = `applications/${applicationId}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(s3Key, f, { cacheControl: "3600", upsert: false });
      if (upErr) throw new Error(`Failed to upload "${f.name}": ${upErr.message}`);

      // AI classification (best-effort; failures don't block submission)
      const expectedDoc = fileAssignments[i];
      let aiClassification: DocumentClassification | null = null;
      if (expectedDoc) {
        setUploadProgress(`Verifying "${f.name}" with AI…`);
        aiClassification = await classifyDocument(f, expectedDoc);
        setAiResults((prev) => ({ ...prev, [i]: aiClassification }));
      }

      uploaded.push({
        name: f.name,
        size: f.size,
        type: f.type,
        sha256,
        s3Key,
        ai_classification: aiClassification,
        expected_doc: expectedDoc,
      });
    }

    setUploadProgress(null);
    return uploaded;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (fileErrors.length > 0) {
      setErr("Please fix the file errors before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        setErr("Please log in to submit your application.");
        setSubmitting(false);
        return;
      }

      if (!muni || !ptype) {
        setErr("Form not ready yet.");
        setSubmitting(false);
        return;
      }

      // Step 1: Create the application record (without docs first)
      setUploadProgress("Creating application…");
      const appId = await createApplication({
        municipalityId: muni.id,
        permitTypeSlug: ptype.slug,
        applicant: { fullName, email, phone, language },
        fields: { plotNumber, description },
        documents: [],
      });

      // Step 2: Upload files to Storage with SHA-256 hashing + AI classification
      if (files.length > 0) {
        const uploadedDocs = await uploadFiles(appId);

        // Step 3: Insert document metadata rows with real s3_key and sha256
        const docRows = uploadedDocs.map((d) => ({
          application_id: appId,
          filename: d.name,
          s3_key: d.s3Key,
          mime: d.type || null,
          size: d.size,
          sha256: d.sha256,
        }));
        const { error: docErr } = await supabase.from("documents").insert(docRows);
        if (docErr) throw new Error(`Document records failed: ${docErr.message}`);

        // Persist AI classifications inside applications.data.ai_results so the
        // government reviewer can access them later without re-running the AI.
        const aiResultsArr = uploadedDocs
          .filter((d) => d.ai_classification || d.expected_doc)
          .map((d) => ({
            filename: d.name,
            s3_key: d.s3Key,
            expected_doc: d.expected_doc ?? null,
            classification: d.ai_classification ?? null,
          }));

        if (aiResultsArr.length > 0) {
          const { data: appRow } = await supabase
            .from("applications")
            .select("data")
            .eq("id", appId)
            .maybeSingle();
          const existingData = (appRow?.data as Record<string, unknown>) ?? {};
          await supabase
            .from("applications")
            .update({ data: { ...existingData, ai_results: aiResultsArr } })
            .eq("id", appId);
        }

        // Audit the upload (including AI summary)
        await supabase.from("audit_log").insert({
          application_id: appId,
          action: "DOCUMENTS_UPLOADED",
          meta: {
            count: uploadedDocs.length,
            files: uploadedDocs.map((d) => ({
              name: d.name,
              size: d.size,
              sha256: d.sha256,
              s3_key: d.s3Key,
              ai_match: d.ai_classification?.match ?? null,
              expected_doc: d.expected_doc ?? null,
            })),
          },
        });
      }

      navigate("/", {
        state: {
          permitSubmitted: true,
          submittedPermitType: ptype.name,
        },
      });
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Submission failed.");
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="mb-4 text-sm">
        <Link className="underline" to={`/apply/${municipalityId}`}>
          ← Back
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">
        {muni?.name} — {ptype?.name ?? "Permit"}
      </h1>
      <p className="mb-4 text-muted-foreground">
        Fill the form and submit your application.
      </p>

      {err && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full name</label>
          <input
            className="border rounded-md p-2 w-full"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Email (for contact)
          </label>
          <input
            type="email"
            className="border rounded-md p-2 w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              className="border rounded-md p-2 w-full"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Preferred language
            </label>
            <select
              className="border rounded-md p-2 w-full"
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
            >
              <option value="ar">Arabic</option>
              <option value="fr">French</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Plot number
            </label>
            <input
              className="border rounded-md p-2 w-full"
              value={plotNumber}
              onChange={(e) => setPlotNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <input
              className="border rounded-md p-2 w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <Card className="p-4 space-y-3">
          {ptype?.required_docs && ptype.required_docs.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-1">Required Documents</label>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-0.5">
                {ptype.required_docs.map((doc, i) => (
                  <li key={i}>{doc}</li>
                ))}
              </ul>
            </div>
          )}
          <label className="block text-sm font-medium">
            Upload Documents{" "}
            <span className="text-muted-foreground font-normal">
              (PDF, JPEG, PNG, WebP, DOC/DOCX — max 10 MB each)
            </span>
          </label>
          <input
            type="file"
            multiple
            accept={ALLOWED_DOC_MIME_TYPES.join(",")}
            onChange={handleFileChange}
            className="text-sm"
          />

          {files.length > 0 && fileErrors.length === 0 && (
            <div className="mt-3 space-y-2">
              {files.map((f, i) => {
                const assignment = fileAssignments[i] ?? "";
                const aiResult = aiResults[i];
                return (
                  <div key={i} className="border rounded p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate flex-1">
                        {f.name}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({(f.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    </div>
                    {ptype?.required_docs && ptype.required_docs.length > 0 && (
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          This file is:
                        </label>
                        <select
                          className="border rounded-md p-1.5 text-sm w-full"
                          value={assignment}
                          onChange={(e) => handleAssignmentChange(i, e.target.value)}
                        >
                          <option value="">— Select document type —</option>
                          {ptype.required_docs.map((doc) => (
                            <option key={doc} value={doc}>
                              {doc}
                            </option>
                          ))}
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    )}
                    {aiResult && (
                      <div
                        className={`text-xs rounded p-2 ${
                          aiResult.match
                            ? "bg-green-50 text-green-800 border border-green-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        <span className="font-semibold">
                          {aiResult.match ? "✓ AI Verified" : "⚠ AI Warning"}
                        </span>{" "}
                        — {aiResult.notes}
                        {!aiResult.match && (
                          <div className="mt-1 text-xs">
                            File appears to be: <em>{aiResult.actual_type}</em>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {fileErrors.length > 0 && (
            <ul className="mt-2 text-sm text-red-700 space-y-1">
              {fileErrors.map((msg, i) => (
                <li key={i}>⚠ {msg}</li>
              ))}
            </ul>
          )}
        </Card>

        {uploadProgress && (
          <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-3">
            {uploadProgress}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={submitting || fileErrors.length > 0}
        >
          {submitting ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    </main>
  );
}
