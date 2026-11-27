import { db } from "@/lib/db";
import { ask } from "@/lib/ai";
function keyRole(k?: string) {
  if (!k) return "THIẾU";
  if (k.startsWith("sb_secret_")) return "service_role (đúng)";
  if (k.startsWith("sb_publishable_")) return "anon (SAI, cần khóa secret/service_role)";
  try { const r = JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).role; return r === "service_role" ? "service_role (đúng)" : r + " (SAI, cần service_role)"; } catch { return "không đọc được"; }
}
export const maxDuration = 30;
export async function GET(req: Request) {
  const out: Record<string, unknown> = {
    SUPABASE_URL: !!process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes("placeholder"),
    SUPABASE_SERVICE_KEY: keyRole(process.env.SUPABASE_SERVICE_KEY),
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL || "THIẾU",
    SEPAY_API_KEY: !!process.env.SEPAY_API_KEY,
    BANK_ACC: !!process.env.BANK_ACC,
  };
  const t0 = Date.now();
  for (const t of ["profiles", "rooms", "envelopes", "payments", "free_log", "rate_hits"]) {
    const { error } = await db.from(t).select("*", { head: true, count: "exact" }).limit(1);
    out["bang_" + t] = error ? "LỖI: " + error.message.slice(0, 80) : "ok";
  }
  out.db_ms_moi_lenh = Math.round((Date.now() - t0) / 6);
  const { error: e2 } = await db.rpc("rate_hit", { k: "health", win: 60, mx: 1000 });
  out.ham_rate_hit = e2 ? "LỖI: " + e2.message.slice(0, 80) : "ok";
  const { error: e3 } = await db.from("envelopes").select("bank_bin,bank_account,paid_at", { head: true }).limit(1);
  out.cot_ngan_hang = e3 ? "LỖI (chưa chạy 03_bank.sql?)" : "ok";
  const { data: oe, error: e4 } = await db.rpc("open_fast", { p_code: "HEALTH", p_name: "", p_answer: "", p_bin: "", p_acct: "", p_dev: "health" });
  out.ham_open_fast = !e4 && oe?.error === "noroom" ? "ok" : "LỖI (chưa chạy 05_fast_open.sql?)";
  if (new URL(req.url).searchParams.get("gemini")) {
    const g0 = Date.now();
    try {
      const t = await ask("Câu hỏi: Bao giờ có người yêu?\nTrả lời: chắc sang năm\nLĩnh vực: bạn bè", 8000);
      out.gemini = t ? `ok, ${Date.now() - g0}ms: ${t.slice(0, 80)}` : `LỖI: Gemini trả về rỗng (${Date.now() - g0}ms)`;
    } catch (e) { out.gemini = "LỖI: " + String((e as Error).message).slice(0, 80) + ` (${Date.now() - g0}ms)`; }
  }
  return Response.json(out);
}
