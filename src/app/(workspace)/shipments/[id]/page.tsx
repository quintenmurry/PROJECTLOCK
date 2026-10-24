import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/session";
import { Alert, Badge, Button, Card, CardHeader, buttonClass, cx } from "@/components/ui";
import { DocumentUploader } from "@/components/document-uploader";
import {
  DOC_LABEL, MOVE_LABEL, NEXT_ACTION, STATUS_FLOW, STATUS_LABEL, STATUS_TONE, fmtBytes, fmtDateTime, formatContainer, needsPod,
  type DocumentType, type ShipmentStatus,
} from "@/lib/shipments";
import { revokeShareLink, setDocumentShared, setShipmentStatus } from "../actions";
import { DispatchForm, ExceptionForm, NoteForm, ShareForm } from "./panels";

export const metadata: Metadata = { title: "Shipment" };

const ALL_DOC_TYPES: DocumentType[] = ["delivery_order", "bol", "gate_receipt", "eir", "pod", "damage_photo", "rate_confirmation", "invoice", "other"];

type Doc = {
  id: string; doc_type: DocumentType; file_name: string; mime_type: string; size_bytes: number; shared_with_customer: boolean;
  uploaded_by: string | null; uploaded_via: string; created_at: string; superseded_at: string | null; upload_complete: boolean;
};
type Event = { id: number; kind: string; body: string | null; to_status: ShipmentStatus | null; from_status: ShipmentStatus | null; internal: boolean; actor_id: string | null; source: string; occurred_at: string };
type Link_ = { id: string; kind: "customer" | "dispatch"; recipient_phone: string | null; document_ids: string[] | null; recipient_label: string; recipient_email: string | null; expires_at: string; revoked_at: string | null; open_count: number; last_opened_at: string | null; created_at: string };

export default async function ShipmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const company = await requireCompany();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (company.role === "driver") redirect(`/driver/${id}`);
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: s }, { data: containers }, { data: docsRaw }, { data: eventsRaw }, { data: linksRaw }, { data: drivers }] = await Promise.all([
    supabase.from("shipments").select("*").eq("id", id).maybeSingle(),
    supabase.from("shipment_containers").select("container_number, size_type, seal_number").eq("shipment_id", id).order("position"),
    supabase.from("shipment_documents").select("id, doc_type, file_name, mime_type, size_bytes, shared_with_customer, uploaded_by, uploaded_via, created_at, superseded_at, upload_complete").eq("shipment_id", id).eq("upload_complete", true).order("created_at", { ascending: false }),
    supabase.from("shipment_events").select("id, kind, body, to_status, from_status, internal, actor_id, source, occurred_at").eq("shipment_id", id).order("occurred_at", { ascending: false }).limit(200),
    supabase.from("shipment_share_links").select("id, kind, recipient_phone, document_ids, recipient_label, recipient_email, expires_at, revoked_at, open_count, last_opened_at, created_at").eq("shipment_id", id).order("created_at", { ascending: false }),
    supabase.rpc("company_drivers", { p_company: company.company_id }),
  ]);
  if (!s) notFound();

  const status = s.status as ShipmentStatus;
  const docs = (docsRaw ?? []) as Doc[];
  const current = docs.filter((d) => !d.superseded_at);
  const replaced = docs.filter((d) => d.superseded_at);
  const events = (eventsRaw ?? []) as Event[];
  const allLinks = (linksRaw ?? []) as Link_[];
  const links = allLinks.filter((l) => l.kind === "customer");
  const dispatches = allLinks.filter((l) => l.kind === "dispatch");
  const driverList = (drivers ?? []) as { user_id: string; full_name: string; email: string }[];
  const dispatchDocs = current.map((d) => ({
    id: d.id, label: DOC_LABEL[d.doc_type], file: d.file_name, preselect: d.doc_type === "delivery_order",
    private: d.doc_type === "rate_confirmation" || d.doc_type === "invoice",
  }));
  const hasPod = current.some((d) => d.doc_type === "pod");
  const missingPod = needsPod(status, hasPod);
  const next = NEXT_ACTION[status];

  const people = new Set([...events.map((e) => e.actor_id), ...docs.map((d) => d.uploaded_by)].filter(Boolean) as string[]);
  const { data: profiles } = people.size
    ? await supabase.from("profiles").select("id, full_name, email").in("id", [...people])
    : { data: [] };
  const who = (uid: string | null, source?: string) => {
    if (source === "share_link") return "Customer";
    const p = profiles?.find((x) => x.id === uid);
    return p?.full_name || p?.email || (uid ? "Teammate" : "Haulbook");
  };
  const driver = (drivers ?? []).find((d: { user_id: string }) => d.user_id === s.driver_user_id) as { full_name: string; email: string } | undefined;
  const flowIndex = STATUS_FLOW.indexOf(status);

  return (
    <>
      <Link href="/shipments" className="text-sm text-slate-600 hover:underline">All shipments</Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Shipment #{s.shipment_number}</h1>
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            {s.exception_open && <Badge tone="red">Problem</Badge>}
            {missingPod && <span className="inline-flex items-center rounded bg-signal-50 px-1.5 py-0.5 text-xs font-medium text-signal-700 ring-1 ring-inset ring-signal-400/60">POD missing</span>}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {s.customer_name || "No customer yet"}
            {s.customer_reference && <> · Ref {s.customer_reference}</>}
            {" · "}{MOVE_LABEL[s.move_type as keyof typeof MOVE_LABEL]}
          </p>
          {(containers ?? []).length > 0 && (
            <p className="mt-1 font-mono text-sm text-slate-800">{(containers ?? []).map((c) => formatContainer(c.container_number)).join(", ")}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {next && status !== "canceled" && (
            <form action={setShipmentStatus}>
              <input type="hidden" name="shipmentId" value={id} />
              <input type="hidden" name="status" value={next.to} />
              <Button type="submit">{next.label}</Button>
            </form>
          )}
          <form action={setShipmentStatus} className="flex items-center gap-1">
            <input type="hidden" name="shipmentId" value={id} />
            <label htmlFor="set-status" className="sr-only">Set status</label>
            <select id="set-status" name="status" defaultValue={status}
              className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100">
              {[...STATUS_FLOW, "canceled" as const].map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
            </select>
            <Button type="submit" variant="secondary">Set</Button>
          </form>
          <Link href={`/shipments/${id}/edit`} className={buttonClass("secondary")}>Edit</Link>
        </div>
      </div>

      {/* Progress */}
      {status !== "canceled" && (
        <ol className="mt-5 grid grid-cols-4 gap-1 sm:grid-cols-8" aria-label="Progress">
          {STATUS_FLOW.map((st, i) => (
            <li key={st} className="min-w-0">
              <div className={cx("h-1.5 rounded-full", i <= flowIndex ? "bg-brand-600" : "bg-slate-200")} />
              <div className={cx("mt-1 truncate text-[11px]", i === flowIndex ? "font-semibold text-brand-800" : "text-slate-500")}>{STATUS_LABEL[st]}</div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 space-y-4">
        {sp.error && <Alert>{sp.error}</Alert>}
        {missingPod && (
          <Alert tone="warning">This load is {STATUS_LABEL[status].toLowerCase()} but there&apos;s no POD on file. Upload it below or ask the driver to snap it from their phone.</Alert>
        )}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {/* Documents */}
          <Card>
            <div id="documents" className="scroll-mt-6" />
            <CardHeader title="Paperwork" description="Everything for this load in one place. Shared documents appear on customer links." />
            <div className="border-b border-slate-200 px-5 py-4">
              <DocumentUploader shipmentId={id} types={ALL_DOC_TYPES} defaultType={missingPod || status === "delivered" ? "pod" : (status === "new" ? "delivery_order" : "gate_receipt")} />
            </div>
            {current.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">No paperwork yet. Upload the delivery order to get started.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {current.map((d) => {
                  const priv = d.doc_type === "rate_confirmation" || d.doc_type === "invoice";
                  return (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">{DOC_LABEL[d.doc_type]}</span>
                          {priv ? <Badge>Private</Badge> : d.shared_with_customer ? <Badge tone="brand">Shared</Badge> : <Badge>Not shared</Badge>}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {d.file_name} · {fmtBytes(d.size_bytes)} · {who(d.uploaded_by)}{d.uploaded_via === "driver" ? " (driver)" : ""} · {fmtDateTime(d.created_at)}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1">
                        <a href={`/documents/${d.id}`} target="_blank" rel="noopener" className={buttonClass("ghost", "min-h-8 px-2 text-xs")}>View</a>
                        <a href={`/documents/${d.id}?download=1`} className={buttonClass("ghost", "min-h-8 px-2 text-xs")}>Download</a>
                        {!priv && (
                          <form action={setDocumentShared}>
                            <input type="hidden" name="documentId" value={d.id} />
                            <input type="hidden" name="shipmentId" value={id} />
                            <input type="hidden" name="shared" value={d.shared_with_customer ? "0" : "1"} />
                            <button type="submit" className="min-h-8 rounded-md px-2 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                              {d.shared_with_customer ? "Stop sharing" : "Share"}
                            </button>
                          </form>
                        )}
                        <DocumentUploader shipmentId={id} types={[d.doc_type]} defaultType={d.doc_type} replaces={d.id} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {replaced.length > 0 && (
              <details className="border-t border-slate-100 px-5 py-3 text-sm">
                <summary className="cursor-pointer text-slate-600">{replaced.length} replaced version{replaced.length === 1 ? "" : "s"}</summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  {replaced.map((d) => (
                    <li key={d.id}>
                      {DOC_LABEL[d.doc_type]}: <a className="text-brand-600 hover:underline" href={`/documents/${d.id}`} target="_blank" rel="noopener">{d.file_name}</a>, uploaded {fmtDateTime(d.created_at)}, replaced {fmtDateTime(d.superseded_at)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader title="Activity" description="Every status change, upload, note and customer view, with who and when." />
            <div className="border-b border-slate-200 px-5 py-4"><NoteForm shipmentId={id} /></div>
            <ol className="px-5 py-4">
              {events.map((e) => (
                <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                  <span aria-hidden className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    e.kind === "exception" ? "bg-red-500" : e.kind === "status" ? "bg-brand-600" : e.source === "share_link" ? "bg-emerald-500" : "bg-slate-300")} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-slate-900">
                      {e.source === "share_link" ? <span className="text-emerald-800">{e.body}</span> : <><span className="font-medium">{who(e.actor_id, e.source)}</span>{" "}{describe(e)}</>}
                      {e.source === "driver" && <span className="ml-1.5 text-xs text-slate-500">from the driver app</span>}
                    </p>
                    {e.kind === "note" && <p className="mt-0.5 whitespace-pre-line rounded-md bg-amber-50/60 px-2.5 py-1.5 text-slate-700">{e.body}</p>}
                    {(e.kind === "status" || e.kind === "exception") && e.body && <p className="mt-0.5 text-slate-600">{e.body}</p>}
                    <p className="mt-0.5 text-xs text-slate-500">{fmtDateTime(e.occurred_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Dispatch */}
          {!["completed", "canceled"].includes(status) && (
            <Card>
              <div id="dispatch" className="scroll-mt-6" />
              <CardHeader title={dispatches.length ? "Dispatch" : "Dispatch a trucker"} description="Email or text the load and the documents they need." />
              <div className="px-5 py-4">
                <DispatchForm shipmentId={id} drivers={driverList} docs={dispatchDocs} currentDriver={s.driver_user_id} />
              </div>
              {dispatches.length > 0 && (
                <ul className="divide-y divide-slate-100 border-t border-slate-200">
                  {dispatches.map((l) => {
                    const live = !l.revoked_at && new Date(l.expires_at) > new Date();
                    return (
                      <li key={l.id} className="px-5 py-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900">{l.recipient_label}</div>
                            <div className="truncate text-xs text-slate-500">{[l.recipient_email, l.recipient_phone].filter(Boolean).join(" · ") || "Link only"} · {(l.document_ids ?? []).length} document{(l.document_ids ?? []).length === 1 ? "" : "s"}</div>
                          </div>
                          {live ? <Badge tone={l.open_count ? "green" : "neutral"}>{l.open_count ? "Opened" : "Sent"}</Badge> : <Badge>{l.revoked_at ? "Turned off" : "Expired"}</Badge>}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Sent {fmtDateTime(l.created_at)}{l.last_opened_at && <> · last opened {fmtDateTime(l.last_opened_at)}</>}</div>
                        {live && (
                          <form action={revokeShareLink} className="mt-1.5">
                            <input type="hidden" name="linkId" value={l.id} />
                            <input type="hidden" name="shipmentId" value={id} />
                            <button type="submit" className="text-xs font-medium text-red-700 hover:underline">Turn off link</button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          {/* Problem */}
          <Card className={s.exception_open ? "border-red-200 bg-red-50/40" : undefined}>
            <CardHeader title={s.exception_open ? "Open problem" : "Problems"} />
            <div className="px-5 py-4">
              <ExceptionForm shipmentId={id} open={s.exception_open} note={s.exception_note} canResolve />
            </div>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader title="Details" action={<Link href={`/shipments/${id}/edit`} className="text-sm font-medium text-brand-600 hover:underline">Edit</Link>} />
            <dl className="space-y-3 px-5 py-4 text-sm">
              <Item label="Pickup" value={s.pickup_location} sub={fmtDateTime(s.pickup_at)} />
              <Item label="Delivery" value={s.delivery_location} sub={fmtDateTime(s.delivery_at)} />
              {(s.empty_return_location || s.empty_return_at) && <Item label="Empty return" value={s.empty_return_location} sub={fmtDateTime(s.empty_return_at)} />}
              {s.last_free_day && <Item label="Last free day" value={new Date(s.last_free_day + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} />}
              <Item label="Driver" value={driver ? driver.full_name || driver.email : null} sub={[s.truck_ref && `Truck ${s.truck_ref}`, s.chassis_ref && `Chassis ${s.chassis_ref}`].filter(Boolean).join(" · ") || null} />
              <Item label="Booking / B/L" value={[s.booking_number, s.bol_number].filter(Boolean).join(" · ") || null} />
              {(containers ?? []).length > 0 && (
                <div>
                  <dt className="text-xs font-medium text-slate-500">Containers</dt>
                  <dd className="mt-0.5 space-y-0.5">
                    {(containers ?? []).map((c) => (
                      <div key={c.container_number}><span className="font-mono">{formatContainer(c.container_number)}</span>{c.size_type && <span className="text-slate-500"> · {c.size_type}</span>}{c.seal_number && <span className="text-slate-500"> · Seal {c.seal_number}</span>}</div>
                    ))}
                  </dd>
                </div>
              )}
              {s.special_instructions && <Item label="Special instructions" value={<span className="whitespace-pre-line">{s.special_instructions}</span>} />}
              {s.internal_notes && (
                <div className="rounded-md bg-amber-50/70 p-3">
                  <dt className="text-xs font-medium text-amber-800">Internal notes (dispatch only)</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-slate-800">{s.internal_notes}</dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Sharing */}
          <Card>
            <div id="sharing" className="scroll-mt-6" />
            <CardHeader title="Share with your customer" description="They see status, containers and shared paperwork. Never rates, notes or private documents." />
            <div className="border-b border-slate-200 px-5 py-4">
              <ShareForm shipmentId={id} defaultLabel={s.customer_name} />
            </div>
            {links.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No links yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {links.map((l) => {
                  const live = !l.revoked_at && new Date(l.expires_at) > new Date();
                  return (
                    <li key={l.id} className="px-5 py-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">{l.recipient_label}</div>
                          {l.recipient_email && <div className="truncate text-xs text-slate-500">{l.recipient_email}</div>}
                        </div>
                        {live ? <Badge tone="green">Active</Badge> : <Badge>{l.revoked_at ? "Turned off" : "Expired"}</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {l.open_count ? `Opened ${l.open_count} time${l.open_count === 1 ? "" : "s"}, last ${fmtDateTime(l.last_opened_at)}` : "Not opened yet"}
                        {live && <> · Expires {new Date(l.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
                      </div>
                      {live && (
                        <form action={revokeShareLink} className="mt-1.5">
                          <input type="hidden" name="linkId" value={l.id} />
                          <input type="hidden" name="shipmentId" value={id} />
                          <button type="submit" className="text-xs font-medium text-red-700 hover:underline">Turn off link</button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function describe(e: Event) {
  switch (e.kind) {
    case "created": return "created the shipment";
    case "status": return <>marked it <strong className="font-semibold">{e.to_status ? STATUS_LABEL[e.to_status].toLowerCase() : "updated"}</strong></>;
    case "note": return "added a note";
    case "document": return (e.body ?? "uploaded a document").replace(/^(\w)/, (m) => m.toLowerCase());
    case "assignment": return (e.body ?? "changed the driver").replace(/^Assigned/, "assigned").replace(/^Driver unassigned/, "unassigned the driver");
    case "exception": return "reported a problem";
    case "exception_resolved": return "resolved the problem";
    case "shared": return (e.body ?? "shared the shipment").replace(/^Shared/, "shared it");
    case "link_revoked": return (e.body ?? "turned off a link").replace(/^Turned/, "turned");
    case "link_opened": return (e.body ?? "opened the shared link").replace(/^.* opened/, "opened");
    case "document_downloaded": return (e.body ?? "downloaded a document").replace(/^.* downloaded/, "downloaded");
    case "updated": return "updated the details";
    case "dispatch_sent": return (e.body ?? "sent the dispatch").replace(/^Dispatched to/, "sent the dispatch to");
    default: return e.kind;
  }
}

function Item({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value || <span className="text-slate-400">Not set</span>}</dd>
      {sub && <dd className="text-xs text-slate-500">{sub}</dd>}
    </div>
  );
}
