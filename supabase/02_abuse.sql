-- Chạy SAU schema.sql. Chống tạo nhiều tài khoản ăn lượt free.
create table free_log (id bigserial primary key, user_id uuid, ip_hash text, dev_id text, created_at timestamptz default now());
create index on free_log(ip_hash, created_at); create index on free_log(dev_id, created_at);
create table rate_hits (key text, ts timestamptz default now()); create index on rate_hits(key, ts);
alter table free_log enable row level security; alter table rate_hits enable row level security;

create or replace function rate_hit(k text, win int, mx int) returns boolean language plpgsql security definer as $$
declare c int;
begin
  delete from rate_hits where ts < now() - interval '1 day';
  select count(*) into c from rate_hits where key = k and ts > now() - make_interval(secs => win);
  if c >= mx then return false; end if;
  insert into rate_hits(key) values (k); return true;
end $$;

create or replace function ensure_profile(uid uuid) returns void language sql security definer as $$
  insert into profiles(user_id, pay_code) values (uid, upper(substr(md5(random()::text||uid::text),1,8))) on conflict do nothing;
$$;

drop function if exists consume_room_slot(uuid, boolean);
create or replace function consume_room_slot(uid uuid, need_pro boolean, p_dev text) returns jsonb
language plpgsql security definer as $$
declare p profiles;
begin
  perform ensure_profile(uid);
  select * into p from profiles where user_id = uid for update;
  if p.is_pro then
    if (select count(*) from rooms where host_id = uid and created_at > now() - interval '1 day') >= 30
      then return jsonb_build_object('plan','limit','pay_code',p.pay_code); end if;
    return jsonb_build_object('plan','pro','pay_code',p.pay_code);
  end if;
  -- free: tối đa 3/tài khoản và 3/thiết bị trong 30 ngày (không chặn theo IP)
  if not need_pro and p.free_used < 3
     and (select count(*) from free_log where dev_id = p_dev and created_at > now() - interval '30 days') < 3 then
    update profiles set free_used = free_used + 1 where user_id = uid;
    insert into free_log(user_id, dev_id) values (uid, p_dev);
    return jsonb_build_object('plan','free','pay_code',p.pay_code);
  end if;
  return jsonb_build_object('plan','denied','pay_code',p.pay_code);
end $$;
