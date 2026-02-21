# Lebanon Digital Permits

End-to-end permit application UI built with React + TypeScript (Vite), styled with Tailwind + shadcn/ui, and backed by Supabase (Auth, Postgres, Storage, optional Edge Functions).

## Run locally

### Prereqs
- Node.js 18+ and npm

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment variables
Copy `env.example` → `.env.local` and fill it in:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# Optional (only if you want to run Edge Functions locally):
# VITE_SUPABASE_FUNCTIONS_URL=http://localhost:54321/functions/v1
```

Get the URL + anon key from Supabase Dashboard → **Project Settings → API**.

Note: don’t leave these blank (e.g. `VITE_SUPABASE_URL=`). They must be real values.

### 3) Start the dev server
```bash
npm run dev
```

Open the URL Vite prints (by default this repo uses `http://localhost:8080`).

## Key routes
- `/`: Landing page
- `/auth/login`: Sign in / sign up
- `/apply`: Start an application
- `/my-permits`: View your applications and issued permits
- `/gov/login`, `/gov`, `/gov/database`: Government views
- `/permits/:permitId`: Public permit verification page

## Supabase notes (high level)
This app expects a Supabase project with tables for applications, permit configuration, documents, decisions, audit logging, and permits. You’ll also need a Storage bucket named `documents` for uploads.

If you want the PDF generation Edge Function (`supabase/functions/generate-permit`), install the Supabase CLI and follow the function README to set secrets + deploy.
