import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function ApplyIndex() {
  const [munis, setMunis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("id,name")
        .order("name", { ascending: true });
      if (error) console.error(error);
      setMunis(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="min-h-screen bg-background">
      {/* Section Header */}
      <section className="bg-gradient-hero text-primary-foreground py-10 shadow-md">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Choose Municipality</h1>
          <p className="mt-2 text-primary-foreground/90">
            Select your municipality to view available permit types and apply online.
          </p>
        </div>
      </section>

      {/* List of Municipalities */}
      <section className="max-w-4xl mx-auto px-4 py-10">
        <ul className="grid gap-4 md:grid-cols-2">
          {munis.map((m) => (
            <li key={m.id} className="bg-card text-card-foreground rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-border">
              <div className="font-semibold text-lg">{m.name}</div>
              <Link
                className="inline-flex mt-3 items-center gap-2 text-accent-foreground bg-accent hover:bg-accent/90 px-3 py-2 rounded-md shadow-sm"
                to={`/apply/${m.id}`}
              >
                View permit types →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Footer Accent */}
      <footer className="bg-lebanon-cedar text-white py-6">
        <div className="max-w-4xl mx-auto px-4 text-sm">
          Subtle local identity: modern public service with Lebanese roots.
        </div>
      </footer>
    </main>
  );
}