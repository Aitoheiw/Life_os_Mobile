-- Life OS — base Supabase (à exécuter une fois dans « SQL Editor » du projet).
--
-- Principe : l'application garde ses données en local (IndexedDB, fonctionne hors ligne)
-- et les synchronise avec cette table unique. Chaque ligne = un élément
-- (tâche, projet, habitude…) stocké tel quel en JSON dans `data`.
-- Une table générique évite de toucher à Supabase quand le modèle évolue.
-- Suppression = « pierre tombale » (`deleted = true`) pour la propager aux autres appareils.
-- Le script peut être relancé sans risque.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  table_name text        not null,
  id         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  -- Fixé par le serveur (trigger) : sert de curseur pour récupérer les nouveautés.
  updated_at timestamptz not null default now(),
  primary key (user_id, table_name, id)
);

create index if not exists records_user_updated_idx on public.records (user_id, updated_at);

-- L'horloge du serveur fait foi (les horloges des téléphones peuvent dériver).
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- Sécurité : chaque utilisateur ne voit et ne modifie QUE ses propres lignes.
alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;
create policy "records_select_own" on public.records for select to authenticated using ((select auth.uid()) = user_id);
create policy "records_insert_own" on public.records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "records_update_own" on public.records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "records_delete_own" on public.records for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;

-- Temps réel : prévient les autres appareils ouverts qu'une modification est arrivée.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
end;
$$;
