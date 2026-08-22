-- DEAR Hub social and profile features

alter table public.profiles add column if not exists username text;

update public.profiles
set username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g'))
where username is null;

create unique index if not exists profiles_username_unique
on public.profiles (lower(username))
where username is not null;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
check (username is null or username ~ '^[a-zA-Z0-9_]{3,20}$');

create table if not exists public.chat_permissions (
  id uuid primary key default gen_random_uuid(),
  student_a uuid not null references public.profiles(id) on delete cascade,
  student_b uuid not null references public.profiles(id) on delete cascade,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (student_a <> student_b),
  unique (student_a, student_b)
);

alter table public.chat_permissions enable row level security;

drop policy if exists chat_permissions_teacher_all on public.chat_permissions;
create policy chat_permissions_teacher_all on public.chat_permissions
for all to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher'));

drop policy if exists chat_permissions_student_read on public.chat_permissions;
create policy chat_permissions_student_read on public.chat_permissions
for select to authenticated
using (auth.uid() = student_a or auth.uid() = student_b);

alter table public.messages enable row level security;
drop policy if exists msg_insert_own on public.messages;
create policy msg_insert_own on public.messages
for insert to authenticated
with check (
  auth.uid() = sender_id
  and (
    exists (select 1 from public.profiles where id = recipient_id and role = 'teacher')
    or exists (select 1 from public.profiles where id = sender_id and role = 'teacher')
    or exists (
      select 1 from public.chat_permissions cp
      where cp.allowed = true
        and ((cp.student_a = sender_id and cp.student_b = recipient_id)
          or (cp.student_a = recipient_id and cp.student_b = sender_id))
    )
  )
);

drop policy if exists msg_select_participants on public.messages;
create policy msg_select_participants on public.messages
for select to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

alter table public.messages replica identity full;

-- Allow the teacher to manage the student-to-student chat controls in Realtime.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_permissions') then
    alter publication supabase_realtime add table public.chat_permissions;
  end if;
end $$;
