-- Chạy sau 03_bank.sql (chạy lại an toàn). Thêm câu hỏi thưởng và hàm mở bao 1 lệnh.
alter table rooms add column if not exists quiz_q text, add column if not exists quiz_a text, add column if not exists bonus_pct int default 0;
alter table envelopes add column if not exists bonus int default 0;
drop function if exists open_envelope(text,text,text,text,text,int,text);
drop function if exists open_envelope(text,text,text,text,text,text,int);
create or replace function open_envelope(p_code text, p_name text, p_answer text, p_bin text, p_acct text, p_roast text, p_bonus_pct int)
returns jsonb language plpgsql security definer as $$
declare e envelopes; n int; idx int; b int := 0; granted int := 0; rec record; tk int;
begin
  perform 1 from rooms where code = p_code for update; -- khóa phòng, mở lần lượt
  if not found then return jsonb_build_object('error','noroom'); end if;
  select * into e from envelopes where room_code = p_code and bank_account = p_acct and opened_at is not null limit 1;
  if found then return jsonb_build_object('amount',e.amount,'bonus',coalesce(e.bonus,0),'roast',e.roast,'again',true); end if;
  select count(*) into n from envelopes where room_code = p_code and opened_at is null;
  if n = 0 then return jsonb_build_object('error','empty'); end if;
  idx := floor(random()*n)::int; -- luôn ngẫu nhiên đều, câu trả lời không ảnh hưởng bao nhận được
  select * into e from envelopes where room_code = p_code and opened_at is null order by id offset idx limit 1;
  if p_bonus_pct > 0 then -- trả lời đúng: cộng % từ quỹ chung (trừ vào các bao chưa mở), tổng tiền không đổi
    b := floor(e.amount * p_bonus_pct / 100.0 / 1000)::int * 1000;
    for rec in select id, amount from envelopes where room_code = p_code and opened_at is null and id <> e.id and amount > 1000 order by amount desc loop
      exit when granted >= b;
      tk := least(b - granted, rec.amount - 1000);
      update envelopes set amount = amount - tk where id = rec.id;
      granted := granted + tk;
    end loop;
  end if;
  update envelopes set guest_name = left(p_name,40), answer = left(p_answer,500), roast = p_roast, bank_bin = p_bin,
    bank_account = p_acct, bonus = granted, amount = e.amount + granted, opened_at = now() where id = e.id;
  return jsonb_build_object('amount',e.amount + granted,'bonus',granted,'roast',p_roast);
end $$;
