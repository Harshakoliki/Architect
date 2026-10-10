alter table public.architect_scans add column graph jsonb not null default '{}'::jsonb;
