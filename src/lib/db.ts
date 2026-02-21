import { supabase } from "./supabase";

export async function createApplication(payload: {
  municipalityId: string;
  permitTypeSlug: string;
  applicant: { fullName: string; email: string; phone?: string; language?: string };
  fields: Record<string, any>;
  documents: Array<{ name: string; size?: number; type?: string; sha256?: string; s3Key?: string }>;
  ip?: string | null;
}) {
  // ✅ use session email, not form email
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userRes.user;
  if (!user?.email) throw new Error("Please log in to submit.");

  // find permit type by (municipality, slug)
  const { data: pt, error: e1 } = await supabase
    .from("permit_types")
    .select("id")
    .eq("municipality_id", payload.municipalityId)
    .eq("slug", payload.permitTypeSlug)
    .maybeSingle();
  if (e1) throw e1;
  if (!pt) throw new Error("Unknown permit type for municipality");

  // ✅ set applications.user_email = session email (RLS will check this)
  const { data: app, error: e2 } = await supabase
    .from("applications")
    .insert({
      permit_type_id: pt.id,
      user_email: user.email, // <-- critical
      data: {
        applicant: payload.applicant, // keep their typed contact email here
        fields: payload.fields,
      },
    })
    .select("id")
    .single();
  if (e2) throw e2;

  // docs (optional)
  if (payload.documents?.length) {
    const docs = payload.documents.map(d => ({
      application_id: app.id,
      filename: d.name,
      s3_key: d.s3Key ?? null,
      mime: d.type ?? null,
      size: d.size ?? null,
      sha256: d.sha256 ?? null,
    }));
    const { error: e3 } = await supabase.from("documents").insert(docs);
    if (e3) throw e3;
  }

  // audit
  await supabase.from("audit_log").insert([
    { application_id: app.id, action: "SUBMITTED", meta: payload.fields, ip: payload.ip ?? null },
    { application_id: app.id, action: "ROUTED", meta: { to: "Municipality Desk" } },
  ]);

  return app.id as string;
}
