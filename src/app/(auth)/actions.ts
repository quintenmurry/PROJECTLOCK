"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/safe-redirect";
import type { ActionState } from "@/lib/errors";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use 72 characters or fewer.");

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password.") }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, data: { email: String(form.get("email") ?? "") } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const msg =
      error.code === "email_not_confirmed"
        ? "Confirm your email first. Check your inbox for the confirmation link."
        : error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "Incorrect email or password.";
    return { error: msg, data: { email: parsed.data.email } };
  }
  redirect(safeNext(String(form.get("next") ?? ""), "/dashboard"));
}

export async function signUp(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z
    .object({ fullName: z.string().trim().min(2, "Enter your name.").max(120), email, password })
    .safeParse({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password") });
  const data = { email: String(form.get("email") ?? ""), fullName: String(form.get("fullName") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, data };

  const next = safeNext(String(form.get("next") ?? ""), "/onboarding");
  const supabase = await createClient();
  const { data: result, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    const msg =
      error.code === "weak_password"
        ? "That password is too easy to guess. Try a longer one."
        : error.status === 429
          ? "Too many sign-up attempts. Wait a few minutes and try again."
          : error.message;
    return { error: msg, data };
  }
  // With email confirmation on, there is no session yet.
  if (result.session) redirect(next);
  redirect(`/check-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function requestPasswordReset(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password`,
  });
  if (error?.status === 429) return { error: "Too many requests. Wait a few minutes and try again." };
  // Same response whether or not the account exists, to avoid revealing who has an account.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "The passwords don't match.", path: ["confirm"] })
    .safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error: error.code === "same_password" ? "Choose a password you haven't used here before." : error.message,
    };
  }
  return { ok: true, message: "Password updated." };
}
