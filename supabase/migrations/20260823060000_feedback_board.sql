-- DEAR Hub community feedback board
create table if not exists public.feedback_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'idea' check (category in ('idea', 'request', 'bug')),
  status text not null default 'open' check (status in ('open', 'planned', 'in_progress', 'complete')),
  vote_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback_votes (
  post_id uuid not null references public.feedback_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.feedback_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feedback_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback_posts enable row level security;
alter table public.feedback_votes enable row level security;
alter table public.feedback_comments enable row level security;

drop policy if exists feedback_posts_read on public.feedback_posts;
create policy feedback_posts_read on public.feedback_posts for select to authenticated using (true);
drop policy if exists feedback_posts_insert on public.feedback_posts;
create policy feedback_posts_insert on public.feedback_posts for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists feedback_posts_update_own on public.feedback_posts;
create policy feedback_posts_update_own on public.feedback_posts for update to authenticated using (auth.uid() = author_id);
drop policy if exists feedback_posts_delete_own on public.feedback_posts;
create policy feedback_posts_delete_own on public.feedback_posts for delete to authenticated using (auth.uid() = author_id);

drop policy if exists feedback_votes_read on public.feedback_votes;
create policy feedback_votes_read on public.feedback_votes for select to authenticated using (auth.uid() = user_id);
drop policy if exists feedback_votes_insert on public.feedback_votes;
create policy feedback_votes_insert on public.feedback_votes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists feedback_votes_delete on public.feedback_votes;
create policy feedback_votes_delete on public.feedback_votes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists feedback_comments_read on public.feedback_comments;
create policy feedback_comments_read on public.feedback_comments for select to authenticated using (true);
drop policy if exists feedback_comments_insert on public.feedback_comments;
create policy feedback_comments_insert on public.feedback_comments for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists feedback_comments_delete on public.feedback_comments;
create policy feedback_comments_delete on public.feedback_comments for delete to authenticated using (auth.uid() = author_id);

create or replace function public.update_feedback_vote_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update feedback_posts set vote_count = vote_count + 1 where id = new.post_id;
    return new;
  end if;
  update feedback_posts set vote_count = greatest(vote_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists feedback_vote_count on public.feedback_votes;
create trigger feedback_vote_count after insert or delete on public.feedback_votes for each row execute function public.update_feedback_vote_count();
