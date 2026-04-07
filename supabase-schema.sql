-- ─── サボカレ Supabase スキーマ ──────────────
-- このSQL文を Supabase の SQL Editor で実行してください

-- イベントテーブル
create table if not exists events (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  date text not null,
  start_time text,
  duration integer default 60,
  tags jsonb default '{}'::jsonb,
  pre_memo text default '',
  retrospective_memo text default '',
  completed boolean default false,
  color text default '#7C3AED',
  master_id text,
  recurrence_type text,
  google_event_id text,
  from_google boolean default false,
  created_at bigint
);

create index if not exists events_user_date_idx on events(user_id, date);

-- タグテーブル
create table if not exists tags (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category text,
  label text,
  color text,
  usage_count integer default 0
);

create index if not exists tags_user_idx on tags(user_id);

-- RLS（行レベルセキュリティ）有効化
alter table events enable row level security;
alter table tags enable row level security;

-- ポリシー：自分のデータだけアクセス可能
drop policy if exists "Users manage own events" on events;
create policy "Users manage own events" on events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own tags" on tags;
create policy "Users manage own tags" on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
