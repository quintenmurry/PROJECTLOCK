import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Logo } from "@/components/ui";
import { DOC_LABEL, MOVE_LABEL, STATUS_FLOW, STATUS_LABEL, fmtBytes, fmtDateTime, formatContainer, type DocumentType, type MoveType, type ShipmentStatus } from "@/lib/shipments";

export const metadata: Metadata = { title: "Shared shipment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Shared = {
  state: "ok" | "revoked" | "expired" | "unavailable";
  recipient?: string; expires_at?: string;
  carrier?: { name: string; phone: string | null; email: string | null };
  shipment?: {
    number: number; status: ShipmentStatus; move_type: MoveType; customer_reference: string | null; booking_number: string | null;
    bol_number: string | null; pickup_location: string; delivery_location: string; empty_return_location: string | null;
    pickup_at: string | null; delivery_at: string | null; empty_return_at: string | null; exception_open: boolean;
    exception_note: string | null; updated_at: string;
  };
  containers?: { number: string; size_type: string | null; seal: string | null }[];
  events?: { kind: string; to_status: ShipmentStatus | null; body: string | null; source: string; at: string }[];
  documents?: { id: string; type: DocumentType; name: string; mime: string; size: number; at: string }[];
};

export default async function SharedShipment({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = /^[a-f0-9]{64}$/.test(token) ? await supabase.rpc("get_shared_shipment", { p_token: token }) : { data: null };
  const d = data as Shared | null;
  const fileUrl = (doc: string, download = false) =>
    `${env.supabaseUrl}/functions/v1/shared-file?t=${token}&d=${doc}${download ? "&download=1" : ""}`;

  const shell = (body: React.ReactNode) => (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-brand-900"><Logo /></Link>
          <span className="text-xs text-slate-500">Shared shipment</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-8">{body}</main>
      <footer className="mx-auto max-w-4xl px-5 pb-10 text-xs text-slate-500">
        Shared through {env.appName}. <Link href="/" className="underline">Carriers: keep your loads and paperwork in one place</Link>.
      </footer>
    </div>
  );

  if (!d || d.state !== "ok" || !d.shipment) {
    const msg = !d ? "This link isn't valid." : d.state === "revoked" ? "The carrier turned off this link." : d.state === "expired" ? "This link has expired." : "This shipment isn't available right now.";
    return shell(
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">{msg}</h1>
        <p className="mt-2 text-sm text-slate-600">Ask the carrier to send you a new link.</p>
      </div>,
    );
  }

  const s = d.shipment;
  const pod = d.documents?.find((x) => x.type === "pod");
  const idx = STATUS_FLOW.indexOf(s.status);
  const steps: ShipmentStatus[] = ["dispatched", "picked_up", "delivered", ...(s.empty_return_location || s.status === "empty_returned" ? ["empty_returned" as const] : [])];

  return shell(
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Shared by {d.carrier?.name} with {d.recipient}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {(d.containers ?? []).length ? (d.containers ?? []).map((c) => formatContainer(c.number)).join(", ") : `Shipment #${s.number}`}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {MOVE_LABEL[s.move_type]} · Shipment #{s.number}
          {s.customer_reference && <> · Your ref {s.customer_reference}</>}
          {s.booking_number && <> · Booking {s.booking_number}</>}
          {s.bol_number && <> · B/L {s.bol_number}</>}
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Current status</p>
            <p className="text-xl font-semibold text-brand-900">{STATUS_LABEL[s.status]}</p>
          </div>
          <p className="text-xs text-slate-500">Updated {fmtDateTime(s.updated_at)}</p>
        </div>
        {s.status !== "canceled" && (
          <ol className="mt-5 grid gap-3 sm:grid-cols-4">
            {steps.map((st) => {
              const done = idx >= STATUS_FLOW.indexOf(st);
              const ev = d.events?.find((e) => e.kind === "status" && e.to_status === st);
              return (
                <li key={st} className={`rounded-md border px-3 py-2 ${done ? "border-brand-100 bg-brand-50" : "border-slate-200"}`}>
                  <p className={`text-sm font-medium ${done ? "text-brand-900" : "text-slate-400"}`}>{STATUS_LABEL[st]}</p>
                  <p className="text-xs text-slate-500">{ev ? fmtDateTime(ev.at) : done ? "Done" : "Pending"}</p>
                </li>
              );
            })}
          </ol>
        )}
        {s.exception_open && s.exception_note && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Carrier note: {s.exception_note}</p>
        )}
      </section>

      {pod && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div>
            <p className="font-semibold text-emerald-900">Proof of delivery is ready</p>
            <p className="text-sm text-emerald-800">{pod.name} · uploaded {fmtDateTime(pod.at)}</p>
          </div>
          <div className="flex gap-2">
            <a href={fileUrl(pod.id)} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center rounded-md border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">View</a>
            <a href={fileUrl(pod.id, true)} className="inline-flex min-h-10 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">Download POD</a>
          </div>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Route</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <Row label="Pickup" value={s.pickup_location} sub={fmtDateTime(s.pickup_at)} />
            <Row label="Delivery" value={s.delivery_location} sub={fmtDateTime(s.delivery_at)} />
            {s.empty_return_location && <Row label="Empty return" value={s.empty_return_location} sub={fmtDateTime(s.empty_return_at)} />}
          </dl>
          {(d.containers ?? []).length > 0 && (
            <>
              <h2 className="mt-5 text-sm font-semibold text-slate-900">Containers</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {(d.containers ?? []).map((c) => (
                  <li key={c.number}><span className="font-mono">{formatContainer(c.number)}</span>{c.size_type && <span className="text-slate-500"> · {c.size_type}</span>}{c.seal && <span className="text-slate-500"> · Seal {c.seal}</span>}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Documents</h2>
          {(d.documents ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No documents shared yet. They&apos;ll appear here as soon as the carrier uploads them.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {(d.documents ?? []).map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{DOC_LABEL[doc.type]}</div>
                    <div className="truncate text-xs text-slate-500">{doc.name} · {fmtBytes(doc.size)}</div>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <a href={fileUrl(doc.id)} target="_blank" rel="noopener" className="font-medium text-brand-600 hover:underline">View</a>
                    <a href={fileUrl(doc.id, true)} className="font-medium text-brand-600 hover:underline">Download</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(d.carrier?.phone || d.carrier?.email) && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
          <h2 className="font-semibold text-slate-900">Questions about this load?</h2>
          <p className="mt-1 text-slate-600">
            Contact {d.carrier?.name} dispatch
            {d.carrier?.phone && <> at <a className="font-medium text-brand-600 hover:underline" href={`tel:${d.carrier.phone}`}>{d.carrier.phone}</a></>}
            {d.carrier?.email && <> or <a className="font-medium text-brand-600 hover:underline" href={`mailto:${d.carrier.email}`}>{d.carrier.email}</a></>}.
          </p>
        </section>
      )}
      <p className="text-xs text-slate-500">This link expires {d.expires_at ? new Date(d.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "soon"}.</p>
    </div>,
  );
}

function Row({ label, value, sub }: { label: string; value: string | null; sub: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value || "—"}</dd>
      {sub && <dd className="text-xs text-slate-500">{sub}</dd>}
    </div>
  );
}
