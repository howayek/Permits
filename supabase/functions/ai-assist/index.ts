// AI Assist Edge Function
// ─────────────────────────────────────────────────────────────────────────────
// Two actions:
//   1. classify_document — classifies an uploaded file against an expected doc
//      type (e.g. "ID Card", "Property Deed"). Uses GPT-4o-mini vision for images
//      and PDFs. Returns { match, actual_type, confidence, notes }.
//   2. review_summary — generates a short summary for government reviewers based
//      on the application's form data + AI document classifications.
//
// Required secret: OPENAI_API_KEY  (set in Supabase Dashboard → Edge Functions → Secrets)
//
// Deploy: supabase functions deploy ai-assist
// Invoke: supabase.functions.invoke('ai-assist', { body: { action: '...', ... } })

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL_TEXT = "gpt-4o-mini";
const MODEL_VISION = "gpt-4o-mini";

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors() });
}

interface ClassifyDocumentRequest {
  action: "classify_document";
  file_data_url: string;     // data: URL with base64 (image/* or application/pdf)
  expected_doc: string;      // e.g. "ID Card", "Property Deed"
  filename?: string;
}

interface ReviewSummaryRequest {
  action: "review_summary";
  application: {
    permit_type_name?: string;
    municipality_name?: string;
    user_email?: string;
    status?: string;
    form_fields?: Record<string, unknown>;
    documents?: Array<{
      filename: string;
      mime?: string | null;
      size?: number | null;
      ai_classification?: {
        match?: boolean;
        actual_type?: string;
        confidence?: number;
        notes?: string;
        expected_doc?: string;
      } | null;
    }>;
    required_docs?: string[];
  };
}

type RequestBody = ClassifyDocumentRequest | ReviewSummaryRequest;

async function classifyDocument(req: ClassifyDocumentRequest, apiKey: string) {
  const isImage = req.file_data_url.startsWith("data:image/");
  const isPdf = req.file_data_url.startsWith("data:application/pdf");

  const systemPrompt =
    "You are a strict document classifier for a government permit system. " +
    "Given an uploaded file and what it was *expected* to be, decide if it matches. " +
    'Reply ONLY with valid JSON: ' +
    '{"match": boolean, "actual_type": "<short label>", "confidence": <0..1>, "notes": "<one short sentence>"}.';

  const userText =
    `Expected document type: "${req.expected_doc}".\n` +
    (req.filename ? `Filename: "${req.filename}".\n` : "") +
    `Decide if the attached file appears to match the expected type. ` +
    `Return strict JSON only.`;

  // Build content. Images can be inlined directly; PDFs cannot via chat completions vision,
  // so for PDFs we fall back to filename+expected_doc heuristic via text-only model.
  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };
  let messages: Array<{ role: string; content: ContentPart[] | string }>;

  if (isImage) {
    messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: req.file_data_url } },
        ],
      },
    ];
  } else if (isPdf) {
    // For PDFs we can't pass them directly; rely on filename heuristic.
    messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          userText +
          ` Note: the file is a PDF, you cannot inspect its visual contents. ` +
          `Base your judgment on the filename and the expected type. If the filename ` +
          `clearly suggests the expected document, mark as a probable match with moderate confidence; ` +
          `otherwise return match=false with low confidence.`,
      },
    ];
  } else {
    return {
      match: false,
      actual_type: "unsupported",
      confidence: 0,
      notes: "File type not supported for classification.",
    };
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: isImage ? MODEL_VISION : MODEL_TEXT,
      messages,
      max_tokens: 200,
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errText}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(content);
    return {
      match: Boolean(parsed.match),
      actual_type: String(parsed.actual_type ?? "unknown"),
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      notes: String(parsed.notes ?? ""),
    };
  } catch {
    return { match: false, actual_type: "unknown", confidence: 0, notes: "Failed to parse AI response" };
  }
}

async function reviewSummary(req: ReviewSummaryRequest, apiKey: string) {
  const app = req.application;

  const docSummary = (app.documents ?? []).map((d) => {
    const c = d.ai_classification;
    const status = c
      ? c.match
        ? `✓ matches "${c.expected_doc}" (confidence: ${(c.confidence * 100).toFixed(0)}%)`
        : `✗ does NOT match "${c.expected_doc}" (claims to be: ${c.actual_type})`
      : "(no AI classification)";
    return `- ${d.filename}: ${status}`;
  }).join("\n");

  const requiredDocs = app.required_docs ?? [];
  const missingDocs = requiredDocs.filter((rd) => {
    const cls = (app.documents ?? []).find((d) => d.ai_classification?.expected_doc === rd && d.ai_classification?.match);
    return !cls;
  });

  const formFields = app.form_fields
    ? Object.entries(app.form_fields).map(([k, v]) => `- ${k}: ${String(v ?? "")}`).join("\n")
    : "(none)";

  const systemPrompt =
    "You are an assistant for a government permit reviewer. " +
    "Generate a SHORT summary (3-5 bullet points) covering: completeness, document validity, " +
    "any concerns or missing items, and a recommended next action. " +
    "Be concise and factual. Do NOT make a final decision — that's the reviewer's job.";

  const userPrompt =
    `Application overview:\n` +
    `- Permit type: ${app.permit_type_name ?? "(unknown)"}\n` +
    `- Municipality: ${app.municipality_name ?? "(unknown)"}\n` +
    `- Status: ${app.status ?? "(unknown)"}\n` +
    `- Applicant email: ${app.user_email ?? "(unknown)"}\n\n` +
    `Form fields:\n${formFields}\n\n` +
    `Required documents: ${requiredDocs.length ? requiredDocs.join(", ") : "(none specified)"}\n` +
    `Documents uploaded:\n${docSummary || "(none)"}\n\n` +
    (missingDocs.length ? `Apparently missing: ${missingDocs.join(", ")}\n\n` : "") +
    `Generate the reviewer summary now.`;

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_TEXT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 400,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errText}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content ?? "";
  return { summary: content.trim() };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors() });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "OPENAI_API_KEY not configured" }, 500);
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (body.action === "classify_document") {
      if (!body.file_data_url || !body.expected_doc) {
        return jsonResponse({ error: "file_data_url and expected_doc are required" }, 400);
      }
      const result = await classifyDocument(body, apiKey);
      return jsonResponse({ ok: true, ...result });
    }

    if (body.action === "review_summary") {
      if (!body.application) {
        return jsonResponse({ error: "application is required" }, 400);
      }
      const result = await reviewSummary(body, apiKey);
      return jsonResponse({ ok: true, ...result });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("ai-assist error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
