-- =====================================================================
-- Portfolio site: profiles with roles, booking requests, RLS, realtime
-- =====================================================================

-- ---------- Roles & profiles ----------
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  role       public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user. Role is set only by the auth trigger, never by clients.';

alter table public.profiles enable row level security;

-- Role rule lives in one place. Admin only when the address is confirmed,
-- so an unconfirmed sign-up claiming the address can never become admin.
create or replace function public.role_for_user(p_email text, p_confirmed_at timestamptz)
returns public.app_role
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(btrim(p_email)) = 'yasmein.abdelmohsen@gmail.com' and p_confirmed_at is not null
      then 'admin'::public.app_role
    else 'user'::public.app_role
  end;
$$;

-- Keep profiles in sync with auth.users (insert, email change, confirmation)
create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), public.role_for_user(new.email, new.email_confirmed_at))
  on conflict (id) do update
    set email      = excluded.email,
        role       = excluded.role,
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_change();

create trigger on_auth_user_email_changed
  after update of email, email_confirmed_at on auth.users
  for each row
  when (old.email is distinct from new.email
        or old.email_confirmed_at is distinct from new.email_confirmed_at)
  execute function public.handle_auth_user_change();

-- Backfill users that existed before this migration
insert into public.profiles (id, email, role)
select u.id, coalesce(u.email, ''), public.role_for_user(u.email, u.email_confirmed_at)
from auth.users u
on conflict (id) do update
  set email = excluded.email, role = excluded.role, updated_at = now();

-- Admin check used by policies. SECURITY DEFINER so it can read profiles
-- without recursing through profiles' own RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.handle_auth_user_change() from public, anon, authenticated;
revoke execute on function public.role_for_user(text, timestamptz) from public, anon, authenticated;

-- ---------- Bookings ----------
create table public.bookings (
  id         uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(btrim(first_name)) between 1 and 100),
  last_name  text not null check (char_length(btrim(last_name)) between 1 and 100),
  email      text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  phone      text not null check (phone ~ '^[+0-9 ().-]{7,25}$'),
  status     text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'closed')),
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bookings is 'Session booking requests from the website form.';

create index bookings_created_at_idx on public.bookings (created_at desc);
create index bookings_user_id_idx on public.bookings (user_id);

alter table public.bookings enable row level security;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- Privileges (least privilege, column level) ----------
revoke all on public.profiles from anon, authenticated;
revoke all on public.bookings from anon, authenticated;

grant select on public.profiles to authenticated;

-- Visitors may only supply the four form fields; status/user_id come from defaults.
grant insert (first_name, last_name, email, phone) on public.bookings to anon, authenticated;
grant select on public.bookings to authenticated;
grant update (status) on public.bookings to authenticated;
grant delete on public.bookings to authenticated;

-- ---------- Policies ----------
create policy "Users read own profile; admins read all"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Anyone can submit a booking request"
  on public.bookings for insert
  to anon, authenticated
  with check (
    status = 'new'
    and (user_id is null or user_id = (select auth.uid()))
  );

create policy "Users read own bookings; admins read all"
  on public.bookings for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins update bookings"
  on public.bookings for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins delete bookings"
  on public.bookings for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------- Realtime ----------
-- postgres_changes respects the select policies above, so each client only
-- receives the rows it is allowed to read.
alter publication supabase_realtime add table public.bookings;
