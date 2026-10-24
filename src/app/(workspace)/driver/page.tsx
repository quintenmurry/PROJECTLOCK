import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/session";
import { Badge } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE, fmtDateTime, formatContainer, type ShipmentStatus } from "@/lib/shipments";

export const metadata: Metadata = { title: "My loads" };

type Load = {
  id: string; shipment_number: number; carrier_name: string; status: ShipmentStatus; pickup_location: string;
  delivery_location: string; pickup_at: string | null; delivery_at: string | null; containers: string[]; exception_open: boolean;
};

export default async function DriverHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireCompany();
  const sp = await searchParams;
  const done = sp.show === "done";
  const supabase = await createClient();
  const { data } = await supabase.rpc("driver_shipments", { p_include_done: done });
  let loads = (data ?? []) as Load[];
  if (done) loads = loads.filter((l) => l.status === "completed" || l.status === "canceled").reverse();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold tracking-tight">{done ? "Finished loads" : "My loads"}</h1>
      <div className="mt-3 flex gap-2 text-sm">
        <Link href="/driver" className={`rounded-full px-3 py-1.5 ${!done ? "bg-brand-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>Active</Link>
        <Link href="/driver?show=done" className={`rounded-full px-3 py-1.5 ${done ? "bg-brand-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>Finished</Link>
      </div>
      {loads.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-medium text-slate-900">{done ? "No finished loads yet" : "No loads assigned right now"}</p>
          <p className="mt-1 text-sm text-slate-500">{done ? "Completed loads show up here." : "When dispatch assigns you a load it will show up here."}</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {loads.map((l) => (
            <li key={l.id}>
              <Link href={`/driver/${l.id}`} className="block rounded-lg border border-slate-200 bg-white p-4 active:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-base font-medium">{l.containers[0] ? formatContainer(l.containers[0]) : `Load #${l.shipment_number}`}</div>
                    {l.containers.length > 1 && <div className="text-xs text-slate-500">+{l.containers.length - 1} more container{l.containers.length > 2 ? "s" : ""}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                    {l.exception_open && <Badge tone="red">Problem</Badge>}
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <p><span className="text-slate-500">From</span> {l.pickup_location || "—"}{l.pickup_at && <span className="text-slate-500"> · {fmtDateTime(l.pickup_at)}</span>}</p>
                  <p><span className="text-slate-500">To</span> {l.delivery_location || "—"}{l.delivery_at && <span className="text-slate-500"> · {fmtDateTime(l.delivery_at)}</span>}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
