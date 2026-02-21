import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { createApplication } from "@/lib/db";

type PermitType = { id: string; name: string; slug: string };
type Muni = { id: string; name: string };

export default function ApplyStepper() {
  const { municipalityId, permitType } = useParams(); // route: /apply/:municipalityId/:permitType
  const navigate = useNavigate();

  const [muni, setMuni] = useState<Muni | null>(null);
  const [ptype, setPtype] = useState<PermitType | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // simple local form state (works without extra libs)
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");          // contact email shown to clerks
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<"ar" | "fr" | "en">("en");
  const [plotNumber, setPlotNumber] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!municipalityId || !permitType) {
          setErr("Missing municipality or permit type in URL.");
          setLoading(false);
          return;
        }

        // fetch municipality (by id or slug fallback)
        let { data: m } = await supabase.from("municipalities").select("id,name").eq("id", municipalityId).maybeSingle();
        if (!m) {
          const { data: m2 } = await supabase.from("municipalities").select("id,name").eq("slug", municipalityId).maybeSingle();
          m = m2 ?? null;
        }
        if (!m) {
          setErr("Municipality not found.");
          setLoading(false);
          return;
        }
        setMuni(m);

        // fetch permit type for this municipality + slug
        const { data: pt, error: ept } = await supabase
          .from("permit_types")
          .select("id,name,slug")
          .eq("municipality_id", m.id)
          .eq("slug", permitType)
          .maybeSingle();
        if (ept) throw ept;
        if (!pt) {
          setErr("Permit type not found for this municipality.");
          setLoading(false);
          return;
        }
        setPtype(pt);
        setLoading(false);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? "Failed to load form.");
        setLoading(false);
      }
    })();
  }, [municipalityId, permitType]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      // must be logged in (satisfies your RLS)
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        setErr("Please log in to submit your application.");
        return;
      }

      if (!muni || !ptype) {
        setErr("Form not ready yet.");
        return;
      }

      // Create the application (id not needed as we redirect to home)
      await createApplication({
        municipalityId: muni.id,
        permitTypeSlug: ptype.slug,
        applicant: { fullName, email, phone, language },
        fields: { plotNumber, description },
        documents: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
      });

      // Navigate to home page with success state
      navigate("/", {
        state: {
          permitSubmitted: true,
          submittedPermitType: ptype.name,
        },
      });
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Submission failed.");
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="mb-4 text-sm">
        <Link className="underline" to={`/apply/${municipalityId}`}>← Back</Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">
        {muni?.name} — {ptype?.name ?? "Permit"}
      </h1>
      <p className="mb-4 text-gray-600">Fill the form and submit your application.</p>

      {err && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Full name</label>
          <input className="border p-2 w-full" value={fullName} onChange={e=>setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Email (for contact)</label>
          <input type="email" className="border p-2 w-full" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Phone</label>
            <input className="border p-2 w-full" value={phone} onChange={e=>setPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Preferred language</label>
            <select className="border p-2 w-full" value={language} onChange={e=>setLanguage(e.target.value as any)}>
              <option value="ar">Arabic</option>
              <option value="fr">French</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        {/* Example construction fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Plot number</label>
            <input className="border p-2 w-full" value={plotNumber} onChange={e=>setPlotNumber(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Description</label>
            <input className="border p-2 w-full" value={description} onChange={e=>setDescription(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Documents</label>
          <input type="file" multiple onChange={e => setFiles(e.target.files ? Array.from(e.target.files) : [])} />
          {!!files.length && (
            <ul className="mt-2 text-sm text-gray-600 list-disc pl-5">
              {files.map((f, i) => <li key={i}>{f.name} — {(f.size/1024).toFixed(1)} KB</li>)}
            </ul>
          )}
        </div>

        <button className="px-4 py-2 rounded bg-blue-600 text-white">Submit application</button>
      </form>
    </main>
  );
}
