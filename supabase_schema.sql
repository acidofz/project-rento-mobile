create table if not exists public.listings (
    id bigint generated always as identity primary key,
    title text not null,
    district text not null,
    rooms integer not null check (rooms > 0),
    price bigint not null check (price > 0),
    created_at timestamptz not null default now()
);

alter table public.listings add column if not exists title text;
alter table public.listings add column if not exists district text;
alter table public.listings add column if not exists rooms integer;
alter table public.listings add column if not exists price bigint;
alter table public.listings add column if not exists created_at timestamptz default now();
alter table public.listings add column if not exists owner_id uuid;

update public.listings set district = coalesce(district, 'Не указан') where district is null;
update public.listings set rooms = coalesce(rooms, 1) where rooms is null;
update public.listings set price = coalesce(price, 1) where price is null;

alter table public.listings alter column title set not null;
alter table public.listings alter column district set not null;
alter table public.listings alter column rooms set not null;
alter table public.listings alter column price set not null;

create index if not exists listings_owner_id_idx on public.listings(owner_id);

alter table public.listings enable row level security;

drop policy if exists "Public read listings" on public.listings;
create policy "Public read listings"
on public.listings
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated insert listings" on public.listings;
create policy "Authenticated insert listings"
on public.listings
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Owner update listings" on public.listings;
create policy "Owner update listings"
on public.listings
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Owner delete listings" on public.listings;
create policy "Owner delete listings"
on public.listings
for delete
to authenticated
using (owner_id = auth.uid());

create table if not exists public.favorites (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    listing_id bigint not null references public.listings(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique(user_id, listing_id)
);

create index if not exists favorites_user_id_idx on public.favorites(user_id);
create index if not exists favorites_listing_id_idx on public.favorites(listing_id);

alter table public.favorites enable row level security;

drop policy if exists "Users select own favorites" on public.favorites;
create policy "Users select own favorites"
on public.favorites
for select
to authenticated
using (user_id = auth.uid());

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    username text,
    created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists is_blocked boolean not null default false;

create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists profiles_email_idx on public.profiles(email);

alter table public.profiles enable row level security;

drop policy if exists "Public read profiles" on public.profiles;
create policy "Public read profiles"
on public.profiles
for select
to authenticated, anon
using (true);

drop policy if exists "Users upsert own profile" on public.profiles;
create policy "Users upsert own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Users insert own favorites" on public.favorites;
create policy "Users insert own favorites"
on public.favorites
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users delete own favorites" on public.favorites;
create policy "Users delete own favorites"
on public.favorites
for delete
to authenticated
using (user_id = auth.uid());

create table if not exists public.chats (
    id bigint generated always as identity primary key,
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.chat_members (
    id bigint generated always as identity primary key,
    chat_id bigint not null references public.chats(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique(chat_id, user_id)
);

create table if not exists public.messages (
    id bigint generated always as identity primary key,
    chat_id bigint not null references public.chats(id) on delete cascade,
    sender_id uuid not null references auth.users(id) on delete cascade,
    body text not null,
    created_at timestamptz not null default now()
);

create index if not exists chat_members_chat_id_idx on public.chat_members(chat_id);
create index if not exists chat_members_user_id_idx on public.chat_members(user_id);
create index if not exists messages_chat_id_idx on public.messages(chat_id);
create index if not exists messages_sender_id_idx on public.messages(sender_id);

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;

do $$
declare r record;
begin
    for r in (
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = 'chats'
    )
    loop
        execute format('drop policy if exists %I on public.chats', r.policyname);
    end loop;
end $$;

do $$
declare r record;
begin
    for r in (
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = 'chat_members'
    )
    loop
        execute format('drop policy if exists %I on public.chat_members', r.policyname);
    end loop;
end $$;

do $$
declare r record;
begin
    for r in (
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = 'messages'
    )
    loop
        execute format('drop policy if exists %I on public.messages', r.policyname);
    end loop;
end $$;

drop policy if exists "Members can view chats" on public.chats;
create policy "Members can view chats"
on public.chats
for select
to authenticated
using (
    created_by = auth.uid()
    or
    exists (
        select 1 from public.chat_members cm
        where cm.chat_id = chats.id and cm.user_id = auth.uid()
    )
);

drop policy if exists "Users create chats" on public.chats;
create policy "Users create chats"
on public.chats
for insert
to public
with check (true);

-- Id чатов, где пользователь — участник. SECURITY DEFINER обходит RLS на chat_members,
-- иначе политика SELECT с подзапросом к той же таблице даёт бесконечную рекурсию.
create or replace function public.current_user_chat_ids()
returns table (chat_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  select cm.chat_id
  from public.chat_members cm
  where cm.user_id = auth.uid();
$$;

revoke all on function public.current_user_chat_ids() from public;
grant execute on function public.current_user_chat_ids() to authenticated;

drop policy if exists "Members view chat_members" on public.chat_members;
create policy "Members view chat_members"
on public.chat_members
for select
to authenticated
using (
    exists (
        select 1
        from public.current_user_chat_ids() u
        where u.chat_id = chat_members.chat_id
    )
);

drop policy if exists "Users insert own chat_members" on public.chat_members;
create policy "Users insert own chat_members"
on public.chat_members
for insert
to public
with check (true);

drop policy if exists "Members view messages" on public.messages;
create policy "Members view messages"
on public.messages
for select
to authenticated
using (
    exists (
        select 1 from public.chat_members cm
        where cm.chat_id = messages.chat_id and cm.user_id = auth.uid()
    )
);

drop policy if exists "Members send messages" on public.messages;
create policy "Members send messages"
on public.messages
for insert
to authenticated
with check (
    sender_id = auth.uid()
    and exists (
        select 1 from public.chat_members cm
        where cm.chat_id = messages.chat_id and cm.user_id = auth.uid()
    )
);

-- Диалог 1:1: найти существующий чат ровно из двух участников или создать новый (обход RLS при поиске).
create or replace function public.find_or_create_peer_chat(p_peer_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_chat_id bigint;
begin
    if v_uid is null then
        raise exception 'not authenticated';
    end if;
    if p_peer_id = v_uid then
        raise exception 'invalid peer';
    end if;

    select c.id into v_chat_id
    from public.chats c
    where exists (select 1 from public.chat_members m1 where m1.chat_id = c.id and m1.user_id = v_uid)
      and exists (select 1 from public.chat_members m2 where m2.chat_id = c.id and m2.user_id = p_peer_id)
      and (select count(*)::int from public.chat_members cm where cm.chat_id = c.id) = 2
    order by c.id desc
    limit 1;

    if v_chat_id is not null then
        return v_chat_id;
    end if;

    insert into public.chats (created_by) values (v_uid) returning id into v_chat_id;
    insert into public.chat_members (chat_id, user_id) values (v_chat_id, v_uid);
    insert into public.chat_members (chat_id, user_id) values (v_chat_id, p_peer_id);
    return v_chat_id;
end;
$$;

revoke all on function public.find_or_create_peer_chat(uuid) from public;
grant execute on function public.find_or_create_peer_chat(uuid) to authenticated;

-- Listing cover image (public URL in this column)
alter table public.listings add column if not exists image_url text;

-- Map markers (WGS84). Optional: both null or both set from the app.
alter table public.listings add column if not exists latitude double precision;
alter table public.listings add column if not exists longitude double precision;

-- Storage: public bucket for listing photos (path: {user_id}/{filename})
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "listing images public read" on storage.objects;
create policy "listing images public read"
on storage.objects
for select
to public
using (bucket_id = 'listing-images');

drop policy if exists "listing images owner insert" on storage.objects;
create policy "listing images owner insert"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'listing-images'
    -- Path must be {auth.uid()}/... (same rule the app uses)
    and name like auth.uid()::text || '/%'
);

drop policy if exists "listing images owner update" on storage.objects;
create policy "listing images owner update"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'listing-images'
    and name like auth.uid()::text || '/%'
)
with check (
    bucket_id = 'listing-images'
    and name like auth.uid()::text || '/%'
);

drop policy if exists "listing images owner delete" on storage.objects;
create policy "listing images owner delete"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'listing-images'
    and name like auth.uid()::text || '/%'
);

-- Realtime: INSERT в messages для клиента (postgres_changes). В Dashboard: Database → Publications.
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = 'messages'
        ) then
            alter publication supabase_realtime add table public.messages;
        end if;
    end if;
exception
    when duplicate_object then
        null;
    when undefined_object then
        raise notice 'Publication supabase_realtime not found (non-hosted Postgres?).';
end;
$$;
