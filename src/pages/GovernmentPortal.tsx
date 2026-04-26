import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle2, XCircle, Search, Filter, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePermitForApplication } from "@/lib/PermitGenerationService";
import { useAuth } from "@/lib/auth";
import { formatFieldLabel } from "@/lib/utils";
import { RequestInfoModalWrapper } from "@/components/RequestInfoModalWrapper";
import { APPLICATION_STATUSES } from "@/lib/constants";

const GovernmentPortal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [requestInfoAppId, setRequestInfoAppId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [permitFilter, setPermitFilter] = useState("");
  const [pendingOldestFirst, setPendingOldestFirst] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchApplications();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(false);
  };

  const fetchApplications = async () => {
    const { data, error } = await supabase
      .from("applications")
      .select("*, profiles(full_name, email), permit_types(name,municipality_id)")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching applications:", error);
      return;
    }

    if (data) setApplications(data);
  };

  const handleStatusUpdate = async (appId: string, newStatus: "approved" | "rejected" | "pending") => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ status: newStatus })
        .eq("id", appId);
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      const issuedBy = user?.email ?? "unknown";
      const issuedAt = new Date().toISOString();
      const decision =
        newStatus === "approved" ? "APPROVED" :
        newStatus === "rejected" ? "DECLINED" :
        "REQUEST_INFO";

      const { data: existing } = await supabase
        .from("decisions")
        .select("id,s3_key,decision")
        .eq("application_id", appId)
        .order("issued_at", { ascending: false })
        .limit(1);

      if (existing && existing.length) {
        await supabase.from("decisions").update({ decision }).eq("id", existing[0].id);
      } else {
        await supabase.from("decisions").insert({
          application_id: appId,
          issued_by: issuedBy,
          issued_at: issuedAt,
          decision,
          note: {}
        } as any);
      }

      await supabase.from("audit_log").insert({
        application_id: appId,
        action: "DECISION",
        meta: { decision, by: issuedBy }
      });

      // Generate QR-coded permit if approved
      if (newStatus === "approved") {
        try {
          const { data: already } = await supabase
            .from("permits")
            .select("id")
            .eq("application_id", appId)
            .limit(1);
          if (!already?.length) {
            await generatePermitForApplication(appId);
          }
        } catch (e: any) {
          console.error("Permit generation failed:", e);
        }
      }

      toast({
        title: "Success",
        description: `Application status updated to ${newStatus}`,
      });

      fetchApplications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-pending text-pending-foreground">Pending</Badge>;
      case "approved":
        return <Badge className="bg-success text-success-foreground">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-destructive text-destructive-foreground">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4" />;
      case "approved": return <CheckCircle2 className="h-4 w-4" />;
      case "rejected": return <XCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === "pending").length,
    approved: applications.filter(a => a.status === "approved").length,
  };

  const uniquePermits = useMemo(() => {
    const set = new Set<string>();
    applications.forEach(a => {
      const name = a.permit_types?.name ?? a.permit_type;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [applications]);

  const pendingFiltered = useMemo(() => {
    let r = applications.filter((a) => a.status === "pending");
    if (permitFilter) r = r.filter((a) => (a.permit_types?.name ?? a.permit_type) === permitFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((a) =>
        a.id.toLowerCase().includes(q) ||
        (a.applicant_name ?? "").toLowerCase().includes(q) ||
        (a.profiles?.email ?? "").toLowerCase().includes(q)
      );
    }
    r = [...r].sort((a, b) => {
      const av = new Date(a.submitted_at ?? a.created_at ?? 0).getTime();
      const bv = new Date(b.submitted_at ?? b.created_at ?? 0).getTime();
      return pendingOldestFirst ? av - bv : bv - av;
    });
    return r;
  }, [applications, permitFilter, search, pendingOldestFirst]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <nav className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Government Portal</h1>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-pending">{stats.pending}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-success">{stats.approved}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Applications Management</CardTitle>
                <CardDescription>Review and process permit applications</CardDescription>
              </div>
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-8 w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={permitFilter}
                    onChange={(e) => setPermitFilter(e.target.value)}
                  >
                    <option value="">All permits</option>
                    {uniquePermits.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={pendingOldestFirst}
                      onChange={(e) => setPendingOldestFirst(e.target.checked)}
                    />
                    Oldest pending first
                  </label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending">
              <TabsList>
                <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({stats.approved})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                {applications.map(app => (
                  <AppCard key={app.id} app={app} updateStatus={handleStatusUpdate} badge={getStatusBadge(app.status)} icon={getStatusIcon(app.status)} onViewDetails={() => setSelectedAppId(app.id)} onRequestInfo={() => setRequestInfoAppId(app.id)} />
                ))}
              </TabsContent>

              <TabsContent value="pending" className="space-y-4">
                {pendingFiltered.map(app => (
                  <AppCard key={app.id} app={app} updateStatus={handleStatusUpdate} badge={getStatusBadge(app.status)} icon={getStatusIcon(app.status)} onViewDetails={() => setSelectedAppId(app.id)} onRequestInfo={() => setRequestInfoAppId(app.id)} />
                ))}
              </TabsContent>

              <TabsContent value="approved" className="space-y-4">
                {applications.filter(a => a.status === "approved").map(app => (
                  <AppCard key={app.id} app={app} updateStatus={handleStatusUpdate} badge={getStatusBadge(app.status)} icon={getStatusIcon(app.status)} onViewDetails={() => setSelectedAppId(app.id)} onRequestInfo={() => setRequestInfoAppId(app.id)} />
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
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
    </div>
  );
};

function AppCard({ app, updateStatus, badge, icon, onViewDetails, onRequestInfo }: any) {
  const permitLabel = app.permit_types?.name ?? app.permit_type ?? "—";
  const municipality = app.permit_types?.municipality_id ?? "—";
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={onViewDetails}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="font-mono text-xs text-muted-foreground">{app.id.slice(0, 8)}</span>
            {badge}
          </div>
          <h3 className="font-semibold text-lg">{permitLabel}</h3>
          <p className="text-sm text-muted-foreground">Municipality: {municipality}</p>
          <p className="text-sm text-muted-foreground">Applicant: {app.applicant_name}</p>
          {app.profiles?.email && (
            <p className="text-sm text-muted-foreground">Email: {app.profiles.email}</p>
          )}
          <p className="text-sm text-muted-foreground">Submitted: {new Date(app.submitted_at ?? app.created_at ?? Date.now()).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2">
          {app.status === "pending" && (
            <>
              <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus(app.id, "approved"); }}>Approve</Button>
              <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); updateStatus(app.id, "rejected"); }}>Reject</Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onRequestInfo(); }}>Request Info</Button>
            </>
          )}
        </div>
      </div>
    </div>
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
                  .select("*, permit_types(name,slug,municipality_id)")
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

export default GovernmentPortal;