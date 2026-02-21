import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type AppRow = {
  id: string;
  status: string;
  user_email: string | null;
  created_at: string;
  permit_types?: { name: string; slug: string; municipality_id: string } | null;
};

const PAGE_SIZE = 20;

export default function DeveloperDashboard() {
  const { isDeveloper, loading } = useAuth();
  const qc = useQueryClient();

  const [status, setStatus] = useState<string>("ALL");
  const [municipalityId, setMunicipalityId] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const { data: municipalities = [] } = useQuery({
    queryKey: ["municipalities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("municipalities").select("id,name").order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string }>;
    },
    enabled: isDeveloper,
  });

  const appsKey = useMemo(
    () => ["apps", { status, municipalityId, query, page }],
    [status, municipalityId, query, page]
  );

  const appsQuery = useQuery({
    queryKey: appsKey,
    queryFn: async () => {
      // Base select. Supabase/PostgREST embeds related row by FK name “permit_types”
      // If your relationship name differs, adjust to match the FK (applications.permit_type_id → permit_types.id).
      let q = supabase
        .from("applications")
        .select("id,status,user_email,created_at,permit_types(name,slug,municipality_id)", { count: "exact" })
        .order("created_at", { ascending: false });

      if (status !== "ALL") q = q.eq("status", status);
      if (municipalityId !== "ALL") q = q.eq("permit_types.municipality_id", municipalityId);

      // “Search” by user_email or id
      if (query.trim()) {
        const qLike = `%${query.trim()}%`;
        // or() needs filters on columns; PostgREST uses ilike for case-insensitive
        q = q.or(`user_email.ilike.${qLike},id.ilike.${qLike}`);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await q.range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as AppRow[], total: count ?? 0 };
    },
    keepPreviousData: true,
    enabled: isDeveloper,
  });

  // Realtime updates: refresh list when applications change
  useEffect(() => {
    if (!isDeveloper) return;
    const ch = supabase
      .channel("dev-apps")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications" },
        () => qc.invalidateQueries({ queryKey: appsKey })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isDeveloper, qc, appsKey]);

  const [selected, setSelected] = useState<AppRow | null>(null);

  if (loading) return <main className="p-6">Loading…</main>;
  if (!isDeveloper) return <main className="p-6">Access denied.</main>;

  const total = appsQuery.data?.total ?? 0;
  const rows = appsQuery.data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function exportCSV() {
    // Fetch all (simple way; for big data switch to server export)
    let q = supabase
      .from("applications")
      .select("id,status,user_email,created_at,permit_types(name,slug,municipality_id)");
    if (status !== "ALL") q = q.eq("status", status);
    if (municipalityId !== "ALL") q = q.eq("permit_types.municipality_id", municipalityId);
    if (query.trim()) {
      const qLike = `%${query.trim()}%`;
      q = q.or(`user_email.ilike.${qLike},id.ilike.${qLike}`);
    }
    const { data, error } = await q;
    if (error) {
      alert(error.message);
      return;
    }
    const header = ["id", "email", "status", "municipality_id", "permit_type", "created_at"];
    const lines = (data ?? []).map((r: any) => [
      r.id,
      r.user_email ?? "",
      r.status,
      r.permit_types?.municipality_id ?? "",
      r.permit_types?.slug ?? "",
      r.created_at,
    ]);
    const csv = [header, ...lines].map((a) => a.map(safe).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function safe(v: any) {
    const t = String(v ?? "");
    if (/[,"\n]/.test(t)) return `"${t.replaceAll('"','""')}"`;
    return t;
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Developer Dashboard</h1>
        <button onClick={exportCSV} className="px-3 py-2 border rounded">Export CSV</button>
      </div>

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-4 mb-4">
        <input
          placeholder="Search email or ID…"
          className="border p-2 rounded"
          value={query}
          onChange={(e) => { setPage(0); setQuery(e.target.value); }}
        />
        <select
          className="border p-2 rounded"
          value={status}
          onChange={(e) => { setPage(0); setStatus(e.target.value); }}
        >
          <option value="ALL">All statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="ROUTED">Routed</option>
          <option value="CLARIFICATION_REQUESTED">Clarification requested</option>
          <option value="DECISION_UPLOADED">Decision uploaded</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          className="border p-2 rounded"
          value={municipalityId}
          onChange={(e) => { setPage(0); setMunicipalityId(e.target.value); }}
        >
          <option value="ALL">All municipalities</option>
          {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="text-sm text-gray-600 flex items-center">
          {appsQuery.isFetching ? "Loading…" : `${total} result(s)`}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>ID</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Municipality</Th>
              <Th>Permit Type</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(r)}>
                <Td mono>{r.id}</Td>
                <Td>{r.user_email ?? "—"}</Td>
                <Td>{r.status}</Td>
                <Td mono>{r.permit_types?.municipality_id ?? "—"}</Td>
                <Td>{r.permit_types?.slug ?? "—"}</Td>
                <Td>{new Date(r.created_at).toLocaleString()}</Td>
              </tr>
            ))}
            {!rows.length && !appsQuery.isFetching && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">No results</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3 mt-3">
        <button
          className="px-3 py-2 border rounded disabled:opacity-50"
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          ← Prev
        </button>
        <div className="text-sm">Page {page + 1} / {totalPages}</div>
        <button
          className="px-3 py-2 border rounded disabled:opacity-50"
          onClick={() => setPage(p => (p + 1 < totalPages ? p + 1 : p))}
          disabled={page + 1 >= totalPages}
        >
          Next →
        </button>
      </div>

      {/* Details drawer/modal */}
      {selected && (
        <DetailsDrawer id={selected.id} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2 border">{children}</th>;
}
function Td({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2 border ${mono ? "font-mono text-xs" : ""}`}>{children}</td>;
}

function DetailsDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["app-detail", id],
    queryFn: async () => {
      const [{ data: app, error: e1 }, { data: docs, error: e2 }, { data: events, error: e3 }] = await Promise.all([
        supabase.from("applications").select("id,status,user_email,created_at,data,permit_types(name,slug,municipality_id)").eq("id", id).maybeSingle(),
        supabase.from("documents").select("filename,mime,size,sha256,s3_key,uploaded_at").eq("application_id", id).order("uploaded_at"),
        supabase.from("audit_log").select("action,meta,created_at,ip").eq("application_id", id).order("created_at"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      return { app, docs, events };
    },
  });

  return (
    <div className="fixed inset-0 bg-black/30 flex">
      <div className="ml-auto h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Application {id}</h2>
          <button onClick={onClose} className="px-3 py-1 border rounded">Close</button>
        </div>
        {!q.data ? (
          <div className="p-6">Loading…</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Summary */}
            <section>
              <h3 className="font-semibold mb-2">Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><strong>Status:</strong> {q.data.app?.status}</div>
                <div><strong>Email:</strong> {q.data.app?.user_email ?? "—"}</div>
                <div><strong>Municipality:</strong> {q.data.app?.permit_types?.municipality_id ?? "—"}</div>
                <div><strong>Permit type:</strong> {q.data.app?.permit_types?.slug ?? "—"}</div>
                <div className="col-span-2"><strong>Created:</strong> {new Date(q.data.app?.created_at).toLocaleString()}</div>
              </div>
              {/* applicant fields */}
              {q.data.app?.data?.applicant && (
                <pre className="mt-3 bg-gray-50 p-3 text-xs rounded overflow-auto">
                  {JSON.stringify(q.data.app.data.applicant, null, 2)}
                </pre>
              )}
              {/* form fields */}
              {q.data.app?.data?.fields && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm underline">Form fields</summary>
                  <pre className="bg-gray-50 p-3 text-xs rounded overflow-auto">
                    {JSON.stringify(q.data.app.data.fields, null, 2)}
                  </pre>
                </details>
              )}
            </section>

            {/* Documents */}
            <section>
              <h3 className="font-semibold mb-2">Documents</h3>
              {q.data.docs?.length ? (
                <ul className="text-sm list-disc pl-5">
                  {q.data.docs.map((d: any, i: number) => (
                    <li key={i}>
                      {d.filename} — {d.mime ?? "file"} {d.size ? `(${(d.size/1024).toFixed(1)} KB)` : ""}
                      {d.sha256 ? <span className="ml-2 text-xs text-gray-600">sha256:{d.sha256.slice(0,12)}…</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-600">No documents</div>
              )}
            </section>

            {/* Timeline */}
            <section>
              <h3 className="font-semibold mb-2">Timeline</h3>
              <ol className="border-l pl-4 text-sm">
                {q.data.events?.map((e: any, i: number) => (
                  <li key={i} className="mb-3">
                    <div><strong>{e.action.toLowerCase()}</strong> — {new Date(e.created_at).toLocaleString()}</div>
                    {e.meta && <div className="text-xs text-gray-600">{JSON.stringify(e.meta)}</div>}
                    {e.ip && <div className="text-xs text-gray-600">ip: {e.ip}</div>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
