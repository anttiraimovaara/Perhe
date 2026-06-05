-- ============================================================
-- Perheen työtila – Supabase-skeema
-- Aja tämä Supabase-projektissa: SQL Editor -> New query -> liitä -> Run.
-- ============================================================

-- Listat (esim. "Ruokakauppa", "Rautakauppa", "Kotiremontti")
create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('shopping','todo','notes','calendar')),
  title       text not null,
  created_by  text,
  created_at  timestamptz not null default now()
);

-- Rivit listoilla
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists(id) on delete cascade,
  text        text not null,
  checked     boolean not null default false,
  image_url   text,
  added_by    text,
  position    bigint not null default (extract(epoch from now()) * 1000),
  created_at  timestamptz not null default now()
);

create index if not exists items_list_id_idx on public.items(list_id);

-- ------------------------------------------------------------
-- Realtime: lähetetään muutokset selaimille
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.items;

-- ------------------------------------------------------------
-- RLS: koska sovellus käyttää vain yhteistä anon-avainta eikä
-- raskasta tunnistautumista, sallitaan anon-roolille luku ja
-- kirjoitus. Suojaus hoidetaan sovelluksen perhe-PIN:llä ja
-- sillä, että osoitetta ei jaeta ulkopuolisille.
-- ------------------------------------------------------------
alter table public.lists enable row level security;
alter table public.items enable row level security;

drop policy if exists "perhe lukee listat" on public.lists;
drop policy if exists "perhe muokkaa listat" on public.lists;
create policy "perhe lukee listat"  on public.lists for select using (true);
create policy "perhe muokkaa listat" on public.lists for all using (true) with check (true);

drop policy if exists "perhe lukee itemit" on public.items;
drop policy if exists "perhe muokkaa itemit" on public.items;
create policy "perhe lukee itemit"  on public.items for select using (true);
create policy "perhe muokkaa itemit" on public.items for all using (true) with check (true);

-- ------------------------------------------------------------
-- Kuvat: luo julkinen storage-bucket nimeltä "kuvat".
-- (Voit myös tehdä tämän käsin: Storage -> New bucket -> nimi "kuvat",
--  rasti "Public bucket".)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('kuvat', 'kuvat', true)
on conflict (id) do nothing;

drop policy if exists "kuvat luku" on storage.objects;
drop policy if exists "kuvat lataus" on storage.objects;
create policy "kuvat luku"   on storage.objects for select using (bucket_id = 'kuvat');
create policy "kuvat lataus" on storage.objects for insert with check (bucket_id = 'kuvat');

-- ------------------------------------------------------------
-- Kalenteri
-- ------------------------------------------------------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  event_date  date not null,
  event_time  time,
  who         text,
  note        text,
  recur       text not null default 'none' check (recur in ('none','weekly','monthly')),
  recur_until date,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists events_date_idx on public.events(event_date);
alter publication supabase_realtime add table public.events;
alter table public.events enable row level security;
drop policy if exists "perhe lukee tapahtumat" on public.events;
drop policy if exists "perhe muokkaa tapahtumat" on public.events;
create policy "perhe lukee tapahtumat"  on public.events for select using (true);
create policy "perhe muokkaa tapahtumat" on public.events for all using (true) with check (true);
