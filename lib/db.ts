import { createClient } from "@supabase/supabase-js";
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) } });
export async function userFrom(req: Request) {
  const t = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!t) return null;
  const { data } = await db.auth.getUser(t);
  return data.user;
}
export function qrUrl(payCode: string) {
  return `https://img.vietqr.io/image/${process.env.BANK_BIN}-${process.env.BANK_ACC}-compact2.png?amount=${process.env.PRO_PRICE || 19000}&addInfo=LX${payCode}`;
}
