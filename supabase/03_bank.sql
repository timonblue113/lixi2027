-- Chạy sau 02_abuse.sql: lưu tài khoản nhận lì xì của người chơi
alter table envelopes add column if not exists bank_bin text, add column if not exists bank_account text, add column if not exists paid_at timestamptz;
