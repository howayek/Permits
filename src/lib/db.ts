import { supabase } from "./supabase";

/**
 * Creates an application record with audit log entries.
 * Document rows are handled separately by the caller after file upload.
 * Returns the new application ID.
 */
export async function createApplication(payload: {
  municipalityId: string;
  permitTypeSlug: string;
  applicant: { fullName: string; email: string; phone?: string; language?: string };
  fields: Record<string, any>;
  documents?: Array<{ name: string; size?: number; type?: string; sha256?: string; s3Key?: string }>;
  ip?: string | null;
}): Promise<string> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userRes.user;
  if (!user?.email) throw new Error("Please log in to submit.");

  const { data: pt, error: e1 } = await supabase
    .from("permit_types")
    .select("id")
    .eq("municipality_id", payload.municipalityId)
    .eq("slug", payload.permitTypeSlug)
    .maybeSingle();
  if (e1) throw e1;
  if (!pt) throw new Error("Unknown permit type for municipality");

  const { data: app, error: e2 } = await supabase
    .from("applications")
    .insert({
      permit_type_id: pt.id,
      user_email: user.email,
      data: {
        applicant: payload.applicant,
        fields: payload.fields,
      },
    })
    .select("id")
    .single();
  if (e2) throw e2;

  await supabase.from("audit_log").insert([
    { application_id: app.id, action: "SUBMITTED", meta: payload.fields, ip: payload.ip ?? null },
    { application_id: app.id, action: "ROUTED", meta: { to: "Municipality Desk" } },
  ]);

  return app.id as string;
}
