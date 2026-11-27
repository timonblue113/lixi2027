export const GET = () => Response.json({ url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY, ts: process.env.TURNSTILE_SITE_KEY || "" });
