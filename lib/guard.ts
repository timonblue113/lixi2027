import { createHash } from "crypto";
export const ipOf = (req: Request) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "0";
export const hash = (s: string) => createHash("sha256").update(s + (process.env.IP_SALT || "")).digest("hex").slice(0, 32);
export async function turnstileOk(token: string | undefined, ip: string) {
  if (!process.env.TURNSTILE_SECRET) return true; // bỏ qua khi chạy local
  if (!token) return false;
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST",
    body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: token, remoteip: ip }) });
  return !!(await r.json()).success;
}
