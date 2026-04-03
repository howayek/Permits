import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Municipality {
  id: string;
  name: string;
  contact: string | null;
}

interface PermitType {
  id: string;
  municipality_id: string;
  name: string;
  slug: string;
  required_docs: string[];
}

export default function GovAdmin() {
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [permitTypes, setPermitTypes] = useState<PermitType[]>([]);
  const [fetching, setFetching] = useState(true);

  const [newMuniName, setNewMuniName] = useState("");
  const [newMuniContact, setNewMuniContact] = useState("");
  const [savingMuni, setSavingMuni] = useState(false);

  const [selectedMuniId, setSelectedMuniId] = useState("");
  const [newPtName, setNewPtName] = useState("");
  const [newPtSlug, setNewPtSlug] = useState("");
  const [newPtDocs, setNewPtDocs] = useState("");
  const [savingPt, setSavingPt] = useState(false);

  async function fetchData() {
    setFetching(true);
    const [{ data: m }, { data: pt }] = await Promise.all([
      supabase.from("municipalities").select("id,name,contact").order("name"),
      supabase.from("permit_types").select("id,municipality_id,name,slug,required_docs").order("name"),
    ]);
    setMunicipalities(m ?? []);
    setPermitTypes(pt ?? []);
    setFetching(false);
  }

  useEffect(() => {
    if (!loading && user) fetchData();
  }, [user, loading]);

  async function createMunicipality(e: React.FormEvent) {
    e.preventDefault();
    if (!newMuniName.trim()) return;
    setSavingMuni(true);
    try {
      const { error } = await supabase.from("municipalities").insert({
        name: newMuniName.trim(),
        contact: newMuniContact.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Municipality created", description: newMuniName.trim() });
      setNewMuniName("");
      setNewMuniContact("");
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingMuni(false);
    }
  }

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function createPermitType(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMuniId || !newPtName.trim()) return;
    setSavingPt(true);
    try {
      const slug = newPtSlug.trim() || generateSlug(newPtName);
      const requiredDocs = newPtDocs
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);

      const { error } = await supabase.from("permit_types").insert({
        municipality_id: selectedMuniId,
        name: newPtName.trim(),
        slug,
        required_docs: requiredDocs,
        form_schema: {},
      });
      if (error) throw error;
      toast({ title: "Permit type created", description: `${newPtName.trim()} (${slug})` });
      setNewPtName("");
      setNewPtSlug("");
      setNewPtDocs("");
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingPt(false);
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;
  if (!user) return <main className="p-6">Please sign in.</main>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Create municipalities and configure permit types.
        </p>
      </div>

      {/* ── Create Municipality ──────────────────────────────── */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Create Municipality</h2>
        <form onSubmit={createMunicipality} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                className="border rounded-md p-2 w-full"
                value={newMuniName}
                onChange={(e) => setNewMuniName(e.target.value)}
                placeholder="e.g. Beirut Municipality"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact (optional)</label>
              <input
                className="border rounded-md p-2 w-full"
                value={newMuniContact}
                onChange={(e) => setNewMuniContact(e.target.value)}
                placeholder="e.g. info@beirut.gov.lb"
              />
            </div>
          </div>
          <Button type="submit" disabled={savingMuni}>
            {savingMuni ? "Creating…" : "Create Municipality"}
          </Button>
        </form>

        {!fetching && municipalities.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Existing Municipalities ({municipalities.length})
            </h3>
            <div className="grid gap-2">
              {municipalities.map((m) => (
                <div key={m.id} className="border rounded p-3 text-sm flex justify-between items-center">
                  <div>
                    <span className="font-medium">{m.name}</span>
                    {m.contact && <span className="text-muted-foreground ml-2">({m.contact})</span>}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{m.id.slice(0, 8)}…</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Create Permit Type ──────────────────────────────── */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Create Permit Type</h2>
        <form onSubmit={createPermitType} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Municipality</label>
            <select
              className="border rounded-md p-2 w-full"
              value={selectedMuniId}
              onChange={(e) => setSelectedMuniId(e.target.value)}
              required
            >
              <option value="">Select a municipality…</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Permit Type Name</label>
              <input
                className="border rounded-md p-2 w-full"
                value={newPtName}
                onChange={(e) => setNewPtName(e.target.value)}
                placeholder="e.g. Building Permit"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug (auto-generated if empty)</label>
              <input
                className="border rounded-md p-2 w-full"
                value={newPtSlug}
                onChange={(e) => setNewPtSlug(e.target.value)}
                placeholder="e.g. building-permit"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Required Documents{" "}
              <span className="text-muted-foreground font-normal">(comma-separated)</span>
            </label>
            <input
              className="border rounded-md p-2 w-full"
              value={newPtDocs}
              onChange={(e) => setNewPtDocs(e.target.value)}
              placeholder="e.g. ID Card, Property Deed, Site Plan"
            />
          </div>
          <Button type="submit" disabled={savingPt || !selectedMuniId}>
            {savingPt ? "Creating…" : "Create Permit Type"}
          </Button>
        </form>

        {!fetching && permitTypes.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Existing Permit Types ({permitTypes.length})
            </h3>
            <div className="grid gap-2">
              {permitTypes.map((pt) => {
                const muni = municipalities.find((m) => m.id === pt.municipality_id);
                const docs = Array.isArray(pt.required_docs) ? pt.required_docs : [];
                return (
                  <div key={pt.id} className="border rounded p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">{pt.name}</span>
                        <span className="text-muted-foreground ml-2">
                          ({muni?.name ?? "Unknown"})
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">/{pt.slug}</span>
                    </div>
                    {docs.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Required: {docs.join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
