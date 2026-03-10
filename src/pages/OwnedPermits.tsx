import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode"; // NEW
import { GeneratePermitButton } from "@/components/GeneratePermitButton";
import { useToast } from "@/hooks/use-toast";
import { APPLICATION_STATUSES, DECISION_TYPES } from "@/lib/constants";

// Application, decision, permit, and decision document types
interface AppRow {
  id: string;
  status: string;
  created_at: string;
  permit_types?: { name: string; municipality_id: string } | null;
}
interface DecisionRow {
  application_id: string;
  decision: string | null;
  issued_at: string | null;
}
interface PermitRow {
  application_id: string;
  permit_id: string;
  pdf_s3_key: string;
  pdf_sha256: string | null;
  status: string;
  issued_at: string | null;
  qr_url?: string; // NEW
}
interface DecisionDoc {
  s3_key: string;
  sha256: string | null;
  issued_at: string | null;
  issued_by: string | null;
  decision: string | null;
}

// Phase type used for tab filtering
type Phase = "PENDING" | "NEEDS_INFO" | "APPROVED" | "DECLINED";

type CategorizedApp = AppRow & { phase: Phase; decision: string | null };

type TabKey = "all" | "pending" | "needs-info" | "approved" | "declined";

const BLOB_CLEANUP_DELAY = 1000; // milliseconds

export default function OwnedPermits() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [apps, setApps] = useState<AppRow[]>([]);
  const [decisions, setDecisions] = useState<Record<string, DecisionRow>>({});
  const [permitsByApp, setPermitsByApp] = useState<Record<string, PermitRow>>({});
  const [fetching, setFetching] = useState(true);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [decisionDocs, setDecisionDocs] = useState<DecisionDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("all");

  // QR preview (Data URL) map keyed by application id
  const [qrPreviewMap, setQrPreviewMap] = useState<Record<string, string>>({});

  // Fetch all user applications & related decision + permit data
  const fetchPermitsData = useCallback(async () => {
    if (!user) return;
    try {
      setFetching(true);
      const { data: appRows, error: appErr } = await supabase
        .from("applications")
        .select("id,status,created_at,permit_types(name,municipality_id)")
        .eq("user_email", user.email)
        .order("created_at", { ascending: false });
      if (appErr) throw appErr;
      const rows = appRows ?? [];
      setApps(rows);

      if (rows.length) {
        const ids = rows.map(r => r.id);
        const [
          { data: decisionRows, error: decErr },
          { data: permitRows, error: permErr }
        ] = await Promise.all([
          supabase
            .from("decisions")
            .select("application_id, decision, issued_at")
            .in("application_id", ids),
          supabase
            .from("permits")
            .select("application_id, permit_id, pdf_s3_key, pdf_sha256, status, issued_at, qr_url")
            .in("application_id", ids)
        ]);
        if (decErr) throw decErr;
        if (permErr) throw permErr;

        const dMap: Record<string, DecisionRow> = {};
        (decisionRows ?? []).forEach(d => { dMap[d.application_id] = d; });
        setDecisions(dMap);

        const pMap: Record<string, PermitRow> = {};
        (permitRows ?? []).forEach(p => { pMap[p.application_id] = p; });
        setPermitsByApp(pMap);
      } else {
        setDecisions({});
        setPermitsByApp({});
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load applications",
        variant: "destructive",
      });
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermitsData();
  }, [fetchPermitsData]);

  const categorized: CategorizedApp[] = useMemo(() => {
    return apps.map(a => {
      const decisionRaw = decisions[a.id]?.decision || "";
      const decisionNorm = decisionRaw.trim().toUpperCase();
      const decision: string | null = decisionNorm || null;

      const appStatus = (a.status || "").trim().toUpperCase();
      const hasPermitPdf = Boolean(permitsByApp[a.id]?.pdf_s3_key);

      let phase: Phase = "PENDING";

      if (
        decisionNorm === DECISION_TYPES.REQUEST_INFO ||
        appStatus === APPLICATION_STATUSES.CLARIFICATION_REQUESTED
      ) {
        phase = "NEEDS_INFO";
      } else if (
        decisionNorm === DECISION_TYPES.APPROVED ||
        appStatus === APPLICATION_STATUSES.DECISION_UPLOADED && decisionNorm === DECISION_TYPES.APPROVED ||
        appStatus === APPLICATION_STATUSES.CLOSED && decisionNorm === DECISION_TYPES.APPROVED ||
        hasPermitPdf
      ) {
        phase = "APPROVED";
      } else if (
        decisionNorm === DECISION_TYPES.DECLINED ||
        (appStatus === APPLICATION_STATUSES.DECISION_UPLOADED && decisionNorm === DECISION_TYPES.DECLINED) ||
        (appStatus === APPLICATION_STATUSES.CLOSED && decisionNorm === DECISION_TYPES.DECLINED)
      ) {
        phase = "DECLINED";
      }

      return { ...a, phase, decision };
    });
  }, [apps, decisions, permitsByApp]);

  // Generate QR previews for approved permits
  useEffect(() => {
    let cancelled = false;
    async function build() {
      const newMap: Record<string, string> = {};
      for (const [appId, permit] of Object.entries(permitsByApp)) {
        const qrUrl = permit?.qr_url;
        if (qrUrl) {
          try {
            const dataUrl = await QRCode.toDataURL(qrUrl, { margin: 0, scale: 3 });
            if (!cancelled) newMap[appId] = dataUrl;
          } catch (e) {
            console.error("QR preview generation failed", e);
          }
        }
      }
      if (!cancelled) setQrPreviewMap(newMap);
    }
    build();
    return () => { cancelled = true; };
  }, [permitsByApp]);

  // Filter by active tab
  const filtered: CategorizedApp[] = useMemo(() => {
    return categorized.filter(c => {
      switch (activeTab) {
        case "pending": return c.phase === "PENDING";
        case "needs-info": return c.phase === "NEEDS_INFO";
        case "approved": return c.phase === "APPROVED";
        case "declined": return c.phase === "DECLINED";
        default: return true; // all
      }
    });
  }, [categorized, activeTab]);

  async function openDecisionDocs(appId: string) {
    setSelectedAppId(appId);
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from("decisions")
        .select("s3_key, sha256, issued_at, issued_by, decision")
        .eq("application_id", appId)
        .not("s3_key", "is", null)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      setDecisionDocs(data ?? []);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load decision files",
        variant: "destructive",
      });
    } finally {
      setLoadingDocs(false);
    }
  }

  async function downloadFile(key: string) {
    try {
      const { data, error } = await supabase.storage.from("documents").download(key);
      if (error) throw error;
      
      // Create a blob URL and trigger download
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = key.split("/").pop() || "permit.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      setTimeout(() => URL.revokeObjectURL(url), BLOB_CLEANUP_DELAY);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to download file",
        variant: "destructive",
      });
    }
  }

  function phaseBadge(phase: Phase) {
    const base = "inline-block px-2 py-0.5 rounded text-xs font-medium";
    switch (phase) {
      case "PENDING": return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
      case "NEEDS_INFO": return <span className={`${base} bg-orange-100 text-orange-800`}>Needs Info</span>;
      case "APPROVED": return <span className={`${base} bg-green-100 text-green-800`}>Approved</span>;
      case "DECLINED": return <span className={`${base} bg-red-100 text-red-800`}>Declined</span>;
      default: return <span className={`${base} bg-gray-100 text-gray-700`}>{phase}</span>;
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;
  if (!user) return <main className="p-6">Please log in to view your permits.</main>;

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">My Permits</h1>
      <p className="text-sm text-gray-600 mb-6">
        All permit applications linked to your account. Use tabs to view by status.
      </p>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton label="All" value="all" active={activeTab} setActive={setActiveTab} />
        <TabButton label="Pending" value="pending" active={activeTab} setActive={setActiveTab} />
        <TabButton label="Needs Info" value="needs-info" active={activeTab} setActive={setActiveTab} />
        <TabButton label="Approved" value="approved" active={activeTab} setActive={setActiveTab} />
        <TabButton label="Declined" value="declined" active={activeTab} setActive={setActiveTab} />
      </div>

      {fetching ? (
        <div>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground">No applications in this category.</div>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">ID</th>
                <th className="text-left px-3 py-2">Permit</th>
                <th className="text-left px-3 py-2">Municipality</th>
                <th className="text-left px-3 py-2">Phase</th>
                <th className="text-left px-3 py-2">QR</th>
                <th className="text-left px-3 py-2">Submitted</th>
                <th className="text-left px-3 py-2">Actions</th>
                <th className="text-left px-3 py-2">Permit PDF</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const permit = permitsByApp[a.id];
                const qrPreview = qrPreviewMap[a.id];
                return (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{a.id}</td>
                    <td className="px-3 py-2">{a.permit_types?.name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.permit_types?.municipality_id ?? "—"}</td>
                    <td className="px-3 py-2">{phaseBadge(a.phase)}</td>
                    <td className="px-3 py-2">
                      {a.phase === "APPROVED" && qrPreview ? (
                        <img
                          src={qrPreview}
                          alt="Permit QR"
                          className="w-16 h-16 border bg-white cursor-pointer"
                          title="Open verification page"
                          onClick={() => {
                            if (permit?.permit_id) {
                              window.open(`/permits/${permit.permit_id}`, "_blank");
                            }
                          }}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{new Date(a.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => openDecisionDocs(a.id)}
                        className="px-3 py-1.5 border rounded text-xs"
                      >
                        Decision Docs
                      </button>
                      {a.phase === "NEEDS_INFO" && (
                        <button
                          onClick={() => navigate(`/applications/${a.id}/provide-info`)}
                          className="px-3 py-1.5 border rounded text-xs bg-orange-50"
                        >
                          Provide Info
                        </button>
                      )}
                      {a.phase === "DECLINED" && (
                        <span className="text-xs text-red-600">Declined</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {permit?.pdf_s3_key ? (
                        <button
                          onClick={() => downloadFile(permit.pdf_s3_key)}
                          className="px-3 py-1.5 border rounded text-xs"
                        >
                          Download
                        </button>
                      ) : a.phase === "APPROVED" && permit?.permit_id ? (
                        <GeneratePermitButton
                          permitId={permit.permit_id}
                          onSuccess={() => fetchPermitsData()}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">Not yet generated</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedAppId && (
        <DecisionDocsModal
          appId={selectedAppId}
          loading={loadingDocs}
          docs={decisionDocs}
          onClose={() => setSelectedAppId(null)}
          download={downloadFile}
        />
      )}
    </main>
  );
}

function TabButton({ label, value, active, setActive }: { label: string; value: TabKey; active: TabKey; setActive: (v: TabKey) => void }) {
  const isActive = active === value;
  return (
    <button
      onClick={() => setActive(value)}
      className={`px-3 py-1.5 rounded text-sm border ${
        isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

function DecisionDocsModal({
  appId,
  loading,
  docs,
  onClose,
  download
}: {
  appId: string;
  loading: boolean;
  docs: DecisionDoc[];
  onClose: () => void;
  download: (key: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded shadow-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Decision Documents</h3>
            <div className="text-xs text-muted-foreground">Application {appId}</div>
          </div>
            <button onClick={onClose} className="px-3 py-1 border rounded text-sm">
              Close
            </button>
        </div>
        <div className="p-4">
          {loading ? (
            <div>Loading…</div>
          ) : docs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No decision documents yet.</div>
          ) : (
            <ul className="space-y-2">
              {docs.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between border rounded p-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{d.s3_key.split("/").slice(-1)[0]}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.decision ?? "—"} · {d.issued_by ?? "—"} · {d.issued_at ? new Date(d.issued_at).toLocaleString() : "—"}
                    </div>
                  </div>
                  <button
                    onClick={() => download(d.s3_key)}
                    className="px-2 py-1 border rounded text-xs"
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}