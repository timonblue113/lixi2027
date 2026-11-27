import { db } from "@/lib/db";
const ok = () => Response.json({ success: true });
export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Apikey ${process.env.SEPAY_API_KEY}`) return Response.json({ success: false }, { status: 401 });
  const b = await req.json();
  if (b.transferType !== "in") return ok();
  const m = String(b.content ?? "").toUpperCase().match(/LX([A-Z0-9]{8})/);
  if (!m || Number(b.transferAmount) < Number(process.env.PRO_PRICE || 19000)) return ok();
  const { data: p } = await db.from("profiles").select("user_id").eq("pay_code", m[1]).single();
  if (!p) return ok();
  const { error } = await db.from("payments").insert({ transaction_id: String(b.id), user_id: p.user_id, amount: b.transferAmount });
  if (!error) await db.from("profiles").update({ is_pro: true, pro_since: new Date().toISOString() }).eq("user_id", p.user_id);
  return ok();
}
