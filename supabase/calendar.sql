-- ============================================================
-- Perheen työtila – Kalenteri (lisäys olemassa olevaan kantaan)
-- Aja tämä Supabasessa: SQL Editor -> New query -> liitä -> Run.
-- (Tämä on turvallista ajaa, vaikka osa olisi jo olemassa.)
-- ============================================================

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  event_date  date not null,                 -- ensimmäinen/ainoa esiintymä
  event_time  time,                          -- null = koko päivä
  who         text,                          -- perheenjäsenen nimi, 'Koko perhe' tai null
  note        text,
  recur       text not null default 'none'   -- 'none' | 'weekly' | 'monthly' | 'yearly'
              check (recur in ('none','weekly','monthly','yearly')),
  recur_until date,                          -- valinnainen toiston loppupäivä
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists events_date_idx on public.events(event_date);

-- Realtime päälle
alter publication supabase_realtime add table public.events;

-- RLS: sama kevyt malli kuin muillakin tauluilla (perhe-PIN suojaa sovellustasolla)
alter table public.events enable row level security;
drop policy if exists "perhe lukee tapahtumat" on public.events;
drop policy if exists "perhe muokkaa tapahtumat" on public.events;
create policy "perhe lukee tapahtumat"  on public.events for select using (true);
create policy "perhe muokkaa tapahtumat" on public.events for all using (true) with check (true);
