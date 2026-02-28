-- PaySlip Buddy V1 core schema (UK/IE Payslip OS)
-- Date: 2026-02-27

create extension if not exists "pgcrypto";

-- Enums
create type region_t as enum ('UK', 'IE');
create type currency_t as enum ('GBP', 'EUR');
create type plan_t as enum ('FREE', 'PLUS', 'PRO');
create type billing_cycle_t as enum ('MONTHLY', 'ANNUAL');
create type subscription_status_t as enum ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');
create type household_role_t as enum ('OWNER', 'MEMBER');
create type household_member_status_t as enum ('INVITED', 'ACTIVE', 'REMOVED');
create type payslip_status_t as enum ('UPLOADED', 'EXTRACTED', 'CONFIRMED', 'FAILED');
create type line_item_type_t as enum ('EARNING', 'DEDUCTION', 'TAX');

-- Profiles
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  region region_t not null default 'UK',
  currency currency_t not null default 'GBP',
  plan plan_t not null default 'FREE',
  billing_cycle billing_cycle_t,
  reminder_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_entitlements (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  free_payslips_used integer not null default 0,
  free_csv_used integer not null default 0,
  subscription_status subscription_status_t not null default 'TRIAL',
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role household_role_t not null default 'MEMBER',
  status household_member_status_t not null default 'INVITED',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.employers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  tax_ref text,
  created_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  bucket text not null,
  path text not null,
  mime_type text not null,
  encrypted boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete restrict,
  period_month integer not null check (period_month between 1 and 12),
  period_year integer not null check (period_year between 2000 and 2100),
  schema_version text not null,
  source_file_id uuid not null references public.files(id) on delete restrict,
  status payslip_status_t not null default 'UPLOADED',
  confidence numeric(5,4),
  notes text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists payslips_user_period_idx on public.payslips (user_id, period_year desc, period_month desc);

create table if not exists public.payslip_breakdowns (
  payslip_id uuid primary key references public.payslips(id) on delete cascade,
  gross numeric(12,2) not null,
  net numeric(12,2) not null,
  tax numeric(12,2) not null,
  pension numeric(12,2) not null,
  ni_or_prsi numeric(12,2) not null,
  usc numeric(12,2),
  bonuses numeric(12,2),
  overtime numeric(12,2),
  field_confidence jsonb not null default '{}'::jsonb,
  edited_fields jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payslip_line_items (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references public.payslips(id) on delete cascade,
  type line_item_type_t not null,
  label text not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.annual_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  report_year integer not null,
  totals jsonb not null,
  monthly_series jsonb not null,
  employer_timeline jsonb not null,
  line_item_totals jsonb not null,
  data_quality jsonb not null,
  export_pdf_url text,
  export_xlsx_url text,
  created_at timestamptz not null default now(),
  unique (user_id, report_year)
);

create table if not exists public.taxback_claim_catalog (
  id uuid primary key default gen_random_uuid(),
  region region_t not null,
  category text not null,
  eligibility_rules text not null,
  estimate_formula text not null,
  official_link text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  stripe_subscription_id text unique,
  plan plan_t not null,
  billing_cycle billing_cycle_t not null,
  status subscription_status_t not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_customers (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  stripe_customer_id text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_preferences (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  monthly_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  template text not null,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Deferred to V1.5 (kept out of active flow)
create table if not exists public.bank_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  file_id uuid,
  mapping_config jsonb,
  row_count integer,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_import_id uuid references public.bank_imports(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  posted_at timestamptz,
  description text,
  amount numeric(12,2),
  category text
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  category text,
  kind text,
  amount numeric(12,2),
  due_date date,
  recurrence text,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  name text,
  target_amount numeric(12,2),
  target_date date,
  progress_amount numeric(12,2) default 0,
  created_at timestamptz not null default now()
);

-- Auth bootstrap: create profile + default household on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into public.user_profiles (id, email)
  values (new.id, coalesce(new.email, ''));

  insert into public.usage_entitlements (user_id)
  values (new.id);

  insert into public.reminder_preferences (user_id, monthly_enabled)
  values (new.id, true);

  insert into public.households (owner_user_id, name)
  values (new.id, 'My Household')
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role, status)
  values (new_household_id, new.id, 'OWNER', 'ACTIVE');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS
alter table public.user_profiles enable row level security;
alter table public.usage_entitlements enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.employers enable row level security;
alter table public.files enable row level security;
alter table public.payslips enable row level security;
alter table public.payslip_breakdowns enable row level security;
alter table public.payslip_line_items enable row level security;
alter table public.annual_reports enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.reminder_preferences enable row level security;
alter table public.email_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.taxback_claim_catalog enable row level security;

create policy "user_profile_self" on public.user_profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "usage_self" on public.usage_entitlements
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "household_member_read" on public.households
for select using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = households.id
      and hm.user_id = auth.uid()
      and hm.status = 'ACTIVE'
  )
);

create policy "household_owner_write" on public.households
for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "household_members_read" on public.household_members
for select using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id = household_members.household_id
      and hm.user_id = auth.uid()
      and hm.status = 'ACTIVE'
  )
);

create policy "household_owner_manage_members" on public.household_members
for all using (
  exists (
    select 1 from public.households h
    where h.id = household_members.household_id
      and h.owner_user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.households h
    where h.id = household_members.household_id
      and h.owner_user_id = auth.uid()
  )
);

create policy "employers_self" on public.employers
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "files_self" on public.files
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "payslips_self_or_household" on public.payslips
for select using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.household_members hm
    join public.households h on h.id = hm.household_id
    where hm.user_id = auth.uid()
      and hm.status = 'ACTIVE'
      and h.owner_user_id = payslips.user_id
  )
);

create policy "payslips_self_write" on public.payslips
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "payslip_breakdowns_via_payslip" on public.payslip_breakdowns
for all using (
  exists (
    select 1 from public.payslips p
    where p.id = payslip_breakdowns.payslip_id
      and p.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.payslips p
    where p.id = payslip_breakdowns.payslip_id
      and p.user_id = auth.uid()
  )
);

create policy "payslip_line_items_via_payslip" on public.payslip_line_items
for all using (
  exists (
    select 1 from public.payslips p
    where p.id = payslip_line_items.payslip_id
      and p.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.payslips p
    where p.id = payslip_line_items.payslip_id
      and p.user_id = auth.uid()
  )
);

create policy "annual_reports_self_or_household" on public.annual_reports
for select using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.household_members hm
    join public.households h on h.id = hm.household_id
    where hm.user_id = auth.uid()
      and hm.status = 'ACTIVE'
      and h.owner_user_id = annual_reports.user_id
  )
);

create policy "annual_reports_self_write" on public.annual_reports
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "subscriptions_self" on public.subscriptions
for select using (user_id = auth.uid());

create policy "stripe_customers_self" on public.stripe_customers
for select using (user_id = auth.uid());

create policy "reminder_self" on public.reminder_preferences
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "email_events_self" on public.email_events
for select using (user_id = auth.uid());

create policy "audit_logs_self" on public.audit_logs
for select using (user_id = auth.uid());

create policy "taxback_catalog_read" on public.taxback_claim_catalog
for select using (true);

-- Storage recommendations
-- 1) Create private bucket `payslips` and `reports`
-- 2) Use signed URLs only
-- 3) Apply retention via scheduled cleanup (default 30 days)
