"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_COMPANY_COOKIE, getActiveCompany, getMyCompanies, requireUser } from "@/lib/session";
import { friendlyError, type ActionState } from "@/lib/errors";
import { env } from "@/lib/env";
import { inviteEmail, sendEmail } from "@/lib/email";
import { ROLE_LABEL, type MemberRole } from "@/lib/types";

const uuid = z.string().uuid();
const roleSchema = z.enum(["owner", "admin", "dispatcher", "member", "driver"]);

function back(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`);
}

async function setActiveCompanyCookie(companyId: string) {
  (await cookies()).set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

// ---------------------------------------------------------------- companies
export async function createCompany(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z
    .object({
      kind: z.enum(["carrier", "forwarder"], { message: "Choose whether you're a forwarder or a carrier." }),
      name: z.string().trim().min(2, "Enter your company name.").max(120),
      legalName: z.string().trim().max(200).optional(),
    })
    .safeParse({ kind: form.get("kind"), name: form.get("name"), legalName: form.get("legalName") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_company", {
    p_name: parsed.data.name,
    p_kind: parsed.data.kind,
    p_legal_name: parsed.data.legalName ?? null,
  });
  if (error) return { error: friendlyError(error) };
  await setActiveCompanyCookie(data as string);
  redirect("/dashboard");
}

export async function switchCompany(form: FormData) {
  const id = uuid.safeParse(form.get("companyId"));
  if (!id.success) return;
  const companies = await getMyCompanies();
  if (companies.some((c) => c.company_id === id.data && c.company_status === "active" && c.membership_status === "active")) {
    await setActiveCompanyCookie(id.data);
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function updateCompany(_: ActionState, form: FormData): Promise<ActionState> {
  const company = await getActiveCompany();
  if (!company) return { error: "No active company." };
  const parsed = z
    .object({ name: z.string().trim().min(2, "Enter a company name.").max(120), legalName: z.string().trim().max(200) })
    .safeParse({ name: form.get("name"), legalName: form.get("legalName") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_company", {
    p_company: company.company_id,
    p_name: parsed.data.name,
    p_legal_name: parsed.data.legalName,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Company details saved." };
}

// ---------------------------------------------------------------- team
export async function inviteMember(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const company = await getActiveCompany();
  if (!company) return { error: "No active company." };
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254), role: roleSchema })
    .safeParse({ email: form.get("email"), role: form.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, data: { email: String(form.get("email") ?? "") } };
  return createAndSendInvite(company.company_id, company.name, parsed.data.email, parsed.data.role, user);
}

async function createAndSendInvite(
  companyId: string,
  companyName: string,
  email: string,
  role: MemberRole,
  user: { id: string; email?: string; user_metadata?: { full_name?: string } },
): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", { p_company: companyId, p_email: email, p_role: role });
  if (error) return { error: friendlyError(error), data: { email } };
  const row = (data as { token: string }[])[0];

  const origin = await requestOrigin();
  const link = `${origin}/invite/${row.token}`;
  const inviterName = user.user_metadata?.full_name || user.email || "A teammate";
  const mail = await sendEmail({ to: email, ...inviteEmail({ companyName, inviterName, roleLabel: ROLE_LABEL[role], link }) });
  revalidatePath("/team");

  if (mail.delivered) return { ok: true, message: `Invitation emailed to ${email}.` };
  return {
    ok: true,
    message:
      mail.mode === "dev-console"
        ? `Invitation created for ${email}. Email sending isn't configured yet, so share this link with them directly (it's shown once):`
        : `Invitation created for ${email}, but the email failed to send (${mail.error}). Share this link with them directly (it's shown once):`,
    data: { link },
  };
}

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  // Prefer the configured site URL in production so links always point at the real domain.
  if (process.env.NODE_ENV === "production" || !host) return env.siteUrl;
  return `${proto}://${host}`;
}

export async function resendInvitation(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const company = await getActiveCompany();
  if (!company) return { error: "No active company." };
  const id = uuid.safeParse(form.get("invitationId"));
  if (!id.success) return { error: "Invalid invitation." };
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("company_invitations")
    .select("email, role, company_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!inv || inv.company_id !== company.company_id) return { error: "Invitation not found." };
  // Creating a new invitation revokes the old link, so only the newest link works.
  return createAndSendInvite(company.company_id, company.name, inv.email, inv.role as MemberRole, user);
}

export async function revokeInvitation(form: FormData) {
  const id = uuid.safeParse(form.get("invitationId"));
  if (!id.success) back("/team", { error: "Invalid invitation." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation: id.data });
  if (error) back("/team", { error: friendlyError(error) });
  revalidatePath("/team");
  back("/team", { notice: "Invitation revoked. The link no longer works." });
}

export async function changeMemberRole(form: FormData) {
  const parsed = z.object({ membershipId: uuid, role: roleSchema }).safeParse({
    membershipId: form.get("membershipId"),
    role: form.get("role"),
  });
  if (!parsed.success) back("/team", { error: "Invalid request." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { p_membership: parsed.data.membershipId, p_role: parsed.data.role });
  if (error) back("/team", { error: friendlyError(error) });
  revalidatePath("/team");
  back("/team", { notice: `Role changed to ${ROLE_LABEL[parsed.data.role]}.` });
}

export async function setMemberStatus(form: FormData) {
  const parsed = z.object({ membershipId: uuid, status: z.enum(["active", "disabled"]) }).safeParse({
    membershipId: form.get("membershipId"),
    status: form.get("status"),
  });
  if (!parsed.success) back("/team", { error: "Invalid request." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_status", { p_membership: parsed.data.membershipId, p_status: parsed.data.status });
  if (error) back("/team", { error: friendlyError(error) });
  revalidatePath("/team");
  back("/team", { notice: parsed.data.status === "disabled" ? "Access removed." : "Access restored." });
}

// ---------------------------------------------------------------- account
export async function updateProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z
    .object({ fullName: z.string().trim().min(2, "Enter your name.").max(120), phone: z.string().trim().max(40) })
    .safeParse({ fullName: form.get("fullName"), phone: form.get("phone") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq("id", user.id);
  if (error) return { error: friendlyError(error) };
  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

// ---------------------------------------------------------------- platform admin
export async function adminSetCompanyStatus(form: FormData) {
  const parsed = z.object({ companyId: uuid, status: z.enum(["active", "suspended"]) }).safeParse({
    companyId: form.get("companyId"),
    status: form.get("status"),
  });
  if (!parsed.success) back("/admin", { error: "Invalid request." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_company_status", {
    p_company: parsed.data.companyId,
    p_status: parsed.data.status,
  });
  if (error) back("/admin", { error: friendlyError(error) });
  revalidatePath("/admin");
  back("/admin", { notice: parsed.data.status === "suspended" ? "Company suspended." : "Company reactivated." });
}
