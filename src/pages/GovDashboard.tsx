import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { generatePermitForApplication } from "@/lib/PermitGenerationService";
import { formatFieldLabel } from "@/lib/utils";
import { RequestInfoModalWrapper } from "@/components/RequestInfoModalWrapper";

type Row = {
  id: string;
  status: string;
  user_email: string | null;
  created_at: string;
  permit_types?: { name: string; slug: string; municipality_id: string } | null;
};

type DecisionType = "APPROVED" | "DECLINED" | "REQUEST_INFO";

export default function GovDashboard() {
  const { loading, user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [fetching, setFetching] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [requestInfoAppId, setRequestInfoAppId] = useState<string | null>(null);

  // Default to show ALL first so data appears even if not exactly "pending"
  const [search, setSearch] = useState("");
  const [permitFilter, setPermitFilter] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [oldestPendingFirst, setOldestPendingFirst] = useState(false);

  const fetchApplications = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("applications")
      .select("id,status,user_email,created_at,permit_types(name,slug,municipality_id)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error.message || "Failed to load applications",
        variant: "destructive",
      });
    } else {
      setRows(data ?? []);
    }
    setFetching(false);
  };

  useEffect(() => {
    if (loading || !user) return;
    fetchApplications();
  }, [user, loading]);

  async function ensureDecisionRow(applicationId: string, issuedBy: string, decision: DecisionType) {
    const { data: existing, error: selErr } = await supabase
      .from("decisions")
      .select("id,s3_key,decision")
      .eq("application_id", applicationId)
      .order("issued_at", { ascending: false })
      .limit(1);
    if (selErr) throw selErr;

    if (!existing?.length) {
      const { error: insErr } = await supabase.from("decisions").insert({
        application_id: applicationId,
        issued_by: issuedBy,
        issued_at: new Date().toISOString(),
        decision,
        note: {}
      } as any);
      if (insErr) throw insErr;
    } else {
      const row = existing[0];
      const { error: updErr } = await supabase
        .from("decisions")
        .update({ decision })
        .eq("id", row.id);
      if (updErr) throw updErr;
    }
  }

  async function decide(id: string, decision: DecisionType) {
    try {
      let usedRpc = false;
      const { error: rpcError } = await supabase.rpc("set_application_status", {
        p_app_id: id,
        p_status: "DECISION_UPLOADED",
        p_note: { decision },
      });
      if (!rpcError) usedRpc = true;

      if (!usedRpc) {
        const { error: updateError } = await supabase
          .from("applications")
          .update({ status: "DECISION_UPLOADED" })
          .eq("id", id);
        if (updateError) throw updateError;
      }

      const issuedBy = user?.email ?? "unknown";
      await ensureDecisionRow(id, issuedBy, decision);

      const { error: logError } = await supabase.from("audit_log").insert({
        application_id: id,
        action: "DECISION",
        meta: { decision, by: issuedBy },
      });
      if (logError) throw logError;

      // Generate QR-coded permit if approved and none exists yet
      if (decision === "APPROVED") {
        const { data: existingPermit } = await supabase
          .from("permits")
          .select("id")
          .eq("application_id", id)
          .limit(1);
        if (!existingPermit?.length) {
          try {
            await generatePermitForApplication(id);
          } catch (genErr: any) {
            console.error("Permit generation failed:", genErr);
          }
        }
      }

      const { data } = await supabase
        .from("applications")
        .select("id,status,user_email,created_at,permit_types(name,slug,municipality_id)")
        .order("created_at", { ascending: false })
        .limit(500);
      setRows(data ?? []);
    } catch (err: any) {
      console.error("Decision error:", err);
      alert(err.message ?? "Failed to record decision");
    }
  }

  const uniquePermits = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.permit_types?.name) set.add(r.permit_types.name); });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    let r = rows;
    if (pendingOnly) r = r.filter(x => x.status === "pending");
    if (permitFilter) r = r.filter(x => (x.permit_types?.name ?? "") === permitFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(x =>
        x.id.toLowerCase().includes(q) ||
        (x.user_email ?? "").toLowerCase().includes(q) ||
        (x.permit_types?.name ?? "").toLowerCase().includes(q)
      );
    }
    if (pendingOnly && oldestPendingFirst) {
      r = [...r].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return r;
  }, [rows, pendingOnly, permitFilter, search, oldestPendingFirst]);

  if (loading) return <main className="p-6">Loading…</main>;
  if (!user) return <main className="p-6">Please sign in to access the government dashboard.</main>;

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Government Dashboard</h1>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className="border rounded px-3 py-2 text-sm"
          placeholder="Search id, email, permit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2 text-sm"
          value={permitFilter}
          onChange={(e) => setPermitFilter(e.target.value)}
        >
          <option value="">All permits</option>
          {uniquePermits.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
          Pending only
        </label>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={oldestPendingFirst}
            onChange={(e) => setOldestPendingFirst(e.target.checked)}
            disabled={!pendingOnly}
          />
          Oldest pending first
        </label>
      </div>
      {fetching ? (
        <div>Loading…</div>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>ID</Th>
                <Th>Email</Th>
                <Th>Municipality</Th>
                <Th>Permit</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedAppId(r.id)}
                >
                  <Td mono>{r.id}</Td>
                  <Td>{r.user_email ?? "—"}</Td>
                  <Td mono>{r.permit_types?.municipality_id ?? "—"}</Td>
                  <Td>{r.permit_types?.name ?? "—"}</Td>
                  <Td>{r.status}</Td>
                  <Td>{new Date(r.created_at).toLocaleString()}</Td>
                  <Td>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          decide(r.id, "APPROVED");
                        }}
                        className="px-2 py-1 bg-green-600 text-white rounded"
                      >
                        Approve
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          decide(r.id, "DECLINED");
                        }}
                        className="px-2 py-1 bg-red-600 text-white rounded"
                      >
                        Decline
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRequestInfoAppId(r.id);
                        }}
                        className="px-2 py-1 bg-yellow-500 text-white rounded"
                      >
                        Request info
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    No applications match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {selectedAppId && (
        <DetailsModal id={selectedAppId} onClose={() => setSelectedAppId(null)} />
      )}
      {requestInfoAppId && (
        <RequestInfoModalWrapper
          appId={requestInfoAppId}
          onClose={() => setRequestInfoAppId(null)}
          onSuccess={() => {
            fetchApplications();
            setRequestInfoAppId(null);
          }}
        />
      )}
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2">{children}</th>;
}
function Td({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2 ${mono ? "font-mono text-xs" : ""}`}>{children}</td>;
}

function DetailsModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [decisionFile, setDecisionFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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
            .select("*, permit_types(name,slug,municipality_id)")
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
        alert(err instanceof Error ? err.message : "Failed to load details");
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
      alert("Choose a decision document first.");
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

      alert("Decision document uploaded and recorded.");
    } catch (err: any) {
      console.error("Upload decision error:", err);
      alert(err.message ?? "Failed to upload decision");
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
        alert("No file key available.");
        return;
      }
      const { data, error } = await supabase.storage.from("documents").download(doc.s3_key);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      window.open(url);
    } catch (err: any) {
      console.error("download error", err);
      alert(err.message ?? "Failed to download file");
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
    </div>
  );
}