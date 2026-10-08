import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

// Server-set, HttpOnly cookie: phone browsers keep these far longer than
// script-written storage, so the login survives Safari wiping localStorage.
const NAME = "one-rt";
const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };

export const saveSessionCookie = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ refresh_token: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    setCookie(NAME, data.refresh_token, opts);
    return { ok: true };
  });

export const clearSessionCookie = createServerFn({ method: "POST" }).handler(async () => {
  setCookie(NAME, "", { ...opts, maxAge: 0 });
  return { ok: true };
});

export const restoreSessionFromCookie = createServerFn({ method: "POST" }).handler(async () => {
  const rt = getCookie(NAME);
  if (!rt) return null;
  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: process.env.SUPABASE_PUBLISHABLE_KEY! },
    body: JSON.stringify({ refresh_token: rt }),
  });
  if (!res.ok) return null;
  const s = (await res.json()) as { access_token: string; refresh_token: string };
  setCookie(NAME, s.refresh_token, opts);
  return { access_token: s.access_token, refresh_token: s.refresh_token };
});
