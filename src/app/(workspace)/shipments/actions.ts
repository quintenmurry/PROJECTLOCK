"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveCompany, requireUser } from "@/lib/session";
import { friendlyError, type ActionState } from "@/lib/errors";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";

const uuid = z.string().uuid();
const statusEnum = z.enum(["new", "awaiting_release", "ready", "dispatched", "picked_up", "delivered", "empty_returned", "completed", "canceled"]);
const docTypeEnum = z.enum(["delivery_order", "bol", "gate_receipt", "eir", "pod", "damage_photo", "rate_confirmation", "invoice", "other"]);

const iso = z.string().trim().refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Enter a valid date and time.");
const shipmentSchema = z.object({
  move_type: z.enum(["import", "export", "empty", "other"]),
  customer_name: z.string().trim().max(160),
  customer_reference: z.string().trim().max(80),
  booking_number: z.string().trim().max(60),
  bol_number: z.string().trim().max(60),
  pickup_location: z.string().trim().max(200),
  delivery_location: z.string().trim().max(300),
  empty_return_location: z.string().trim().max(200),
  pickup_at: iso,
  delivery_at: iso,
  empty_return_at: iso,
  last_free_day: z.string().trim().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid last free day."),
  special_instructions: z.string().trim().max(4000),
  internal_notes: z.string().trim().max(4000),
  driver_user_id: z.string().trim().refine((v) => v === "" || uuid.safeParse(v).success),
  truck_ref: z.string().trim().max(40),
  chassis_ref: z.string().trim().max(40),
});
const containersSchema = z
  .array(z.object({
    container_number: z.string().trim().max(20),
    size_type: z.string().trim().max(40),
    seal_number: z.string().trim().max(40),
  }))
  .max(50, "A shipment can have up to 50 containers.");

function parseShipmentForm(form: FormData) {
  let raw: { shipment: unknown; containers: unknown };
  try {
    raw = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    return { error: "Couldn't read the form. Reload and try again." } as const;
  }
  const s = shipmentSchema.safeParse(raw.shipment);
  if (!s.success) return { error: s.error.issues[0].message } as const;
  const c = containersSchema.safeParse(raw.containers);
  if (!c.success) return { error: c.error.issues[0].message } as const;
  const containers = c.data.filter((x) => x.container_number);
  for (const x of containers) {
    const n = x.container_number.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z]{4}\d{6,7}$/.test(n)) return { error: `"${x.container_number}" isn't a container number. Use 4 letters and 7 digits, like MSDU4820193.` } as const;
  }
  if (!s.data.customer_name && !s.data.pickup_location && containers.length === 0) {
    return { error: "Add at least a customer, a pickup location or a container number." } as const;
  }
  return { shipment: s.data, containers } as const;
}

export async function createShipment(_: ActionState, form: FormData): Promise<ActionState> {
  const company = await getActiveCompany();
  if (!company || company.kind !== "carrier") return { error: "Switch to a carrier company first." };
  const parsed = parseShipmentForm(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_shipment", {
    p_company: company.company_id, p: parsed.shipment, p_containers: parsed.containers,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/shipments");
  redirect(`/shipments/${data}`);
}

export async function updateShipment(_: ActionState, form: FormData): Promise<ActionState> {
  const id = uuid.safeParse(form.get("shipmentId"));
  if (!id.success) return { error: "Invalid shipment." };
  const parsed = parseShipmentForm(form);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_shipment", { p_shipment: id.data, p: parsed.shipment, p_containers: parsed.containers });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/shipments/${id.data}`);
  revalidatePath("/shipments");
  redirect(`/shipments/${id.data}`);
}

function backTo(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`);
}

function returnPath(form: FormData, id: string) {
  const r = String(form.get("returnTo") ?? "");
  return r.startsWith("/driver/") || r.startsWith("/shipments/") ? r : `/shipments/${id}`;
}

export async function setShipmentStatus(form: FormData) {
  const p = z.object({ id: uuid, status: statusEnum, note: z.string().trim().max(500) })
    .safeParse({ id: form.get("shipmentId"), status: form.get("status"), note: form.get("note") ?? "" });
  if (!p.success) backTo("/shipments", { error: "Invalid request." });
  const back = returnPath(form, p.data.id);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_shipment_status", { p_shipment: p.data.id, p_status: p.data.status, p_note: p.data.note || null });
  if (error) backTo(back, { error: friendlyError(error) });
  revalidatePath(back);
  revalidatePath("/shipments");
  redirect(back);
}

export async function addNote(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ id: uuid, body: z.string().trim().min(1, "Write a note first.").max(2000) })
    .safeParse({ id: form.get("shipmentId"), body: form.get("body") });
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_shipment_note", { p_shipment: p.data.id, p_body: p.data.body, p_internal: true });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/shipments/${p.data.id}`);
  revalidatePath(`/driver/${p.data.id}`);
  return { ok: true };
}

export async function setException(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ id: uuid, open: z.enum(["1", "0"]), note: z.string().trim().max(1000) })
    .safeParse({ id: form.get("shipmentId"), open: form.get("open"), note: form.get("note") ?? "" });
  if (!p.success) return { error: "Invalid request." };
  if (p.data.open === "1" && !p.data.note) return { error: "Describe the problem." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_shipment_exception", { p_shipment: p.data.id, p_open: p.data.open === "1", p_note: p.data.note || null });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/shipments/${p.data.id}`);
  revalidatePath(`/driver/${p.data.id}`);
  revalidatePath("/shipments");
  return { ok: true, message: p.data.open === "1" ? "Problem reported." : "Marked resolved." };
}

// ---------------------------------------------------------------- documents
export async function beginUpload(input: { shipmentId: string; docType: string; fileName: string; mime: string; size: number; replaces?: string | null }) {
  const p = z.object({
    shipmentId: uuid, docType: docTypeEnum, fileName: z.string().min(1).max(200), mime: z.string().max(100),
    size: z.number().int().positive().max(25 * 1024 * 1024, "Files can be up to 25 MB."), replaces: uuid.nullish(),
  }).safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("begin_document_upload", {
    p_shipment: p.data.shipmentId, p_doc_type: p.data.docType, p_file_name: p.data.fileName,
    p_mime: p.data.mime, p_size: p.data.size, p_replaces: p.data.replaces ?? null,
  });
  if (error) return { error: friendlyError(error) };
  const row = (data as { document_id: string; storage_path: string }[])[0];
  return { documentId: row.document_id, path: row.storage_path };
}

export async function finishUpload(documentId: string, shipmentId: string) {
  if (!uuid.safeParse(documentId).success) return { error: "Invalid document." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_document_upload", { p_document: documentId });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath(`/driver/${shipmentId}`);
  revalidatePath("/shipments");
  return { ok: true };
}

export async function setDocumentShared(form: FormData) {
  const p = z.object({ id: uuid, shipmentId: uuid, shared: z.enum(["1", "0"]) })
    .safeParse({ id: form.get("documentId"), shipmentId: form.get("shipmentId"), shared: form.get("shared") });
  if (!p.success) backTo("/shipments", { error: "Invalid request." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_document_shared", { p_document: p.data.id, p_shared: p.data.shared === "1" });
  if (error) backTo(`/shipments/${p.data.shipmentId}`, { error: friendlyError(error) });
  revalidatePath(`/shipments/${p.data.shipmentId}`);
  redirect(`/shipments/${p.data.shipmentId}#documents`);
}

// ---------------------------------------------------------------- share links
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (process.env.NODE_ENV === "production" || !host) return env.siteUrl;
  return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
}

export async function createShareLink(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const company = await getActiveCompany();
  const p = z.object({
    id: uuid,
    label: z.string().trim().min(1, "Who is this link for?").max(120),
    email: z.string().trim().toLowerCase().max(254).refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email or leave it blank."),
    days: z.coerce.number().int().min(1).max(365),
  }).safeParse({ id: form.get("shipmentId"), label: form.get("label"), email: form.get("email") ?? "", days: form.get("days") ?? 30 });
  if (!p.success) return { error: p.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_share_link", {
    p_shipment: p.data.id, p_label: p.data.label, p_email: p.data.email || null, p_days: p.data.days,
  });
  if (error) return { error: friendlyError(error) };
  const row = (data as { token: string }[])[0];
  const link = `${await siteOrigin()}/share/${row.token}`;
  revalidatePath(`/shipments/${p.data.id}`);

  let emailed = false;
  if (p.data.email) {
    const { data: s } = await supabase.from("shipments").select("shipment_number, customer_reference").eq("id", p.data.id).single();
    const from = company?.name ?? "Your carrier";
    const ref = s?.customer_reference ? ` (your ref ${s.customer_reference})` : "";
    const result = await sendEmail({
      to: p.data.email,
      subject: `${from} shared shipment #${s?.shipment_number ?? ""}${ref}`,
      text: `${from} shared a shipment with you on ${env.appName}.\n\nSee status and download documents, including the POD when it's ready:\n${link}\n\nThis link expires in ${p.data.days} days.`,
    });
    emailed = result.delivered;
    if (!emailed) console.info(`[share] link for ${p.data.email} created by ${user.email}`);
  }
  return {
    ok: true,
    message: emailed ? `Emailed to ${p.data.email}. You can also copy the link below. It's shown only once.` : "Link created. Copy it now; it's shown only once.",
    data: { link },
  };
}

export async function revokeShareLink(form: FormData) {
  const p = z.object({ id: uuid, shipmentId: uuid }).safeParse({ id: form.get("linkId"), shipmentId: form.get("shipmentId") });
  if (!p.success) backTo("/shipments", { error: "Invalid request." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_share_link", { p_link: p.data.id });
  if (error) backTo(`/shipments/${p.data.shipmentId}`, { error: friendlyError(error) });
  revalidatePath(`/shipments/${p.data.shipmentId}`);
  redirect(`/shipments/${p.data.shipmentId}#sharing`);
}

// ---------------------------------------------------------------- dispatch to a trucker
export async function sendDispatch(_: ActionState, form: FormData): Promise<ActionState> {
  const company = await getActiveCompany();
  const p = z.object({
    id: uuid,
    target: z.string(),
    name: z.string().trim().max(120),
    email: z.string().trim().toLowerCase().max(254).refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email or leave it blank."),
    phone: z.string().trim().max(40),
    message: z.string().trim().max(1000),
    days: z.coerce.number().int().min(1).max(90),
    docs: z.array(uuid).max(30),
  }).safeParse({
    id: form.get("shipmentId"), target: form.get("target") ?? "other", name: form.get("name") ?? "",
    email: form.get("email") ?? "", phone: form.get("phone") ?? "", message: form.get("message") ?? "",
    days: form.get("days") ?? 14, docs: form.getAll("doc").map(String),
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const driverId = p.data.target !== "other" && uuid.safeParse(p.data.target).success ? p.data.target : null;
  if (!driverId && !p.data.name) return { error: "Enter the trucker's name." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_dispatch", {
    p_shipment: p.data.id, p_driver: driverId, p_name: p.data.name, p_email: p.data.email || null,
    p_phone: p.data.phone || null, p_document_ids: p.data.docs, p_message: p.data.message || null, p_days: p.data.days,
  });
  if (error) return { error: friendlyError(error) };
  const token = (data as { token: string }[])[0].token;
  const link = `${await siteOrigin()}/share/${token}`;
  revalidatePath(`/shipments/${p.data.id}`);
  revalidatePath("/shipments");

  // Build a short summary for the email / text message.
  const [{ data: s }, { data: cs }] = await Promise.all([
    supabase.from("shipments").select("shipment_number, pickup_location, pickup_at, delivery_location, delivery_at").eq("id", p.data.id).single(),
    supabase.from("shipment_containers").select("container_number").eq("shipment_id", p.data.id).order("position"),
  ]);
  const when = (iso: string | null) => iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : "";
  const containers = (cs ?? []).map((c) => c.container_number).join(", ");
  const from = company?.name ?? "Dispatch";
  const summary = [
    containers && `Container: ${containers}`,
    s?.pickup_location && `Pickup: ${s.pickup_location}${s.pickup_at ? ` (${when(s.pickup_at)} CT)` : ""}`,
    s?.delivery_location && `Deliver to: ${s.delivery_location}${s.delivery_at ? ` (${when(s.delivery_at)} CT)` : ""}`,
  ].filter(Boolean).join("\n");

  let email = p.data.email;
  if (driverId && !email) {
    const { data: prof } = await supabase.from("profiles").select("email").eq("id", driverId).maybeSingle();
    email = prof?.email ?? "";
  }
  let emailed = false;
  if (email) {
    const res = await sendEmail({
      to: email,
      subject: `Dispatch from ${from}: load #${s?.shipment_number ?? ""}${containers ? ` · ${containers.split(", ")[0]}` : ""}`,
      text: [
        `${from} dispatched a load to you.`, "",
        summary, "",
        p.data.message && `Note from dispatch: ${p.data.message}\n`,
        `Load details and documents (DO and anything else dispatch attached):`,
        link, "",
        `This link works for ${p.data.days} days.`,
      ].filter((x) => x !== "").join("\n"),
    });
    emailed = res.delivered;
  }
  const sms = `sms:${p.data.phone ?? ""}?&body=${encodeURIComponent(`${from} dispatch, load #${s?.shipment_number ?? ""}. Details and DO: ${link}`)}`;
  return {
    ok: true,
    message: emailed
      ? `Dispatch emailed to ${email}. Copy the link below to text it too. It's shown only once.`
      : email
        ? "Dispatch created, but email sending isn't set up yet. Copy the link or text it to the trucker. It's shown only once."
        : "Dispatch created. Copy the link or text it to the trucker. It's shown only once.",
    data: { link, sms },
  };
}
