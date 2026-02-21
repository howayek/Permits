import { createClient } from "@supabase/supabase-js";

// NOTE: Vite will inject env vars as strings; if they are present-but-empty (e.g. `VITE_SUPABASE_URL=`),
// they become "" which would still crash Supabase client validation. Normalize empties to `undefined`.
const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim() || undefined;
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim() || undefined;
const functionsUrl = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ?? "").trim() || undefined; // optional override for local dev

/**
 * In a public repo, it's common to run the UI before configuring Supabase.
 * We avoid throwing at import-time (which causes a blank screen) and instead
 * use safe placeholders + expose a flag you can use to show a setup hint in the UI.
 */
export const SUPABASE_CONFIGURED = Boolean(url && anon);

if (!SUPABASE_CONFIGURED) {
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Copy env.example -> .env.local, fill it in, then restart `npm run dev`."
  );
}

// Placeholders let the app render even before env vars are configured.
export const supabase = createClient(url ?? "http://localhost:54321", anon ?? "public-anon-key", {
  functions: functionsUrl ? { url: functionsUrl } : undefined,
});
