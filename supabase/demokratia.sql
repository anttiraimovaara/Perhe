-- Perheen tyotila: Demokratia (aanestykset) + Ilmoitukset (ilmoitustaulu)
-- Aja Supabasen SQL Editorissa kerran.

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  multi boolean not null default false,
  closed boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  text text not null,
  position bigint not null default 0
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  voter text not null,
  created_at timestamptz not null default now()
);

create index if not exists poll_options_poll_idx on public.poll_options(poll_id);
create index if not exists votes_poll_idx on public.votes(poll_id);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  created_by text,
  created_at timestamptz not null default now()
);

alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_options;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.announcements;

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "perhe polls r" on public.polls;
drop policy if exists "perhe polls w" on public.polls;
create policy "perhe polls r" on public.polls for select using (true);
create policy "perhe polls w" on public.polls for all using (true) with check (true);

drop policy if exists "perhe popt r" on public.poll_options;
drop policy if exists "perhe popt w" on public.poll_options;
create policy "perhe popt r" on public.poll_options for select using (true);
create policy "perhe popt w" on public.poll_options for all using (true) with check (true);

drop policy if exists "perhe votes r" on public.votes;
drop policy if exists "perhe votes w" on public.votes;
create policy "perhe votes r" on public.votes for select using (true);
create policy "perhe votes w" on public.votes for all using (true) with check (true);

drop policy if exists "perhe ann r" on public.announcements;
drop policy if exists "perhe ann w" on public.announcements;
create policy "perhe ann r" on public.announcements for select using (true);
create policy "perhe ann w" on public.announcements for all using (true) with check (true);
