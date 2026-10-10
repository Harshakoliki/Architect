-- Backend-only access. Browser keys cannot read repository source or scan metadata.
create table public.architect_scans (
  id uuid primary key,
  workspace_id text not null check (workspace_id ~ '^[a-f0-9]{64}$'),
  name text not null,
  summary jsonb not null,
  files jsonb not null,
  source_key text not null unique,
  created_at timestamptz not null default now()
);
create index architect_scans_workspace_created on public.architect_scans (workspace_id, created_at desc);
alter table public.architect_scans enable row level security;
revoke all on public.architect_scans from anon, authenticated;
grant select, insert, delete on public.architect_scans to service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('architect-source', 'architect-source', false, 20971520, array['application/gzip'])
on conflict (id) do nothing;
-- No storage policies are added: only the server's secret/service_role key may access it.
