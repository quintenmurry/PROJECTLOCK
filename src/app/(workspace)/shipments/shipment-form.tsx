"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Alert, Button, Field, Input, Select, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/errors";

type Driver = { user_id: string; full_name: string; email: string };
type Container = { container_number: string; size_type: string; seal_number: string };
export type ShipmentFormValues = {
  move_type: string; customer_name: string; customer_reference: string; booking_number: string; bol_number: string;
  pickup_location: string; delivery_location: string; empty_return_location: string;
  pickup_at: string; delivery_at: string; empty_return_at: string; last_free_day: string;
  special_instructions: string; internal_notes: string; driver_user_id: string; truck_ref: string; chassis_ref: string;
};

const SIZES = ["20' standard", "40' standard", "40' high cube", "45' high cube", "20' reefer", "40' reefer", "Flat rack", "Open top", "ISO tank"];

/** ISO string -> value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

export function ShipmentForm({
  action, drivers, initial, containers: initialContainers, shipmentId, cancelHref,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  drivers: Driver[];
  initial?: Partial<ShipmentFormValues>;
  containers?: Container[];
  shipmentId?: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [v, setV] = useState<ShipmentFormValues>({
    move_type: "import", customer_name: "", customer_reference: "", booking_number: "", bol_number: "",
    pickup_location: "", delivery_location: "", empty_return_location: "", last_free_day: "",
    special_instructions: "", internal_notes: "", driver_user_id: "", truck_ref: "", chassis_ref: "",
    ...initial,
    pickup_at: toLocalInput(initial?.pickup_at ?? ""),
    delivery_at: toLocalInput(initial?.delivery_at ?? ""),
    empty_return_at: toLocalInput(initial?.empty_return_at ?? ""),
  });
  const [containers, setContainers] = useState<Container[]>(
    initialContainers?.length ? initialContainers : [{ container_number: "", size_type: "40' high cube", seal_number: "" }],
  );
  const set = (k: keyof ShipmentFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });

  const payload = JSON.stringify({
    shipment: { ...v, pickup_at: toIso(v.pickup_at), delivery_at: toIso(v.delivery_at), empty_return_at: toIso(v.empty_return_at) },
    containers,
  });
  const ta = "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />
      {shipmentId && <input type="hidden" name="shipmentId" value={shipmentId} />}
      {state.error && <Alert>{state.error}</Alert>}

      <Section title="Customer and references">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer" htmlFor="customer_name" hint="Who you're hauling for">
            <Input id="customer_name" value={v.customer_name} onChange={set("customer_name")} maxLength={160} placeholder="e.g. Harborline Forwarding" />
          </Field>
          <Field label="Customer reference" htmlFor="customer_reference">
            <Input id="customer_reference" value={v.customer_reference} onChange={set("customer_reference")} maxLength={80} />
          </Field>
          <Field label="Move type" htmlFor="move_type">
            <Select id="move_type" value={v.move_type} onChange={set("move_type")}>
              <option value="import">Import</option><option value="export">Export</option>
              <option value="empty">Empty move</option><option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Booking number" htmlFor="booking_number">
            <Input id="booking_number" value={v.booking_number} onChange={set("booking_number")} maxLength={60} className="uppercase" />
          </Field>
          <Field label="Bill of lading" htmlFor="bol_number">
            <Input id="bol_number" value={v.bol_number} onChange={set("bol_number")} maxLength={60} className="uppercase" />
          </Field>
          <Field label="Last free day" htmlFor="last_free_day">
            <Input id="last_free_day" type="date" value={v.last_free_day} onChange={set("last_free_day")} />
          </Field>
        </div>
      </Section>

      <Section title="Containers" description="One shipment can carry several containers from the same booking or B/L.">
        <div className="space-y-2">
          {containers.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[14rem_12rem_1fr_auto]">
              <Input aria-label={`Container ${i + 1} number`} placeholder="MSDU4820193" value={c.container_number} maxLength={20}
                className="font-mono uppercase"
                onChange={(e) => setContainers(containers.map((x, j) => (j === i ? { ...x, container_number: e.target.value } : x)))} />
              <Select aria-label={`Container ${i + 1} size`} value={c.size_type} className="order-3 sm:order-none"
                onChange={(e) => setContainers(containers.map((x, j) => (j === i ? { ...x, size_type: e.target.value } : x)))}>
                <option value="">Size / type</option>
                {SIZES.map((s) => <option key={s}>{s}</option>)}
              </Select>
              <Input aria-label={`Container ${i + 1} seal`} placeholder="Seal number" value={c.seal_number} maxLength={40} className="order-4 sm:order-none"
                onChange={(e) => setContainers(containers.map((x, j) => (j === i ? { ...x, seal_number: e.target.value } : x)))} />
              <Button type="button" variant="ghost" aria-label={`Remove container ${i + 1}`} disabled={containers.length === 1}
                onClick={() => setContainers(containers.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => setContainers([...containers, { container_number: "", size_type: containers.at(-1)?.size_type ?? "", seal_number: "" }])}>
            Add container
          </Button>
        </div>
      </Section>

      <Section title="Route and appointments">
        <div className="grid gap-4 lg:grid-cols-[1fr_15rem]">
          <Field label="Pickup" htmlFor="pickup_location" hint="Terminal, port or yard">
            <Input id="pickup_location" value={v.pickup_location} onChange={set("pickup_location")} maxLength={200} placeholder="e.g. Long Beach, Pier T" />
          </Field>
          <Field label="Pickup appointment" htmlFor="pickup_at"><Input id="pickup_at" type="datetime-local" value={v.pickup_at} onChange={set("pickup_at")} /></Field>
          <Field label="Delivery" htmlFor="delivery_location" hint="Name and address">
            <Input id="delivery_location" value={v.delivery_location} onChange={set("delivery_location")} maxLength={300} placeholder="e.g. Acme Warehouse, 1200 E Francis St, Ontario, CA 91761" />
          </Field>
          <Field label="Delivery appointment" htmlFor="delivery_at"><Input id="delivery_at" type="datetime-local" value={v.delivery_at} onChange={set("delivery_at")} /></Field>
          <Field label="Empty return" htmlFor="empty_return_location" hint="Leave blank if not applicable">
            <Input id="empty_return_location" value={v.empty_return_location} onChange={set("empty_return_location")} maxLength={200} />
          </Field>
          <Field label="Empty return appointment" htmlFor="empty_return_at"><Input id="empty_return_at" type="datetime-local" value={v.empty_return_at} onChange={set("empty_return_at")} /></Field>
        </div>
      </Section>

      <Section title="Driver and equipment">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Driver" htmlFor="driver_user_id" hint={drivers.length ? undefined : <>No drivers yet. <Link className="underline" href="/team">Invite one</Link>.</>}>
            <Select id="driver_user_id" value={v.driver_user_id} onChange={set("driver_user_id")}>
              <option value="">Not assigned</option>
              {drivers.map((d) => <option key={d.user_id} value={d.user_id}>{d.full_name || d.email}</option>)}
            </Select>
          </Field>
          <Field label="Truck" htmlFor="truck_ref"><Input id="truck_ref" value={v.truck_ref} onChange={set("truck_ref")} maxLength={40} /></Field>
          <Field label="Chassis" htmlFor="chassis_ref"><Input id="chassis_ref" value={v.chassis_ref} onChange={set("chassis_ref")} maxLength={40} /></Field>
        </div>
      </Section>

      <Section title="Instructions and notes">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Special instructions" htmlFor="special_instructions" hint="Your driver sees these.">
            <textarea id="special_instructions" rows={4} maxLength={4000} value={v.special_instructions} onChange={set("special_instructions")} className={ta} />
          </Field>
          <Field label="Internal notes" htmlFor="internal_notes" hint="Dispatch only. Drivers and customers never see these.">
            <textarea id="internal_notes" rows={4} maxLength={4000} value={v.internal_notes} onChange={set("internal_notes")} className={`${ta} border-amber-200 bg-amber-50/40`} />
          </Field>
        </div>
      </Section>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-5">
        <SubmitButton pendingText="Saving…">{shipmentId ? "Save changes" : "Create shipment"}</SubmitButton>
        <Link href={cancelHref} className={buttonClass("ghost")}>Cancel</Link>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-slate-200 bg-white p-5">
      <legend className="sr-only">{title}</legend>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}
