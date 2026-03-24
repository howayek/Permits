import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatFieldLabel } from "@/lib/utils";
import { RequestInfoModal } from "@/components/RequestInfoModal";
import { Button } from "@/components/ui/button";
import { APPLICATION_STATUSES } from "@/lib/constants";

type Row = {
  id: string;
  status: string;
  user_email: string | null;
  created_at: string;
  permit_types?: { name: string; slug: string; municipality_id: string; municipalities?: { name: string } | null } | null;
};

export default function GovDatabase() {
  const { user, loading } = useAuth();
  const [fetching, setFetching] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [permit, setPermit] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [oldestPendingFirst, setOldestPendingFirst] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      try {
        setFetching(true);
        const { data, error } = await supabase
          .from("applications")
          .select("id,status,user_email,created_at,permit_types(name,slug,municipality_id,municipalities(name))")
          .order("created_at", { ascending: false })
          .limit(5000);
        if (error) throw error;
        setRows(data ?? []);
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setFetching(false);
      }
    })();
  }, [user, loading]);

  const filtered = useMemo(() => {
    let r = rows;
    if (status !== "all") {
      r = r.filter((x) => x.status === status);
    }
    if (municipality.trim()) {
      const q = municipality.trim().toLowerCase();
      r = r.filter((x) => (x.permit_types?.municipalities?.name ?? "").toLowerCase().includes(q));
    }
    if (permit.trim()) {
      const q = permit.trim().toLowerCase();
      r = r.filter((x) => (x.permit_types?.name ?? "").toLowerCase().includes(q));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((x) =>
        x.id.toLowerCase().includes(q) ||
        (x.user_email ?? "").toLowerCase().includes(q) ||
        (x.permit_types?.name ?? "").toLowerCase().includes(q)
      );
    }
    if (status === "pending" && oldestPendingFirst) {
      r = [...r].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return r;
  }, [rows, status, municipality, permit, search, oldestPendingFirst]);

  if (loading) return <main className="p-6">Loading…</main>;
  if (!user) return <main className="p-6">Please sign in to access the government database.</main>;

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Municipality Database</h1>
      <div className="grid md:grid-cols-5 gap-3 mb-4">
        <input className="border rounded px-3 py-2" placeholder="Search id, email, permit…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className="border rounded px-3 py-2" placeholder="Municipality id" value={municipality} onChange={(e) => setMunicipality(e.target.value)} />
        <input className="border rounded px-3 py-2" placeholder="Permit type" value={permit} onChange={(e) => setPermit(e.target.value)} />
        <select className="border rounded px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="ROUTED">Routed</option>
          <option value="CLARIFICATION_REQUESTED">Clarification Requested</option>
          <option value="DECISION_UPLOADED">Decision Uploaded</option>
          <option value="CLOSED">Closed</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={oldestPendingFirst} onChange={(e) => setOldestPendingFirst(e.target.checked)} />
          Oldest pending first
        </label>
      </div>

      <div className="overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Municipality</th>
              <th className="text-left px-3 py-2">Permit</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {fetching ? (
              <tr><td colSpan={6} className="p-6">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No results</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedAppId(r.id)}>
                  <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-2">{r.user_email ?? "—"}</td>
                  <td className="px-3 py-2">{r.permit_types?.municipalities?.name ?? "—"}</td>
                  <td className="px-3 py-2">{r.permit_types?.name ?? "—"}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {selectedAppId && (
        <DetailsModal id={selectedAppId} onClose={() => setSelectedAppId(null)} />
      )}
    </main>
  );
}

function DetailsModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [decisionFile, setDecisionFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [
          { data: appData, error: e1 },
          { data: docsData, error: e2 },
          { data: eventsData, error: e3 },
        ] = await Promise.all([
          supabase
            .from("applications")
            .select("*, permit_types(name,slug,municipality_id,municipalities(name))")
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("documents")
            .select("filename,mime,size,sha256,s3_key,uploaded_at")
            .eq("application_id", id)
            .order("uploaded_at"),
          supabase
            .from("audit_log")
            .select("action,meta,created_at,ip")
            .eq("application_id", id)
            .order("created_at"),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        if (e3) throw e3;
        if (!mounted) return;
        setApp(appData);
        setDocs(docsData ?? []);
        setEvents(eventsData ?? []);
      } catch (err) {
        console.error("DetailsModal load error:", err);
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to load details",
          variant: "destructive",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  async function hashSHA256(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function uploadDecision() {
    if (!decisionFile) {
      toast({
        title: "Error",
        description: "Choose a decision document first.",
        variant: "destructive",
      });
      return;
    }
    try {
      setUploading(true);
      const sha256 = await hashSHA256(decisionFile);
      const key = `decisions/${id}/${Date.now()}_${decisionFile.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(key, decisionFile, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const issuedBy = user?.email ?? "unknown";
      const issuedAt = new Date().toISOString();

      const { data: existing } = await supabase
        .from("decisions")
        .select("id,s3_key")
        .eq("application_id", id)
        .order("issued_at", { ascending: false })
        .limit(1);

      if (existing && existing.length && !existing[0].s3_key) {
        const { error: updErr } = await supabase
          .from("decisions")
          .update({ s3_key: key, sha256, issued_by: issuedBy, issued_at: issuedAt })
          .eq("id", existing[0].id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from("decisions").insert({
          application_id: id,
          s3_key: key,
          sha256,
          issued_by: issuedBy,
          issued_at: issuedAt,
        });
        if (insErr) throw insErr;
      }

      const { error: stErr } = await supabase
        .from("applications")
        .update({ status: "DECISION_UPLOADED" })
        .eq("id", id);
      if (stErr) throw stErr;

      const { error: logErr } = await supabase.from("audit_log").insert({
        application_id: id,
        action: "DECISION_UPLOADED",
        meta: { s3_key: key, sha256, by: issuedBy },
      });
      if (logErr) throw logErr;

      toast({
        title: "Success",
        description: "Decision document uploaded and recorded.",
      });
    } catch (err: any) {
      console.error("Upload decision error:", err);
      toast({
        title: "Error",
        description: err.message ?? "Failed to upload decision",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  function ApplicantFields() {
    const name = app?.data?.applicant?.fullName ?? "—";
    const phone = app?.data?.applicant?.phone ?? "—";
    const email = app?.user_email ?? "—";
    return (
      <section>
        <h4 className="font-semibold mb-2">Applicant</h4>
        <div><strong>Name:</strong> {name}</div>
        <div><strong>Contact:</strong> {phone}</div>
        <div><strong>Email:</strong> {email}</div>
      </section>
    );
  }

  async function downloadDoc(doc: any) {
    try {
      if (!doc?.s3_key) {
        toast({
          title: "Error",
          description: "No file key available.",
          variant: "destructive",
        });
        return;
      }
      const { data, error } = await supabase.storage.from("documents").download(doc.s3_key);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      window.open(url);
      // Clean up the blob URL after a delay to prevent memory leaks
      const BLOB_CLEANUP_DELAY = 1000;
      setTimeout(() => URL.revokeObjectURL(url), BLOB_CLEANUP_DELAY);
    } catch (err: any) {
      console.error("download error", err);
      toast({
        title: "Error",
        description: err.message ?? "Failed to download file",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/30">
      <div className="w-full max-w-3xl bg-white rounded shadow-lg overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Application {id}</h3>
            <div className="text-sm text-muted-foreground">{app?.permit_types?.name ?? ""}</div>
          </div>
          <div>
            <button onClick={onClose} className="px-3 py-1 border rounded">Close</button>
          </div>
        </div>
        <div className="p-4 space-y-6 max-h-[85vh] overflow-auto">
          {loading ? (
            <div>Loading…</div>
          ) : (
            <>
              <ApplicantFields />
              <section>
                <h4 className="font-semibold mb-2">Application Details</h4>
                {app?.data?.fields ? (
                  <div className="space-y-3">
                    {Object.entries(app.data.fields).map(([key, value]) => {
                      const label = formatFieldLabel(key);
                      // Check for null/undefined/empty string, but allow 0 and false as valid values
                      const hasValue = value != null && value !== '';
                      
                      return (
                        <div key={key} className="border-l-2 border-primary/20 pl-3">
                          <div className="text-sm font-medium text-muted-foreground">{label}</div>
                          <div className="mt-1">
                            {hasValue 
                              ? String(value) 
                              : <span className="text-muted-foreground italic">Not provided</span>
                            }
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No additional application details.</div>
                )}
              </section>
              <section>
                <h4 className="font-semibold mb-2">Files</h4>
                {docs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No files uploaded.</div>
                ) : (
                  <ul className="space-y-2">
                    {docs.map((d) => (
                      <li key={d.s3_key} className="flex items-center justify-between border rounded p-2">
                        <div>
                          <div className="font-medium">{d.filename}</div>
                          <div className="text-xs text-muted-foreground">{d.mime} · {d.size} bytes</div>
                        </div>
                        <div>
                          <button onClick={() => downloadDoc(d)} className="px-2 py-1 border rounded text-sm">View</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h4 className="font-semibold mb-2">Upload decision document</h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input type="file" onChange={(e) => setDecisionFile(e.target.files?.[0] ?? null)} />
                  <button disabled={uploading || !decisionFile} onClick={uploadDecision} className="px-3 py-2 border rounded disabled:opacity-50">
                    {uploading ? "Uploading…" : "Upload & Record Decision"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">If a placeholder decision row already exists it will be updated; otherwise a new row will be created.</p>
              </section>
              <section>
                <h4 className="font-semibold mb-2">Request Additional Information</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Request specific information from the citizen if the application is incomplete or needs clarification.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowRequestInfoModal(true)}
                  disabled={app?.status === APPLICATION_STATUSES.CLARIFICATION_REQUESTED}
                >
                  Request Info
                </Button>
                {app?.status === APPLICATION_STATUSES.CLARIFICATION_REQUESTED && (
                  <p className="text-xs text-orange-600 mt-2">
                    Information already requested for this application.
                  </p>
                )}
              </section>
              <section>
                <h4 className="font-semibold mb-2">Audit / Events</h4>
                <div className="space-y-4">
                  {events.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No events</div>
                  ) : (
                    events.map((ev: any, i: number) => (
                      <div key={i} className="border rounded p-3">
                        <div className="font-semibold text-sm mb-2">
                          {ev.action} — {new Date(ev.created_at).toLocaleString()}
                        </div>
                        {ev.meta && typeof ev.meta === 'object' && Object.keys(ev.meta).length > 0 ? (
                          <div className="space-y-2 mt-2">
                            {Object.entries(ev.meta).map(([key, value]) => {
                              const label = formatFieldLabel(key);
                              // Check for null/undefined/empty string, but allow 0 and false as valid values
                              const hasValue = value != null && value !== '';
                              
                              return (
                                <div key={key} className="border-l-2 border-primary/20 pl-3">
                                  <div className="text-xs font-medium text-muted-foreground">{label}</div>
                                  <div className="text-sm mt-1">
                                    {hasValue 
                                      ? String(value) 
                                      : <span className="text-muted-foreground italic">Not provided</span>
                                    }
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic mt-1">No additional details</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      {showRequestInfoModal && app && (
        <RequestInfoModal
          applicationId={id}
          applicationData={app.data}
          open={showRequestInfoModal}
          onClose={() => setShowRequestInfoModal(false)}
          onSuccess={() => {
            // Refetch application data to update status
            (async () => {
              try {
                const { data, error } = await supabase
                  .from("applications")
                  .select("*, permit_types(name,slug,municipality_id,municipalities(name))")
                  .eq("id", id)
                  .maybeSingle();
                if (!error && data) {
                  setApp(data);
                }
              } catch (err) {
                console.error("Failed to refetch application:", err);
              }
            })();
          }}
        />
      )}
    </div>
  );
}