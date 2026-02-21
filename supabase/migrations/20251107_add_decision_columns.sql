-- Adds decision outcome data to decisions table.
-- Safe to run multiple times.
-- Adjust NOT NULL drops if columns already nullable.

alter table public.decisions
  add column if not exists decision text,
  add column if not exists note jsonb default '{}'::jsonb;

-- Allow placeholder rows before a document is uploaded.
alter table public.decisions
  alter column s3_key drop not null,
  alter column sha256 drop not null;

create index if not exists decisions_decision_idx on public.decisions(decision);