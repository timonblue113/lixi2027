import { db, userFrom, qrUrl } from "@/lib/db";
import { ipOf, hash, turnstileOk } from "@/lib/guard";
function split(total: number, n: number) {
  const a = Array(n).fill(1); let left = total / 1000 - n;
  while (left-- > 0) a[Math.floor(Math.random() * n)]++;
  return a.map((x: number) => x * 1000);
}
function code() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join(""); }
export const maxDuration = 30;
export async function POST(req: Request) {
  const u = await userFrom(req);
  if (!u) return Response.json({ error: "Cần đăng nhập Google" }, { status: 401 });
  const b = await req.json();
  const ip = ipOf(req), dev = (req.headers.get("x-device-id") || "").slice(0, 64);
  if (dev.length < 16) return Response.json({ error: "Thiếu mã thiết bị" }, { status: 400 });
  if (!(await turnstileOk(b.ts, ip))) return Response.json({ error: "Xác minh người thật thất bại, thử lại nhé" }, { status: 403 });
  const { data: okRate } = await db.rpc("rate_hit", { k: "mk:" + hash(dev), win: 3600, mx: 20 });
  if (okRate === false) return Response.json({ error: "Tạo phòng quá nhanh, đợi chút nhé" }, { status: 429 });
  const total = Number(b.total), n = Number(b.n), mode = "random";
  if (!Number.isInteger(total) || total % 1000 || n < 2 || n > 50 || total / 1000 < n)
    return Response.json({ error: "Tiền phải là bội số của 1.000đ, 2 đến 50 bao" }, { status: 400 });
  const qq = String(b.quiz_q ?? "").trim().slice(0, 120), qa = String(b.quiz_a ?? "").trim().slice(0, 60);
  const hasQuiz = !!(qq && qa), pct = [10, 20, 30, 50].includes(Number(b.bonus_pct)) ? Number(b.bonus_pct) : 20;
  const { data: slot, error: slotErr } = await db.rpc("consume_room_slot", { uid: u.id, need_pro: n > 10, p_dev: hash(dev) });
  if (slotErr || !slot) return Response.json({ error: "Lỗi hệ thống, chủ web hãy mở /api/health để kiểm tra" }, { status: 500 });
  if (slot.plan === "limit") return Response.json({ error: "Đã đạt 30 phòng/ngày" }, { status: 429 });
  if (slot.plan === "denied") return Response.json({ error: "Hết lượt free hoặc cần gói Pro", qr: qrUrl(slot.pay_code), pay_code: slot.pay_code }, { status: 402 });
  const c = code();
  const { error: re } = await db.from("rooms").insert({ code: c, host_id: u.id, total, n, mode, quiz_q: hasQuiz ? qq : null, quiz_a: hasQuiz ? qa : null, bonus_pct: hasQuiz ? pct : 0, topics: b.topics ?? [], custom: (b.custom ?? []).slice(0, slot.plan === "pro" ? 50 : 2) });
  const { error: ee } = re ? { error: null } : await db.from("envelopes").insert(split(total, n).map((amount: number) => ({ room_code: c, amount })));
  if (re || ee) {
    await db.from("rooms").delete().eq("code", c);
    if (slot.plan === "free") { // hoàn lại lượt free đã trừ
      const { data: p } = await db.from("profiles").select("free_used").eq("user_id", u.id).single();
      await db.from("profiles").update({ free_used: Math.max(0, (p?.free_used ?? 1) - 1) }).eq("user_id", u.id);
      const { data: l } = await db.from("free_log").select("id").eq("user_id", u.id).order("id", { ascending: false }).limit(1);
      if (l?.length) await db.from("free_log").delete().eq("id", l[0].id);
    }
    return Response.json({ error: "Không lưu được phòng vào cơ sở dữ liệu. Chủ web hãy mở /api/health (thường do sai SUPABASE_SERVICE_KEY hoặc chưa chạy SQL)." }, { status: 500 });
  }
  return Response.json({ code: c, plan: slot.plan });
}

export async function GET(req: Request) {
  const u = await userFrom(req);
  if (!u) return Response.json({ error: "Cần đăng nhập Google" }, { status: 401 });
  const { data } = await db.from("rooms").select("code,total,n,created_at").eq("host_id", u.id).order("created_at", { ascending: false }).limit(10);
  return Response.json(data ?? []);
}
