import { supabase } from "./supabase";

export interface DocumentClassification {
  match: boolean;
  actual_type: string;
  confidence: number;
  notes: string;
  expected_doc: string;
}

export interface ReviewSummary {
  summary: string;
}

/**
 * Reads a File and returns a data URL (base64-encoded).
 * Used to send files to the AI Edge Function for classification.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Asks the AI Edge Function to classify a file against an expected document type.
 * Returns null if the function fails (caller treats it as "unavailable").
 */
export async function classifyDocument(
  file: File,
  expectedDoc: string
): Promise<DocumentClassification | null> {
  try {
    const dataUrl = await fileToDataUrl(file);
    const { data, error } = await supabase.functions.invoke("ai-assist", {
      body: {
        action: "classify_document",
        file_data_url: dataUrl,
        expected_doc: expectedDoc,
        filename: file.name,
      },
    });

    if (error) {
      console.warn("[ai-assist] classify_document error:", error);
      return null;
    }
    if (!data?.ok) {
      console.warn("[ai-assist] classify_document non-ok response:", data);
      return null;
    }

    return {
      match: Boolean(data.match),
      actual_type: String(data.actual_type ?? "unknown"),
      confidence: typeof data.confidence === "number" ? data.confidence : 0,
      notes: String(data.notes ?? ""),
      expected_doc: expectedDoc,
    };
  } catch (e) {
    console.warn("[ai-assist] classify_document threw:", e);
    return null;
  }
}

/**
 * Asks the AI Edge Function to generate a reviewer summary for an application.
 */
export async function generateReviewSummary(applicationContext: {
  permit_type_name?: string;
  municipality_name?: string;
  user_email?: string;
  status?: string;
  form_fields?: Record<string, unknown>;
  documents?: Array<{
    filename: string;
    mime?: string | null;
    size?: number | null;
    ai_classification?: DocumentClassification | null;
  }>;
  required_docs?: string[];
}): Promise<ReviewSummary | null> {
  try {
    const { data, error } = await supabase.functions.invoke("ai-assist", {
      body: {
        action: "review_summary",
        application: applicationContext,
      },
    });

    if (error) {
      console.warn("[ai-assist] review_summary error:", error);
      return null;
    }
    if (!data?.ok) {
      console.warn("[ai-assist] review_summary non-ok response:", data);
      return null;
    }

    return { summary: String(data.summary ?? "") };
  } catch (e) {
    console.warn("[ai-assist] review_summary threw:", e);
    return null;
  }
}
