import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";
import { useToast } from "@/hooks/use-toast";

type Permit = {
  permit_id: string;
  application_id: string;
  municipality_id: string;
  permit_type: string;
  owner_name: string;
  plot_address: string;
  status: string;
  issued_at: string;
  pdf_sha256: string;
  qr_url: string;
  pdf_s3_key: string;
};

const BLOB_CLEANUP_DELAY = 1000; // milliseconds

export default function VerifyPermit() {
  const { permitId } = useParams();
  const { toast } = useToast();
  const [permit, setPermit] = useState<Permit | null>(null);
  const [decision, setDecision] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    if (!permitId) return;
    (async () => {
      try {
        setLoading(true);
        const { data: permitRow, error: permErr } = await supabase
          .from("permits")
          .select("*")
          .eq("permit_id", permitId)
          .maybeSingle();
        if (permErr) throw permErr;
        setPermit(permitRow ?? null);

        if (permitRow) {
          const [{ data: decRows }, { data: auditRows }] = await Promise.all([
            supabase
              .from("decisions")
              .select("decision, issued_at, issued_by")
              .eq("application_id", permitRow.application_id)
              .order("issued_at", { ascending: false })
              .limit(1),
            supabase
              .from("audit_log")
              .select("action, meta, created_at")
              .eq("application_id", permitRow.application_id)
              .order("created_at", { ascending: true }),
          ]);
          if (decRows?.length) setDecision(decRows[0].decision);
          setLogs(auditRows ?? []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [permitId]);

  useEffect(() => {
    let cancelled = false;
    async function gen() {
      if (permit?.qr_url) {
        try {
          const dataUrl = await QRCode.toDataURL(permit.qr_url, { margin: 1, scale: 4 });
            if (!cancelled) setQrDataUrl(dataUrl);
        } catch (e) {
          console.error("QR render error", e);
        }
      }
    }
    gen();
    return () => { cancelled = true; };
  }, [permit?.qr_url]);

  async function downloadPDF() {
    if (!permit?.pdf_s3_key) return;
    const { data, error } = await supabase.storage.from("documents").download(permit.pdf_s3_key);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    
    // Create a blob URL and trigger download
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${permit.permit_id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    setTimeout(() => URL.revokeObjectURL(url), BLOB_CLEANUP_DELAY);
  }

  function copyVerificationLink() {
    if (!permit?.qr_url) return;
    navigator.clipboard.writeText(permit.qr_url)
      .then(() => {
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 3000);
      })
      .catch(() => {});
  }

  if (loading) return <main className="p-6">Verifying…</main>;
  if (!permit) return <main className="p-6">No permit found for ID: {permitId}</main>;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">Permit Verified</h1>
      <p className="text-sm text-gray-600 mb-6">
        Issued by Municipality of {permit.municipality_id} on {new Date(permit.issued_at).toLocaleString()}
      </p>

      {qrDataUrl && (
        <section className="mb-6 border rounded p-4 bg-white shadow-sm">
          <h2 className="font-semibold mb-3">QR Verification</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <img
              src={qrDataUrl}
              alt="Permit QR Code"
              className="w-48 h-48 border p-2 bg-white"
            />
            <div className="text-xs break-all flex-1">
              <strong>Verification Link:</strong>{" "}
              <a
                href={permit.qr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {permit.qr_url}
              </a>
              <div className="mt-2">
                <button
                  onClick={copyVerificationLink}
                  className="px-2 py-1 border rounded text-xs"
                >
                  {copyState === "copied" ? "Copied!" : "Copy Link"}
                </button>
              </div>
              <p className="mt-3 text-[11px] text-gray-500">
                Scan or visit this link to confirm the permit’s authenticity in real time.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mb-6 border rounded p-4 bg-white shadow-sm">
        <h2 className="font-semibold mb-3">Core Data</h2>
        <div className="text-sm space-y-1">
          <div><strong>Permit ID:</strong> {permit.permit_id}</div>
          <div><strong>Status:</strong> {permit.status}</div>
          <div><strong>Decision:</strong> {decision ?? "—"}</div>
          <div><strong>Owner:</strong> {permit.owner_name}</div>
          <div><strong>Plot / Address:</strong> {permit.plot_address}</div>
          <div><strong>Permit Type:</strong> {permit.permit_type}</div>
          <div><strong>Hash (SHA-256):</strong> <code className="break-all">{permit.pdf_sha256}</code></div>
        </div>
        <button
          onClick={downloadPDF}
          className="mt-4 px-3 py-1.5 border rounded text-xs"
        >
          Download Official PDF
        </button>
      </section>

      <section className="mb-6 border rounded p-4 bg-white shadow-sm">
        <h2 className="font-semibold mb-3">Audit Trail</h2>
        {logs.length === 0 ? (
          <div className="text-sm text-gray-500">No audit events.</div>
        ) : (
          <ul className="text-xs space-y-2">
            {logs.map((l, i) => (
              <li key={i} className="border rounded p-2">
                <div><strong>{l.action}</strong> • {new Date(l.created_at).toLocaleString()}</div>
                {l.meta && (
                  <pre className="mt-1 bg-gray-50 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(l.meta, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6 border rounded p-4 bg-white shadow-sm">
        <h2 className="font-semibold mb-3">Authenticity Notes</h2>
        <p className="text-sm text-gray-700">
          Manual validation of land ownership, engineering plans, zoning rules, and identity was conducted by the municipality.
          Always re‑verify the permit status by scanning the QR code or using the verification link.
        </p>
      </section>

      <footer className="text-xs text-gray-500 mt-10">
        Lebanon Digital Permits • Trusted digital front door.
      </footer>
    </main>
  );
}