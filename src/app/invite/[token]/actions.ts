"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_COMPANY_COOKIE, requireUser } from "@/lib/session";
import { friendlyError, type ActionState } from "@/lib/errors";

export async function acceptInvitation(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const token = String(form.get("token") ?? "");
  if (!/^[a-f0-9]{64}$/.test(token)) return { error: "This invitation link isn't valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: friendlyError(error) };
  (await cookies()).set(ACTIVE_COMPANY_COOKIE, data as string, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}
