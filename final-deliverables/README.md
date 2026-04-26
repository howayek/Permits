# GovStack — Final Deliverables

**CS 4365/6365: Introduction to Enterprise Computing — Spring 2026**
**Georgia Institute of Technology**

**Author:** Mark Howayek
**Project:** GovStack (Lebanon Digital Permits)
**Repository:** https://github.com/howayek/Permits

---

## What is GovStack?

A workflow-configurable digital permit platform that addresses the slow, paper-heavy, low-trust process of obtaining permits in many municipalities. Citizens submit applications online with documents; government staff review them through a dedicated reviewer portal; permits are issued as tamper-evident PDFs with QR codes that resolve to a public verification endpoint. An LLM-based assistance layer provides document classification at upload time and reviewer summaries at review time.

Built with React, TypeScript, Vite, Tailwind, shadcn/ui, Supabase (Postgres + Auth + Storage + Edge Functions), and OpenAI's GPT-4o-mini.

---

## Final Deliverables

This directory contains all materials submitted for credit on the final project. Below is an index of each deliverable.

### 1. Code

The complete source code is in the parent repository: **https://github.com/howayek/Permits**

The repository contains:
- `src/` — React + TypeScript frontend
- `supabase/functions/` — Two Deno Edge Functions (`generate-permit`, `ai-assist`)
- `supabase/migrations/` — SQL migration files
- `docs/checkpoint1/` through `docs/checkpoint5/` — Five progress reports
- `INSTRUCTIONS.md` — AI workflow / build / run / test guide
- `README.md` — Local setup instructions
- `final-deliverables/` — This directory

To run the system locally:
```bash
git clone https://github.com/howayek/Permits.git
cd Permits
npm install
cp env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
npm run dev
```

The dev server runs on **http://localhost:8080**.

### 2. Final Report

📄 **[`Final_Report.md`](./Final_Report.md)** — Comprehensive ~30-page final report covering:
1. Introduction
2. Motivation
3. Related Work
4. System Architecture
5. Data Model
6. Security Architecture and Threat Model
7. Implementation Methodology (with engineering challenges resolved)
8. AI Integration: LLM-Assisted Document Verification and Reviewer Summaries
9. Evaluation and Results
10. Conclusion
11. Future Work
12. Deliverables
13. **Skill Learning Report** (7 meta-skills)
14. References

### 3. Presentation Materials

🎤 **[`Presentation_Slides.md`](./Presentation_Slides.md)** — 16 slides with speaker notes, organized for a 12-15 minute presentation video.

The slides are written in Markdown format. To render:
- **Option A:** Paste sections into Google Slides, Keynote, or PowerPoint manually.
- **Option B:** Render directly with [Marp](https://marp.app/): `npx @marp-team/marp-cli@latest Presentation_Slides.md`
- **Option C:** Use any reveal.js Markdown renderer.

The slides cover: title, problem, deliverables, architecture, data model, security (RLS + integrity), permit issuance, AI integration (3 slides), engineering challenges, live demo cue, test plan, skill learning, and conclusion.

### 4. Presentation Video

🎬 **YouTube link:** *(to be added by presenter — recommended: unlisted YouTube upload)*

The video should be ~12-15 minutes following the slide deck above. See `Demo_Instructions.md` for the demo script that runs ~5-6 minutes within the video.

**Recording recommendations** (in `Demo_Instructions.md` Section 4):
- 1920×1080 resolution minimum.
- Voice-over recorded separately for cleaner audio.
- Pause briefly on AI verification banners so viewers can read them.
- Use the slide deck for non-demo segments.

### 5. Supporting Material

📄 **[`Demo_Instructions.md`](./Demo_Instructions.md)** — Step-by-step walkthrough for running a live demo. Covers:
- Prerequisites (local environment, Supabase project setup, test accounts, demo files).
- 10-step demo script following a complete user journey from sign-up through QR verification.
- Common demo issues and fixes.
- Recording setup recommendations.

📄 **[`User_Guide.md`](./User_Guide.md)** — End-user documentation for:
- **Citizens** — sign up, apply, track status, respond to clarification requests, download permits.
- **Government Staff** — review queue, decisions, request info, permit issuance, admin configuration.
- **Public** — QR verification page (no login).
- Includes a troubleshooting matrix.

📄 **[`Design_Document.md`](./Design_Document.md)** — Technical reference covering:
- Architecture overview with diagram.
- Frontend file structure and key patterns (AuthProvider, ProtectedRoute).
- Backend schema (10 tables, 3 enums, 3 SECURITY DEFINER functions).
- Complete RLS policy reference for every table.
- Edge Function specifications (inputs, outputs, behaviors, secrets).
- Storage layout.
- Critical implementation patterns (upload flow, decision flow, info request flow, integrity verification).
- Known issues and configuration reference.

📄 **[`Test_Plan.md`](./Test_Plan.md)** — Functional + Security + Performance test plan with results:
- 31 functional tests, all passing.
- 21 security tests, all passing (1 documented trade-off on permit ID enumerability).
- Informal performance observations.
- Cross-browser compatibility matrix.
- Tests not executed (load testing, pen testing, accessibility) listed as future work.

📄 **[`../docs/checkpoint5/architecture_v2.md`](../docs/checkpoint5/architecture_v2.md)** — Updated architecture diagram (v2) showing the AI integration. Final version of the diagram referenced throughout the report.

📄 **[`../docs/checkpoint1/`](../docs/checkpoint1/)** through **[`../docs/checkpoint5/`](../docs/checkpoint5/)** — Five progress reports tracking the project from W5 through W15.

---

## Highlights of What's Demonstrated

- **Workflow-configurable platform** — government users can create new municipalities and permit types with required-document lists via a dedicated `/gov/admin` page; new permit types are immediately available to citizens with no code change.
- **End-to-end secure workflow** — citizens submit, reviewers approve/decline/request-info, permits issued as tamper-evident PDFs with QR codes; every step audited.
- **Defense in depth** — UI route guards backed by Postgres Row-Level Security on all 10 tables, with a single `has_role()` SECURITY DEFINER function as the source of truth for role checks.
- **Document integrity** — SHA-256 computed client-side on upload, verified on every download. Mismatches block the operation.
- **Tamper-evident permits** — issued PDFs carry hashes and QR codes resolving to a privacy-preserving public verification page (no login, minimal data exposure).
- **LLM-assisted intake** — when a citizen labels a file as a particular document type (e.g., "ID Card"), GPT-4o-mini vision verifies the file actually looks like that type, BEFORE submission. Submit is gated until verification passes or the citizen explicitly overrides.
- **LLM-assisted review** — when a reviewer opens an application, an "AI Review Summary" panel produces a 3-5 bullet structured summary covering completeness, document validity, concerns, and a recommended next action — without making the final decision.
- **Cost-conscious AI** — both AI features run through a single Edge Function (`ai-assist`) with the `OPENAI_API_KEY` stored as a Supabase secret. Cached classifications avoid re-running OpenAI on every modal open. Per-application cost ≈ $0.005.

---

## Quick Reference

| Question | Answer |
|----------|--------|
| What's the simplest way to see the system working? | Visit https://localhost:8080 (after `npm run dev`), sign up as Citizen, submit an application. |
| Where is the source code? | https://github.com/howayek/Permits |
| Where is the architecture diagram? | `../docs/checkpoint5/architecture_v2.md` (also embedded in `Final_Report.md` and `Design_Document.md`) |
| How is authorization enforced? | Postgres Row-Level Security on every table, using a `has_role()` SECURITY DEFINER helper function. UI guards layered on top. |
| How is the AI key secured? | Stored only as a Supabase Edge Function secret. The browser never sees it. |
| What model does the AI use? | `gpt-4o-mini` (vision + chat completions). |
| What happens when a download is tampered? | SHA-256 mismatch detected client-side; download blocked with warning. |
| Where do I run the live demo from? | Follow `Demo_Instructions.md` step by step. |
| Where is the test plan? | `Test_Plan.md`. |
| What did I learn? | See Section 13 of `Final_Report.md` — seven meta-skills covering trend recognition, defense in depth, scope management, fact vs. fiction, cyber-physical bridging, reading reference docs, and visual communication. |

---

## File Tree of `final-deliverables/`

```
final-deliverables/
├── README.md             ← You are here. Index + quick reference.
├── Final_Report.md       ← Comprehensive final report.
├── Presentation_Slides.md ← 16-slide deck for the video.
├── Demo_Instructions.md  ← Live demo walkthrough.
├── User_Guide.md         ← End-user documentation.
├── Design_Document.md    ← Technical architecture reference.
└── Test_Plan.md          ← Test plan and results.
```

---

## Acknowledgments

Thank you to Prof. Calton Pu and the CS 6365 instructional team for the course structure, the mid-semester feedback that prompted the AI integration scope, and the rigor of the five-checkpoint cadence that produced honest, fact-checked progress documentation throughout the semester.
