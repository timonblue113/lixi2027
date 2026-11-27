import { db } from "@/lib/db";
import { hash } from "@/lib/guard";
export const maxDuration = 30;
const ERR: Record<string, [string, number]> = {
  rate: ["Mở bao nhiều quá, đợi chút nhé", 429], busy: ["Hệ thống đang đông, thử lại sau ít phút", 429],
  noroom: ["Không thấy phòng", 404], short: ["Trả lời ít nhất 8 ký tự nhé", 400], empty: ["Hết bao rồi", 410],
};
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { name, answer, bank_bin, bank_account } = await req.json();
  if (!String(name ?? "").trim()) return Response.json({ error: "Nhập tên của bạn nhé" }, { status: 400 });
  const acct = String(bank_account ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(String(bank_bin ?? ""))) return Response.json({ error: "Bạn chưa chọn ngân hàng nhận lì xì" }, { status: 400 });
  if (acct.length < 6 || acct.length > 20) return Response.json({ error: "Số tài khoản hoặc số điện thoại chỉ gồm 6 đến 20 chữ số" }, { status: 400 });
  const { data, error } = await db.rpc("open_fast", { p_code: code.toUpperCase(), p_name: String(name).trim(), p_answer: String(answer ?? "").trim().slice(0, 500), p_bin: String(bank_bin), p_acct: acct, p_dev: hash(req.headers.get("x-device-id") || "none") });
  if (error || !data) return Response.json({ error: "Không mở được bao. Chủ web hãy mở /api/health (có thể chưa chạy 05_fast_open.sql)." }, { status: 500 });
  if (data.error) { const [m, s] = ERR[data.error] ?? ["Có lỗi, thử lại nhé", 500]; return Response.json({ error: m }, { status: s }); }
  return Response.json(data);
}
