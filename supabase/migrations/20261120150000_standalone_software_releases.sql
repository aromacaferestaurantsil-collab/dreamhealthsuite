-- Standalone release catalogue. This migration is intentionally NOT applied to production.
create table if not exists public.software_releases (
  id uuid primary key default gen_random_uuid(),
  product_key text not null check (product_key in ('PharmaSuite','LabSuite','DoctorSuite','PatientSuite','CareConnect','HealthAnalytics','HealthSuite 360')),
  platform text not null check (platform in ('Android','iOS','Windows','macOS','Web')),
  version text not null,
  build_number bigint,
  package_type text not null,
  package_url text,
  store_url text,
  release_notes text,
  minimum_os text,
  release_status text not null default 'draft' check (release_status in ('draft','published','deprecated')),
  published_at timestamptz,
  checksum_sha256 text,
  file_size_bytes bigint,
  is_mandatory boolean not null default false,
  is_latest boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_key,platform,version)
);
create index if not exists software_releases_public_idx on public.software_releases(product_key,platform,published_at desc) where release_status='published';
alter table public.software_releases enable row level security;
drop policy if exists "Published releases are publicly readable" on public.software_releases;
create policy "Published releases are publicly readable" on public.software_releases for select to anon, authenticated using (release_status='published');
-- No browser-side write policy is intentionally created. Release publishing requires a
-- separately authenticated platform-admin service after a platform-admin authority model exists.
