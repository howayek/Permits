import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatFieldLabel } from "@/lib/utils";
import { format } from "date-fns";
import { APPLICATION_STATUSES, DECISION_STATUSES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface Application {
  id: string;
  status: string;
  data: any;
  permit_types?: { name: string; municipality_id: string } | null;
}

interface AmendmentFileRef {
  key: string;
  sha256: string;
  original_name: string;
  size: number;
  mime: string;
}

interface Amendment {
  submitted_at: string;
  text: string | null;
  files: AmendmentFileRef[];
}

interface InfoRequest {
  id: string;
  requested_fields: string[];
  message: string | null;
  due_date: string | null;
  requires_new_documents: boolean;
  created_at: string;
}

export default function ProvideInfo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [app, setApp] = useState<Application | null>(null);
  const [latestDecision, setLatestDecision] = useState<string | null>(null);
  const [infoRequest, setInfoRequest] = useState<InfoRequest | null>(null);
  const [supplementText, setSupplementText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      setErrorMsg(null);
      const [
        { data: aData, error: aErr },
        { data: dData, error: dErr },
        { data: irData, error: irErr }
      ] = await Promise.all([
        supabase
          .from("applications")
          .select("id,status,data,permit_types(name,municipality_id)")
          .eq("id", id)
          .eq("user_email", user.email)
          .maybeSingle(),
        supabase
          .from("decisions")
          .select("decision, issued_at")
          .eq("application_id", id)
          .order("issued_at", { ascending: false })
          .limit(1),
        supabase
          .from("info_requests")
          .select("id, requested_fields, message, due_date, requires_new_documents, created_at")
          .eq("application_id", id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (aErr) {
        setErrorMsg(aErr.message);
        return;
      }
      if (!aData) {
        alert("Application not found or not owned by you.");
        navigate("/my-permits");
        return;
      }
      setApp(aData as Application);
      if (dErr) console.error(dErr);
      setLatestDecision(dData?.[0]?.decision ?? null);
      if (irErr) console.error(irErr);
      setInfoRequest(irData?.[0] ?? null);
    })();
  }, [id, user, navigate]);

  const canProvideInfo =
    (latestDecision ?? "").toUpperCase() === DECISION_STATUSES.REQUEST_INFO ||
    (app?.status ?? "").toUpperCase() === DECISION_STATUSES.REQUEST_INFO ||
    (app?.status ?? "") === APPLICATION_STATUSES.NEEDS_INFO;

  const amendments: Amendment[] = Array.isArray(app?.data?.user_amendments)
    ? app!.data.user_amendments
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!app || !id) return;

    if (!supplementText.trim() && (!files || files.length === 0)) {
      setErrorMsg("Please enter text or attach at least one file.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const uploaded: AmendmentFileRef[] = [];
      if (files && files.length) {
        for (const f of Array.from(files)) {
          const buf = await f.arrayBuffer();
          const digest = await crypto.subtle.digest("SHA-256", buf);
          const sha = Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          const key = `user_amendments/${id}/${Date.now()}_${sanitizeFilename(f.name)}`;
          const { error: upErr } = await supabase.storage
            .from("documents")
            .upload(key, f, { upsert: false, cacheControl: "3600" });
          if (upErr) throw upErr;
          uploaded.push({
            key,
            sha256: sha,
            original_name: f.name,
            size: f.size,
            mime: f.type || "application/octet-stream",
          });
        }
      }

      const newAmend: Amendment = {
        submitted_at: new Date().toISOString(),
        text: supplementText.trim() || null,
        files: uploaded,
      };

      const updatedData = {
        ...(app.data || {}),
        user_amendments: [...amendments, newAmend],
      };

      // Update application data
      const { error: updErr } = await supabase
        .from("applications")
        .update({ 
          data: updatedData,
          status: APPLICATION_STATUSES.SUPPLEMENTAL_SUBMITTED
        })
        .eq("id", id);
      if (updErr) throw updErr;

      // If this is in response to an info request, record the response
      if (infoRequest) {
        const { error: respErr } = await supabase
          .from("info_request_responses")
          .insert({
            request_id: infoRequest.id,
            application_id: id,
            user_id: user?.id,
            updated_fields: infoRequest.requested_fields,
            note: supplementText.trim() || null,
          });
        if (respErr) {
          console.error("Failed to record info request response:", respErr);
          toast({
            title: "Warning",
            description: "Information submitted but response tracking failed. Please contact support if needed.",
            variant: "destructive",
          });
        }
      }

      await supabase.from("audit_log").insert({
        application_id: id,
        action: "USER_SUPPLEMENT",
        meta: {
          text: newAmend.text,
          files: uploaded.map((f) => ({
            key: f.key,
            sha256: f.sha256,
            size: f.size,
            mime: f.mime,
            original_name: f.original_name,
          })),
        },
      });

      setSupplementText("");
      setFiles(null);
      setApp({ ...app, data: updatedData });
      alert("Information submitted successfully.");
      navigate("/my-permits");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Failed to submit additional information.");
    } finally {
      setSubmitting(false);
    }
  }

  function sanitizeFilename(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  if (loading) return <main className="p-6">Loading…</main>;
  if (!user) return <main className="p-6">Please log in.</main>;

  if (!app)
    return (
      <main className="p-6">
        {errorMsg ? <div className="text-red-600 text-sm">{errorMsg}</div> : "Loading application…"}
      </main>
    );

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Provide Additional Information</h1>
      <div className="text-sm text-gray-600 space-y-1">
        <div>
          Application: <span className="font-mono">{app.id}</span>
        </div>
        <div>
          Permit Type: {""}
          <span className="font-medium">
            {app.permit_types?.name ?? "—"} ({app.permit_types?.municipality_id ?? "—"})
          </span>
        </div>
        <div>
          Current Status: <span className="font-semibold">{app.status}</span>
          {latestDecision && (
            <span className="text-xs ml-2 px-2 py-0.5 rounded bg-gray-100">
              Latest Decision: {latestDecision}
            </span>
          )}
        </div>
      </div>

      {/* Info Request Banner */}
      {infoRequest && (
        <div className="border-l-4 border-orange-500 bg-orange-50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">!</div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 mb-2">Additional Information Requested</h3>
              {infoRequest.message && (
                <div className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">
                  {infoRequest.message}
                </div>
              )}
              {infoRequest.requested_fields && infoRequest.requested_fields.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Requested Fields:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                    {infoRequest.requested_fields.map((field: string) => (
                      <li key={field} className="font-medium">{formatFieldLabel(field)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {infoRequest.due_date && (
                <p className="text-xs text-orange-700">
                  <strong>Due Date:</strong> {format(new Date(infoRequest.due_date), "PPP")}
                </p>
              )}
              {infoRequest.requires_new_documents && (
                <p className="text-xs text-orange-700 mt-1">
                  <strong>Note:</strong> New documents are required.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!canProvideInfo && (
        <div className="p-4 border rounded bg-gray-50 text-sm">
          This application is not currently flagged for additional information. If you believe this
          is an error, contact your municipality.
        </div>
      )}

      {canProvideInfo && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Supplemental Text</label>
            <textarea
              className="w-full border rounded p-2 text-sm"
              rows={6}
              placeholder="Add clarifications, explanations, or requested details..."
              value={supplementText}
              onChange={(e) => setSupplementText(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Attach Files (optional)</label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              disabled={submitting}
              className="text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Each file is hashed (SHA-256) and stored securely.</p>
            {files && files.length > 0 && (
              <ul className="mt-2 text-xs space-y-1">
                {Array.from(files).map((f) => (
                  <li key={f.name} className="flex justify-between">
                    <span>{f.name}</span>
                    <span className="text-gray-500">{(f.size / 1024).toFixed(1)} KB · {f.type || "n/a"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Information"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/my-permits")}
              className="px-4 py-2 rounded border text-sm"
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Previous Amendments</h2>
        {amendments.length === 0 ? (
          <div className="text-sm text-gray-500">No supplemental information submitted yet.</div>
        ) : (
          <ul className="space-y-3">
            {amendments
              .slice()
              .reverse()
              .map((am, idx) => (
                <li key={idx} className="border rounded p-3 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Submitted {new Date(am.submitted_at).toLocaleString()}</span>
                    <span className="text-xs text-gray-500">{am.files.length} file{am.files.length !== 1 ? "s" : ""}</span>
                  </div>
                  {am.text && <div className="whitespace-pre-wrap">{am.text}</div>}
                  {am.files.length > 0 && (
                    <div className="grid gap-2">
                      {am.files.map((f, i) => (
                        <div key={i} className="flex items-center justify-between rounded border p-2 bg-gray-50">
                          <div className="truncate">
                            <span className="font-mono text-xs">{f.original_name}</span>
                            <div className="text-[10px] text-gray-500 break-all">{f.key} · {f.sha256.slice(0, 16)}…</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
          </ul>
        )}
      </section>
    </main>
  );
}