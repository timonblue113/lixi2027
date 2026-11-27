import { db, userFrom, qrUrl } from "@/lib/db";
export async function GET(req: Request) {
  const u = await userFrom(req);
  if (!u) return Response.json({ error: "Cần đăng nhập Google" }, { status: 401 });
  await db.rpc("ensure_profile", { uid: u.id });
  const { data: p } = await db.from("profiles").select("*").eq("user_id", u.id).single();
  return Response.json({ is_pro: p.is_pro, free_left: Math.max(0, 3 - p.free_used), pay_code: p.pay_code, qr: qrUrl(p.pay_code), price: Number(process.env.PRO_PRICE || 19000) });
}
