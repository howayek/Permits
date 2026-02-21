-- Create enum for user roles
create type public.app_role as enum ('developer', 'citizen', 'government');

-- Create profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Create user_roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

-- Enable RLS on user_roles
alter table public.user_roles enable row level security;

-- Create security definer function to check roles
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Create applications table
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  permit_type text not null,
  applicant_name text not null,
  contact_info text not null,
  address text not null,
  description text,
  status text default 'pending' not null,
  submitted_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Enable RLS on applications
alter table public.applications enable row level security;

-- RLS Policies for profiles
create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- RLS Policies for user_roles
create policy "Users can view their own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Developers can manage all roles"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'developer'));

-- RLS Policies for applications
create policy "Citizens can view their own applications"
  on public.applications for select
  to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'government') or public.has_role(auth.uid(), 'developer'));

create policy "Citizens can create their own applications"
  on public.applications for insert
  to authenticated
  with check (auth.uid() = user_id and public.has_role(auth.uid(), 'citizen'));

create policy "Government can update applications"
  on public.applications for update
  to authenticated
  using (public.has_role(auth.uid(), 'government') or public.has_role(auth.uid(), 'developer'));

create policy "Developers can manage all applications"
  on public.applications for all
  to authenticated
  using (public.has_role(auth.uid(), 'developer'));

-- Create trigger function for updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create triggers for updated_at
create trigger set_updated_at_profiles
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

create trigger set_updated_at_applications
  before update on public.applications
  for each row
  execute function public.handle_updated_at();

-- Create function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$;

-- Create trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();