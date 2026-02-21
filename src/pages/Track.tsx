import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface ApplicationRow {
  id: string;
  data: any;
  status: string;
  created_at: string;
}

interface AuditEvent {
  action: string;
  meta: any;
  created_at: string;
}

export default function Track() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<ApplicationRow | null>(null);
  const [decision, setDecision] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) {
        navigate("/track", { replace: true });
        return;
      }
      setLoading(true);
      setError(null);

      // Fetch application including status
      const { data: appData, error: appErr } = await supabase
        .from("applications")
        .select("id, data, status, created_at")
        .eq("id", id)
        .maybeSingle();

      if (appErr) {
        console.error(appErr);
        setError(appErr.message);
        setLoading(false);
        return;
      }
      setApp(appData as ApplicationRow);

      // Fetch latest decision-related audit event if any
      const { data: events, error: evErr } = await supabase
        .from("audit_log")
        .select("action, meta, created_at")
        .eq("application_id", id)
        .in("action", ["DECISION", "DECISION_UPLOADED"]) // both kinds of decision events
        .order("created_at", { ascending: false })
        .limit(1);

      if (!evErr && events && events.length) {
        const ev = events[0] as AuditEvent;
        // Try to resolve decision from meta.decision or meta.s3_key (uploaded doc implies final decision). Meta may hold { decision: "APPROVED" | "DECLINED" }
        const metaDec = ev.meta?.decision;
        if (typeof metaDec === "string") setDecision(metaDec);
        else if (ev.action === "DECISION_UPLOADED") setDecision("APPROVED"); // heuristic: uploaded decision doc usually means approved; adjust if needed
      }

      setLoading(false);
    })();
  }, [id, navigate]);

  if (loading) return <main className="p-6">Loading…</main>;
  if (error) return <main className="p-6">Error: {error}</main>;
  if (!app) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <h1 className="text-xl font-semibold mb-2">Application not found</h1>
        <p className="text-muted-foreground mb-4">Please check your ID and try again.</p>
        <Link to="/track" className="underline">Go back to track lookup</Link>
      </main>
    );
  }

  const info = app.data?.applicant || {};
  const rawStatus = app.status;
  const normalized = normalizeStatus(rawStatus);
  const finalDecision = decision;

  return (
    <main className="min-h-screen bg-background">
      <section className="bg-gradient-hero text-primary-foreground py-10 shadow-md">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Application #{app.id}</h1>
          <p className="mt-2 text-primary-foreground/90">Status tracking and details.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-card text-card-foreground rounded-lg p-6 shadow-md border border-border">
          <h2 className="text-xl font-semibold mb-2">Applicant</h2>
          <p><strong>Name:</strong> {info.fullName ?? "—"}</p>
          <p><strong>Email:</strong> {info.email ?? "—"}</p>
          <p><strong>Created at:</strong> {new Date(app.created_at).toLocaleString()}</p>
        </div>

        <div className="bg-card text-card-foreground rounded-lg p-6 shadow-md border border-border">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <StatusBadge status={normalized} decision={finalDecision} />
          {finalDecision && (
            <p className="mt-3 text-sm">Decision: <strong>{finalDecision}</strong></p>
          )}
        </div>

        {/* Raw data (optional debug) */}
        {app.data && (
          <div className="bg-card text-card-foreground rounded-lg p-6 shadow-md border border-border">
            <h2 className="text-xl font-semibold mb-2">Form Data (JSON)</h2>
            <pre className="bg-gray-50 p-3 text-xs rounded overflow-auto max-h-72">{JSON.stringify(app.data, null, 2)}</pre>
          </div>
        )}
      </section>

      <footer className="bg-lebanon-cedar text-white py-6">
        <div className="max-w-4xl mx-auto px-4 text-sm">
          Need help? Contact your municipality for assistance.
        </div>
      </footer>
    </main>
  );
}

function normalizeStatus(s: string): string {
  if (!s) return "UNKNOWN";
  const upper = s.toUpperCase();
  switch (upper) {
    case "SUBMITTED":
      return "SUBMITTED";
    case "ROUTED":
      return "ROUTED";
    case "CLARIFICATION_REQUESTED":
      return "CLARIFICATION_REQUESTED";
    case "DECISION_UPLOADED":
      return "DECISION_UPLOADED";
    case "CLOSED":
      return "CLOSED";
    default:
      return upper;
  }
}

function StatusBadge({ status, decision }: { status: string; decision: string | null }) {
  let label = status;
  let classes = "inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium";

  switch (status) {
    case "SUBMITTED":
      classes += " bg-blue-100 text-blue-700";
      label = "Submitted";
      break;
    case "ROUTED":
      classes += " bg-indigo-100 text-indigo-700";
      label = "Routed to municipality";
      break;
    case "CLARIFICATION_REQUESTED":
      classes += " bg-yellow-100 text-yellow-800";
      label = "Clarification requested";
      break;
    case "DECISION_UPLOADED":
      if (decision === "APPROVED") {
        classes += " bg-green-100 text-green-700";
        label = "Approved";
      } else if (decision === "DECLINED" || decision === "REJECTED") {
        classes += " bg-red-100 text-red-700";
        label = "Declined";
      } else {
        classes += " bg-purple-100 text-purple-700";
        label = "Decision uploaded";
      }
      break;
    case "CLOSED":
      classes += " bg-gray-200 text-gray-800";
      label = "Closed";
      break;
    default:
      classes += " bg-gray-100 text-gray-600";
      label = status.replace(/_/g, " ").toLowerCase();
  }

  return <div className={classes}>{label}</div>;
}