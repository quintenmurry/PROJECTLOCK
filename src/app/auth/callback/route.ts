import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

/** Completes email confirmation, password recovery and other PKCE redirects from Supabase. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"), "/dashboard");
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, url.origin));

  const authError = url.searchParams.get("error_description");
  if (authError) return fail(authError);
  if (!code) return fail("That link is invalid or has expired.");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return fail("That link has expired or was opened in a different browser. Sign in, or request a new link.");
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
