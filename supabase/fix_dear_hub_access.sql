-- DEAR Hub access repair
-- Run this in Supabase SQL Editor for the project used by the app.
-- This script is idempotent and does not delete application data.

begin;

-- Ensure the teacher account has the profile expected by the application.
insert into public.profiles (id, email, first_name, last_name, role)
select id, email, 'Ghada', 'Ghazy', 'teacher'
from auth.users
where lower(email) = 'gaghzy@gmail.com'
on conflict (id) do update
set email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = 'teacher',
    updated_at = now();

-- Rebuild profile access rules so users can see their own profile,
-- teachers can see students, and students can see the teacher profile.
alter table public.profiles enable row level security;

-- Avoid recursive RLS evaluation when a profile policy checks the viewer role.
create or replace function public.is_teacher(viewer_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = viewer_id and role = 'teacher'
  );
$$;

revoke all on function public.is_teacher(uuid) from public;
grant execute on function public.is_teacher(uuid) to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible" on public.profiles
for select to authenticated
using (
  auth.uid() = id
  or (public.is_teacher() and role = 'student')
  or ((not public.is_teacher()) and role = 'teacher')
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Students can read active assignments. Teachers can manage their own.
alter table public.dears enable row level security;
drop policy if exists "dears_select_all" on public.dears;
create policy "dears_select_all" on public.dears
for select to authenticated
using (status = 'active' or auth.uid() = teacher_id);

-- Students can read their own submissions; teachers can review all submissions.
alter table public.dear_submissions enable row level security;
drop policy if exists "submissions_select_own_or_teacher" on public.dear_submissions;
create policy "submissions_select_own_or_teacher" on public.dear_submissions
for select to authenticated
using (
  auth.uid() = student_id
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'teacher'
  )
);

-- Keep Realtime enabled for the screens that subscribe to database changes.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dears'
  ) then
    alter publication supabase_realtime add table public.dears;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dear_submissions'
  ) then
    alter publication supabase_realtime add table public.dear_submissions;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
end $$;

commit;

-- Verification queries. These should return the teacher and student profiles,
-- and the current number of assignments.
select id, email, role, first_name, last_name
from public.profiles
order by role desc, first_name;

select count(*) as active_dear_count
from public.dears
where status = 'active';
