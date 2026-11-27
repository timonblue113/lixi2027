import { db } from "@/lib/db";
import { roast } from "@/lib/ai";
import { hash } from "@/lib/guard";
export const maxDuration = 30;
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { id, acct, question } = await req.json();
  const a = String(acct ?? "").replace(/\D/g, "");
  const { data: e } = await db.from("envelopes").select("answer,bonus,roast").eq("id", String(id)).eq("room_code", code.toUpperCase()).eq("bank_account", a).single();
  if (!e) return Response.json({ error: "Không thấy bao" }, { status: 404 });
  if (e.roast) return Response.json({ roast: e.roast });
  const { data: ok } = await db.rpc("rate_hit", { k: "roast:" + hash(req.headers.get("x-device-id") || "none"), win: 3600, mx: 40 });
  if (ok === false) return Response.json({ roast: "Chúc mừng năm mới Đinh Mùi, lộc về đầy túi!" });
  const text = await roast(String(question ?? "").slice(0, 300), e.answer ?? "", "", (e.bonus ?? 0) > 0);
  await db.from("envelopes").update({ roast: text }).eq("id", String(id)).is("roast", null);
  return Response.json({ roast: text });
}
