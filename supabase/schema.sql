create table profiles (user_id uuid primary key references auth.users(id), free_used int default 0,
  is_pro boolean default false, pro_since timestamptz, pay_code varchar(8) unique);
create table payments (transaction_id text primary key, user_id uuid references profiles(user_id),
  amount int not null, created_at timestamptz default now());
create table rooms (code varchar(6) primary key, host_id uuid references auth.users(id), total int not null,
  n int not null, mode text default 'random', topics text[] default '{}', custom text[] default '{}',
  created_at timestamptz default now());
create table envelopes (id uuid primary key default gen_random_uuid(), room_code varchar(6) references rooms(code) on delete cascade,
  amount int not null, guest_name text, answer text, score int, roast text, opened_at timestamptz);
create index on envelopes(room_code);
alter table profiles enable row level security; alter table payments enable row level security;
alter table rooms enable row level security; alter table envelopes enable row level security;
-- Mọi truy cập đi qua API route bằng service key, nên không mở policy nào cho client.

create or replace function consume_room_slot(uid uuid, need_pro boolean) returns jsonb
language plpgsql security definer as $$
declare p profiles;
begin
  insert into profiles(user_id, pay_code) values (uid, upper(substr(md5(random()::text||uid::text),1,8))) on conflict do nothing;
  select * into p from profiles where user_id = uid for update;
  if p.is_pro then
    if (select count(*) from rooms where host_id = uid and created_at > now() - interval '1 day') >= 30
      then return jsonb_build_object('plan','limit','pay_code',p.pay_code); end if;
    return jsonb_build_object('plan','pro','pay_code',p.pay_code);
  end if;
  if not need_pro and p.free_used < 3 then
    update profiles set free_used = free_used + 1 where user_id = uid;
    return jsonb_build_object('plan','free','pay_code',p.pay_code);
  end if;
  return jsonb_build_object('plan','denied','pay_code',p.pay_code);
end $$;
