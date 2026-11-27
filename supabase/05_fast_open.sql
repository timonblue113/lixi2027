-- Chạy sau 04_open.sql. Mở bao chỉ cần 1 lần gọi database (kiểm tra giới hạn, đáp án thưởng, chọn bao, trừ thưởng).
create extension if not exists unaccent;
create or replace function norm_txt(s text) returns text language sql stable set search_path = public, extensions as $$
  select trim(regexp_replace(regexp_replace(lower(replace(replace(unaccent(coalesce(s,'')), 'đ','d'), 'Đ','D')), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'))
$$;
create or replace function open_fast(p_code text, p_name text, p_answer text, p_bin text, p_acct text, p_dev text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r rooms; e envelopes; n int; idx int; b int := 0; granted int := 0; rec record; tk int; qa text; an text; correct boolean := false; pct int := 0;
begin
  if not rate_hit('open:' || p_dev, 3600, 40) then return jsonb_build_object('error','rate'); end if;
  if not rate_hit('open:all', 3600, 2000) then return jsonb_build_object('error','busy'); end if;
  select * into r from rooms where code = p_code for update;
  if not found then return jsonb_build_object('error','noroom'); end if;
  select * into e from envelopes where room_code = p_code and bank_account = p_acct and opened_at is not null limit 1;
  if found then return jsonb_build_object('id',e.id,'amount',e.amount,'bonus',coalesce(e.bonus,0),'roast',e.roast,'again',true); end if;
  qa := norm_txt(r.quiz_a); an := norm_txt(p_answer);
  if length(trim(p_answer)) < (case when qa <> '' then 1 else 8 end) then return jsonb_build_object('error','short'); end if;
  if qa <> '' and (' ' || an || ' ') like ('% ' || qa || ' %') and length(an) <= length(qa) + 20 then correct := true; pct := coalesce(r.bonus_pct,0); end if;
  select count(*) into n from envelopes where room_code = p_code and opened_at is null;
  if n = 0 then return jsonb_build_object('error','empty'); end if;
  idx := floor(random()*n)::int; -- luôn ngẫu nhiên đều
  select * into e from envelopes where room_code = p_code and opened_at is null order by id offset idx limit 1;
  if pct > 0 then
    b := floor(e.amount * pct / 100.0 / 1000)::int * 1000;
    for rec in select id, amount from envelopes where room_code = p_code and opened_at is null and id <> e.id and amount > 1000 order by amount desc loop
      exit when granted >= b;
      tk := least(b - granted, rec.amount - 1000);
      update envelopes set amount = amount - tk where id = rec.id;
      granted := granted + tk;
    end loop;
  end if;
  update envelopes set guest_name = left(trim(p_name),40), answer = left(p_answer,500), bank_bin = p_bin, bank_account = p_acct,
    bonus = granted, amount = e.amount + granted, opened_at = now() where id = e.id;
  return jsonb_build_object('id',e.id,'amount',e.amount + granted,'bonus',granted,'roast',null::text,'correct',correct);
end $$;
