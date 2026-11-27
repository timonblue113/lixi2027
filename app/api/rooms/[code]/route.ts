import { db } from "@/lib/db";
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { data: r } = await db.from("rooms").select("code,n,mode,topics,custom,quiz_q,bonus_pct").eq("code", code.toUpperCase()).single();
  if (!r) return Response.json({ error: "Không thấy phòng. Kiểm tra lại mã nhé." }, { status: 404 });
  const { count } = await db.from("envelopes").select("id", { count: "exact", head: true }).eq("room_code", r.code).not("opened_at", "is", null);
  return Response.json({ ...r, opened: count ?? 0 });
}
