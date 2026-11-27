import { db, userFrom } from "@/lib/db";
const ascii = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 20);
async function own(req: Request, code: string) {
  const u = await userFrom(req);
  if (!u) return null;
  const { data: r } = await db.from("rooms").select("code,total,n,host_id").eq("code", code.toUpperCase()).single();
  return r && r.host_id === u.id ? r : null;
}
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = await own(req, code);
  if (!r) return Response.json({ error: "Chỉ chủ phòng mới xem được" }, { status: 403 });
  const { data } = await db.from("envelopes").select("id,guest_name,amount,bonus,roast,bank_bin,bank_account,paid_at").eq("room_code", r.code).not("opened_at", "is", null).order("opened_at");
  const items = (data ?? []).map((e) => ({ ...e, qr: `https://img.vietqr.io/image/${e.bank_bin}-${e.bank_account}-compact2.png?amount=${e.amount}&addInfo=${encodeURIComponent("LIXI " + ascii(e.guest_name || ""))}` }));
  return Response.json({ total: r.total, n: r.n, items });
}
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = await own(req, code);
  if (!r) return Response.json({ error: "Chỉ chủ phòng mới làm được" }, { status: 403 });
  const { id } = await req.json();
  await db.from("envelopes").update({ paid_at: new Date().toISOString() }).eq("id", id).eq("room_code", r.code);
  return Response.json({ ok: true });
}
