import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/session";
import { Alert, Badge, Card } from "@/components/ui";
import { DocumentUploader } from "@/components/document-uploader";
import { DOC_LABEL, DRIVER_ACTIONS, DRIVER_DOC_TYPES, STATUS_LABEL, STATUS_TONE, fmtDateTime, formatContainer, type DocumentType, type ShipmentStatus } from "@/lib/shipments";
import { setShipmentStatus } from "../../shipments/actions";
import { ExceptionForm, NoteForm } from "../../shipments/[id]/panels";

export const metadata: Metadata = { title: "Load" };

type Load = {
  id: string; shipment_number: number; carrier_name: string; status: ShipmentStatus; booking_number: string | null; bol_number: string | null;
  pickup_location: string; delivery_location: string; empty_return_location: string | null; pickup_at: string | null;
  delivery_at: string | null; empty_return_at: string | null; special_instructions: string; truck_ref: string | null;
  chassis_ref: string | null; exception_open: boolean; exception_note: string | null;
};

const maps = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export default async function DriverLoad({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const company = await requireCompany();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("driver_shipment", { p_shipment: id });
  const l = (data as Load[] | null)?.[0];
  if (error || !l) notFound();
  const [{ data: containers }, { data: docs }] = await Promise.all([
    supabase.from("shipment_containers").select("container_number, size_type, seal_number").eq("shipment_id", id).order("position"),
    supabase.from("shipment_documents").select("id, doc_type, file_name, created_at").eq("shipment_id", id).eq("upload_complete", true).is("superseded_at", null).order("created_at", { ascending: false }),
  ]);
  const actions = DRIVER_ACTIONS.filter((a) => a.from.includes(l.status) && (a.to !== "empty_returned" || l.empty_return_location));
  const hasPod = (docs ?? []).some((d) => d.doc_type === "pod");
  const here = `/driver/${id}`;
  const dispatchView = company.role !== "driver";

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href={dispatchView ? `/shipments/${id}` : "/driver"} className="text-sm text-slate-600 hover:underline">{dispatchView ? "Back to shipment" : "My loads"}</Link>
      {sp.error && <Alert>{sp.error}</Alert>}

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Load #{l.shipment_number}{l.truck_ref && ` · Truck ${l.truck_ref}`}{l.chassis_ref && ` · Chassis ${l.chassis_ref}`}</p>
          <Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
        </div>
        <h1 className="mt-1 font-mono text-2xl font-semibold">{(containers ?? [])[0] ? formatContainer(containers![0].container_number) : `Load #${l.shipment_number}`}</h1>
        {(containers ?? []).length > 1 && <p className="font-mono text-sm text-slate-600">{containers!.slice(1).map((c) => formatContainer(c.container_number)).join(", ")}</p>}
      </div>

      {/* Big milestone buttons */}
      {actions.length > 0 && (
        <div className="grid gap-2">
          {actions.map((a, i) => (
            <form key={a.to} action={setShipmentStatus}>
              <input type="hidden" name="shipmentId" value={id} />
              <input type="hidden" name="status" value={a.to} />
              <input type="hidden" name="returnTo" value={here} />
              <button type="submit" className={`min-h-14 w-full rounded-lg text-base font-semibold ${i === 0 ? "bg-brand-900 text-white active:bg-brand-950" : "border border-slate-300 bg-white text-slate-900 active:bg-slate-50"}`}>
                {a.label}
              </button>
            </form>
          ))}
        </div>
      )}

      {/* Paperwork */}
      <Card className="p-4">
        <h2 className="font-semibold text-slate-900">Paperwork</h2>
        {!hasPod && (l.status === "delivered" || l.status === "empty_returned") && (
          <p className="mt-1 text-sm font-medium text-signal-700">Upload the signed POD.</p>
        )}
        <div className="mt-3">
          <DocumentUploader shipmentId={id} types={DRIVER_DOC_TYPES} defaultType={l.status === "delivered" || l.status === "picked_up" ? "pod" : "gate_receipt"} label="Take photo or choose file" large />
        </div>
        {(docs ?? []).length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {(docs ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <span><span className="font-medium">{DOC_LABEL[d.doc_type as DocumentType]}</span> <span className="text-xs text-slate-500">{fmtDateTime(d.created_at)}</span></span>
                <a href={`/documents/${d.id}`} target="_blank" rel="noopener" className="font-medium text-brand-600">View</a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Where and when */}
      <Card className="divide-y divide-slate-100">
        <Stop label="Pickup" place={l.pickup_location} at={l.pickup_at} />
        <Stop label="Delivery" place={l.delivery_location} at={l.delivery_at} />
        {l.empty_return_location && <Stop label="Empty return" place={l.empty_return_location} at={l.empty_return_at} />}
        {(l.booking_number || l.bol_number) && (
          <div className="p-4 text-sm"><span className="text-slate-500">Booking / B/L</span><p>{[l.booking_number, l.bol_number].filter(Boolean).join(" · ")}</p></div>
        )}
        {l.special_instructions && (
          <div className="bg-amber-50/60 p-4 text-sm"><p className="font-medium text-amber-900">Instructions</p><p className="mt-1 whitespace-pre-line text-slate-800">{l.special_instructions}</p></div>
        )}
      </Card>

      <Card className={`p-4 ${l.exception_open ? "border-red-200 bg-red-50/40" : ""}`}>
        <h2 className="mb-2 font-semibold text-slate-900">{l.exception_open ? "Problem reported" : "Running into trouble?"}</h2>
        <ExceptionForm shipmentId={id} open={l.exception_open} note={l.exception_note} canResolve={dispatchView} />
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 font-semibold text-slate-900">Note to dispatch</h2>
        <NoteForm shipmentId={id} placeholder="e.g. Gate line 40 minutes" />
      </Card>
    </div>
  );
}

function Stop({ label, place, at }: { label: string; place: string; at: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 p-4 text-sm">
      <div className="min-w-0">
        <p className="text-slate-500">{label}</p>
        <p className="font-medium text-slate-900">{place || "Not set"}</p>
        {at && <p className="text-slate-600">{fmtDateTime(at)}</p>}
      </div>
      {place && <a href={maps(place)} target="_blank" rel="noopener" className="shrink-0 rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-800">Map</a>}
    </div>
  );
}
