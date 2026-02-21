import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Muni = { id: string; name: string };
type PType = { id: string; name: string; slug: string };

export default function ApplyPermitTypes() {
  const { municipalityId } = useParams(); // route: /apply/:municipalityId
  const [muni, setMuni] = useState<Muni | null>(null);
  const [types, setTypes] = useState<PType[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMessage(null);

      if (!municipalityId) {
        setMessage("No municipality provided.");
        setLoading(false);
        return;
      }

      // 1) Try to fetch municipality by ID
      let muniById: Muni | null = null;
      const { data: muniByIdData, error: e1 } = await supabase
        .from("municipalities")
        .select("id,name")
        .eq("id", municipalityId)
        .maybeSingle();
      muniById = muniByIdData ?? null;

      // 2) If not found by id, try treat it as a slug (handy if you later switch URLs)
      if (!muniById) {
        const { data: muniBySlug, error: e2 } = await supabase
          .from("municipalities")
          .select("id,name")
          .eq("slug", municipalityId)
          .maybeSingle();
        if (e2) console.error(e2);
        muniById = muniBySlug ?? null;
      }
      if (e1) console.error(e1);

      if (!muniById) {
        setMessage("Municipality not found.");
        setLoading(false);
        return;
      }

      setMuni(muniById);

      // 3) Load permit types for this municipality
      const { data: t, error: e3 } = await supabase
        .from("permit_types")
        .select("id,name,slug")
        .eq("municipality_id", muniById.id)
        .order("name");

      if (e3) {
        console.error(e3);
        setMessage("Could not load permit types.");
      } else {
        setTypes(t ?? []);
        if (!t?.length) setMessage("No permit types configured for this municipality yet.");
      }

      setLoading(false);
    })();
  }, [municipalityId]);

  if (loading) return <main className="p-6">Loading…</main>;

  if (message && !muni) {
    return <main className="p-6">{message}</main>;
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        {muni?.name}: Permit Types
      </h1>

      {message && <p className="text-gray-600 mb-4">{message}</p>}

      <ul className="grid gap-3">
        {types.map((pt) => (
          <li key={pt.id} className="border rounded p-3">
            <div className="font-semibold">{pt.name}</div>
            <Link
              className="text-blue-600 underline"
              to={`/apply/${muni!.id}/${pt.slug}`}
            >
              Start application →
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <Link className="text-sm underline" to="/apply">← Back to municipalities</Link>
      </div>
    </main>
  );
}
