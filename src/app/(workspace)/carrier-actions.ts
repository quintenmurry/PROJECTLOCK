"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompany, isPlatformAdmin } from "@/lib/session";
import { friendlyError, type ActionState } from "@/lib/errors";
import { CAPABILITIES, US_STATES } from "@/lib/capabilities";

const uuid = z.string().uuid();
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

// ---------------------------------------------------------------- carrier: profile
export async function saveCarrierProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const company = await getActiveCompany();
  if (!company || company.kind !== "carrier") return { error: "Switch to a carrier company first." };

  const parsed = z
    .object({
      description: z.string().trim().max(2000, "Keep the description under 2,000 characters."),
      website: opt(300).refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), "Website must start with http:// or https://"),
      operatingHours: z.string().trim().max(200),
      scac: opt(4).refine((v) => !v || /^[A-Za-z]{2,4}$/.test(v), "SCAC is 2–4 letters."),
      usdot: opt(10).refine((v) => !v || /^\d{1,10}$/.test(v), "USDOT number is digits only."),
      mc: opt(10).refine((v) => !v || /^\d{1,10}$/.test(v), "MC number is digits only (without the MC- prefix)."),
      dispatchEmail: opt(254).refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid dispatch email."),
      dispatchPhone: opt(40),
      insuranceProvider: opt(200),
      insuranceExpires: opt(10).refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date."),
      listed: z.boolean(),
    })
    .safeParse({
      description: form.get("description") ?? "",
      website: form.get("website") ?? "",
      operatingHours: form.get("operatingHours") ?? "",
      scac: form.get("scac") ?? "",
      usdot: form.get("usdot") ?? "",
      mc: form.get("mc") ?? "",
      dispatchEmail: form.get("dispatchEmail") ?? "",
      dispatchPhone: form.get("dispatchPhone") ?? "",
      insuranceProvider: form.get("insuranceProvider") ?? "",
      insuranceExpires: form.get("insuranceExpires") ?? "",
      listed: form.get("listed") === "on",
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_carrier_profile", {
    p_company: company.company_id,
    p_description: d.description,
    p_website: d.website,
    p_operating_hours: d.operatingHours,
    p_scac: d.scac,
    p_usdot: d.usdot,
    p_mc: d.mc,
    p_dispatch_email: d.dispatchEmail,
    p_dispatch_phone: d.dispatchPhone,
    p_insurance_provider: d.insuranceProvider,
    p_insurance_expires_on: d.insuranceExpires,
    p_listed: d.listed,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/profile");
  return { ok: true, message: d.listed ? "Profile saved. Forwarders can find you in the directory." : "Profile saved. You're hidden from the directory." };
}

const allCapabilities = new Set<string>([...CAPABILITIES.container, ...CAPABILITIES.equipment, ...CAPABILITIES.service]);

const coverageSchema = z.object({
  ports: z.array(z.number().int().positive()).max(40),
  terminals: z.array(z.object({ port_id: z.number().int().positive(), name: z.string().trim().min(2).max(120) })).max(100),
  areas: z.array(z.object({ city: z.string().trim().min(2).max(80), state: z.string().refine((s) => US_STATES.includes(s)) })).max(100),
  capabilities: z
    .array(z.object({ category: z.enum(["container", "equipment", "service"]), value: z.string() }))
    .max(60)
    .refine((caps) => caps.every((c) => allCapabilities.has(c.value)), "Unknown capability."),
});

export async function saveCarrierCoverage(_: ActionState, form: FormData): Promise<ActionState> {
  const company = await getActiveCompany();
  if (!company || company.kind !== "carrier") return { error: "Switch to a carrier company first." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("coverage") ?? "{}"));
  } catch {
    return { error: "Couldn't read the form. Reload the page and try again." };
  }
  const parsed = coverageSchema.safeParse(raw);
  if (!parsed.success) {
    const path = parsed.error.issues[0].path[0];
    const msg: Record<string, string> = {
      terminals: "Each terminal needs a port and a name (at least 2 characters).",
      areas: "Each service area needs a city and a state.",
      ports: "Too many ports selected.",
    };
    return { error: msg[String(path)] ?? parsed.error.issues[0].message };
  }
  const terminalPorts = new Set(parsed.data.terminals.map((t) => t.port_id));
  const ports = [...new Set([...parsed.data.ports, ...terminalPorts])];

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_carrier_coverage", {
    p_company: company.company_id,
    p_port_ids: ports,
    p_terminals: parsed.data.terminals,
    p_areas: parsed.data.areas,
    p_capabilities: parsed.data.capabilities,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/profile");
  return { ok: true, message: "Coverage saved." };
}

// ---------------------------------------------------------------- forwarder: approvals
function back(path: string, params: Record<string, string>): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams(params).toString()}`);
}

function safeReturn(v: FormDataEntryValue | null, fallback: string) {
  const s = String(v ?? "");
  return s.startsWith("/carriers") && !s.startsWith("//") ? s : fallback;
}

export async function setCarrierRelationship(form: FormData) {
  const company = await getActiveCompany();
  const returnTo = safeReturn(form.get("returnTo"), "/carriers");
  if (!company || company.kind !== "forwarder") back(returnTo, { error: "Switch to a forwarder company first." });
  const parsed = z
    .object({ carrierId: uuid, status: z.enum(["pending", "approved", "suspended", "remove"]) })
    .safeParse({ carrierId: form.get("carrierId"), status: form.get("status") });
  if (!parsed.success) back(returnTo, { error: "Invalid request." });

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_carrier_relationship", {
    p_forwarder: company.company_id,
    p_carrier: parsed.data.carrierId,
    p_status: parsed.data.status === "remove" ? null : parsed.data.status,
  });
  if (error) back(returnTo, { error: friendlyError(error) });
  revalidatePath("/carriers");
  const notice = {
    pending: "Added to your list for an administrator to review.",
    approved: "Carrier approved for your company.",
    suspended: "Carrier suspended. They stay on your list but won't be offered for new work.",
    remove: "Carrier removed from your list.",
  }[parsed.data.status];
  back(returnTo, { notice });
}

export async function saveCarrierNote(_: ActionState, form: FormData): Promise<ActionState> {
  const company = await getActiveCompany();
  if (!company || company.kind !== "forwarder") return { error: "Switch to a forwarder company first." };
  const parsed = z
    .object({ carrierId: uuid, note: z.string().trim().max(1000, "Keep notes under 1,000 characters.") })
    .safeParse({ carrierId: form.get("carrierId"), note: form.get("note") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_carrier_note", {
    p_forwarder: company.company_id,
    p_carrier: parsed.data.carrierId,
    p_note: parsed.data.note,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/carriers/${parsed.data.carrierId}`);
  return { ok: true, message: "Note saved." };
}

// ---------------------------------------------------------------- platform admin
export async function adminSetQualification(form: FormData) {
  if (!(await isPlatformAdmin())) back("/admin", { error: "Not allowed." });
  const parsed = z
    .object({ carrierId: uuid, status: z.enum(["unverified", "in_review", "verified"]) })
    .safeParse({ carrierId: form.get("carrierId"), status: form.get("status") });
  if (!parsed.success) back("/admin", { error: "Invalid request." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_qualification", { p_carrier: parsed.data.carrierId, p_status: parsed.data.status });
  if (error) back("/admin", { error: friendlyError(error) });
  revalidatePath("/admin");
  back("/admin", { notice: "Carrier status updated." });
}

export async function adminSetInquiryStatus(form: FormData) {
  const parsed = z
    .object({ id: uuid, status: z.enum(["new", "contacted", "closed"]) })
    .safeParse({ id: form.get("id"), status: form.get("status") });
  if (!parsed.success) back("/admin", { error: "Invalid request." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_inquiry_status", { p_inquiry: parsed.data.id, p_status: parsed.data.status });
  if (error) back("/admin", { error: friendlyError(error) });
  revalidatePath("/admin");
  back("/admin", { notice: "Inquiry updated." });
}
