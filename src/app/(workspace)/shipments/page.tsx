import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/session";
import { Alert, Badge, Button, Input, PageHeader, Select, buttonClass, cx } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE, fmtShort, formatContainer, needsPod, type ShipmentStatus } from "@/lib/shipments";

export const metadata: Metadata = { title: "Shipments" };

const VIEWS = [
  { key: "active", label: "Active" },
  { key: "new", label: "New" },
  { key: "today", label: "Today" },
  { key: "in_progress", label: "In progress" },
  { key: "pod", label: "Needs POD" },
  { key: "exceptions", label: "Problems" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
] as const;
type View = (typeof VIEWS)[number]["key"];

type Row = {
  id: string; shipment_number: number; status: ShipmentStatus; customer_name: string; customer_reference: string | null;
  pickup_location: string; delivery_location: string; pickup_at: string | null; delivery_at: string | null;
  driver_user_id: string | null; exception_open: boolean; last_activity_at: string;
};

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const company = await requireCompany();
  if (company.kind !== "carrier") redirect("/dashboard");
  if (company.role === "driver") redirect("/driver");
  const sp = await searchParams;
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : "active") as View;
  const q = (sp.q ?? "").trim();
  const driver = sp.driver ?? "";
  const from = sp.from ?? "";
  const to = sp.to ?? "";

  const supabase = await createClient();
  const [{ data: countsRows }, { data: drivers }] = await Promise.all([
    supabase.rpc("shipment_board_counts", { p_company: company.company_id }),
    supabase.rpc("company_drivers", { p_company: company.company_id }),
  ]);
  const counts = (countsRows as Record<string, number>[] | null)?.[0] ?? {};

  let query = supabase
    .from("shipments")
    .select("id, shipment_number, status, customer_name, customer_reference, pickup_location, delivery_location, pickup_at, delivery_at, driver_user_id, exception_open, last_activity_at")
    .eq("carrier_company_id", company.company_id)
    .order("last_activity_at", { ascending: false })
    .limit(200);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (view === "active") query = query.not("status", "in", "(completed,canceled)");
  if (view === "new") query = query.in("status", ["new", "awaiting_release", "ready"]);
  if (view === "in_progress") query = query.in("status", ["dispatched", "picked_up"]);
  if (view === "pod") query = query.in("status", ["delivered", "empty_returned", "completed"]);
  if (view === "exceptions") query = query.eq("exception_open", true).not("status", "in", "(completed,canceled)");
  if (view === "completed") query = query.eq("status", "completed");
  if (view === "today") {
    query = query.not("status", "in", "(completed,canceled)")
      .or(`and(pickup_at.gte.${today.toISOString()},pickup_at.lt.${tomorrow.toISOString()}),and(delivery_at.gte.${today.toISOString()},delivery_at.lt.${tomorrow.toISOString()})`);
  }
  if (driver === "none") query = query.is("driver_user_id", null);
  else if (/^[0-9a-f-]{36}$/i.test(driver)) query = query.eq("driver_user_id", driver);
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("created_at", new Date(from + "T00:00:00").toISOString());
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { const t = new Date(to + "T00:00:00"); t.setDate(t.getDate() + 1); query = query.lt("created_at", t.toISOString()); }

  if (q) {
    const term = q.replace(/[^A-Za-z0-9 #.\-]/g, "").trim();
    const num = term.replace(/^#/, "");
    const container = term.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const { data: byContainer } = container.length >= 4
      ? await supabase.from("shipment_containers").select("shipment_id").ilike("container_number", `%${container}%`).limit(200)
      : { data: [] };
    const ids = (byContainer ?? []).map((c) => c.shipment_id);
    const ors = [
      `customer_name.ilike.%${term}%`, `customer_reference.ilike.%${term}%`, `booking_number.ilike.%${term}%`,
      `bol_number.ilike.%${term}%`, `pickup_location.ilike.%${term}%`, `delivery_location.ilike.%${term}%`,
    ];
    if (/^\d+$/.test(num)) ors.push(`shipment_number.eq.${num}`);
    if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
    query = query.or(ors.join(","));
  }

  const { data, error } = await query;
  let rows = (data ?? []) as Row[];
  const ids = rows.map((r) => r.id);
  const [{ data: containers }, { data: docs }] = ids.length
    ? await Promise.all([
        supabase.from("shipment_containers").select("shipment_id, container_number, position").in("shipment_id", ids).order("position"),
        supabase.from("shipment_documents").select("shipment_id, doc_type").in("shipment_id", ids).eq("upload_complete", true).is("superseded_at", null),
      ])
    : [{ data: [] }, { data: [] }];
  const hasPod = new Set((docs ?? []).filter((d) => d.doc_type === "pod").map((d) => d.shipment_id));
  const docCount = new Map<string, number>();
  (docs ?? []).forEach((d) => docCount.set(d.shipment_id, (docCount.get(d.shipment_id) ?? 0) + 1));
  if (view === "pod") rows = rows.filter((r) => !hasPod.has(r.id));
  const driverName = new Map<string, string>(((drivers ?? []) as { user_id: string; full_name: string; email: string }[]).map((d) => [d.user_id, d.full_name || d.email]));

  const countFor: Partial<Record<View, number>> = {
    new: counts.new_count, today: counts.today_count, in_progress: counts.in_progress_count,
    pod: counts.awaiting_pod_count, exceptions: counts.exception_count,
  };
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ view, q, driver, from, to, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/shipments?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Shipments"
        description="Every load and its paperwork. Open a shipment to work it from start to POD."
        actions={<Link href="/shipments/new" className={buttonClass()}>New shipment</Link>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile href={qs({ view: "new" })} label="Not yet dispatched" value={counts.new_count ?? 0} />
        <Tile href={qs({ view: "today" })} label="Pickups or deliveries today" value={counts.today_count ?? 0} />
        <Tile href={qs({ view: "in_progress" })} label="On the road" value={counts.in_progress_count ?? 0} />
        <Tile href={qs({ view: "pod" })} label="Delivered, no POD" value={counts.awaiting_pod_count ?? 0} attention={(counts.awaiting_pod_count ?? 0) > 0} />
        <Tile href={qs({ view: "exceptions" })} label="Open problems" value={counts.exception_count ?? 0} attention={(counts.exception_count ?? 0) > 0} />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-3 pt-2" role="tablist" aria-label="Shipment views">
          {VIEWS.map((v) => (
            <Link key={v.key} href={qs({ view: v.key })} role="tab" aria-selected={view === v.key}
              className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                view === v.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900")}>
              {v.label}
              {countFor[v.key] ? <span className="ml-1.5 rounded bg-slate-100 px-1.5 text-xs text-slate-600">{countFor[v.key]}</span> : null}
            </Link>
          ))}
        </div>

        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-4 py-3">
          <input type="hidden" name="view" value={view} />
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="q" className="text-xs font-medium text-slate-600">Search</label>
            <Input id="q" name="q" defaultValue={q} placeholder="Container, booking, B/L, customer, ref or #number" className="mt-1" />
          </div>
          <div>
            <label htmlFor="driver" className="text-xs font-medium text-slate-600">Driver</label>
            <Select id="driver" name="driver" defaultValue={driver} className="mt-1 w-44">
              <option value="">Any driver</option>
              <option value="none">Unassigned</option>
              {(drivers ?? []).map((d: { user_id: string; full_name: string; email: string }) => <option key={d.user_id} value={d.user_id}>{d.full_name || d.email}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor="from" className="text-xs font-medium text-slate-600">Created from</label>
            <Input id="from" name="from" type="date" defaultValue={from} className="mt-1 w-40" />
          </div>
          <div>
            <label htmlFor="to" className="text-xs font-medium text-slate-600">to</label>
            <Input id="to" name="to" type="date" defaultValue={to} className="mt-1 w-40" />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
          {(q || driver || from || to) && <Link href={`/shipments?view=${view}`} className={buttonClass("ghost")}>Clear</Link>}
        </form>

        {error && <div className="p-4"><Alert>Couldn&apos;t load shipments. Try again.</Alert></div>}

        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-medium text-slate-900">{q || driver || from || to ? "No shipments match" : view === "active" || view === "all" ? "No shipments yet" : "Nothing here right now"}</p>
            <p className="mt-1 text-sm text-slate-500">
              {q || driver || from || to ? "Try a different search or clear the filters." : view === "active" || view === "all" ? "Add your first load and its paperwork." : "Check another view, or add a new shipment."}
            </p>
            {(view === "active" || view === "all") && !q && <Link href="/shipments/new" className={buttonClass("primary", "mt-4")}>New shipment</Link>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5">Shipment</th>
                  <th scope="col" className="px-4 py-2.5">Customer</th>
                  <th scope="col" className="px-4 py-2.5">Route</th>
                  <th scope="col" className="px-4 py-2.5">Next appointment</th>
                  <th scope="col" className="px-4 py-2.5">Driver</th>
                  <th scope="col" className="px-4 py-2.5">Status</th>
                  <th scope="col" className="px-4 py-2.5">Paperwork</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const cs = (containers ?? []).filter((c) => c.shipment_id === r.id);
                  const missingPod = needsPod(r.status, hasPod.has(r.id));
                  const appt = ["new", "awaiting_release", "ready", "dispatched"].includes(r.status) ? r.pickup_at : r.status === "picked_up" ? r.delivery_at : null;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/shipments/${r.id}`} className="font-semibold text-brand-700 hover:underline">#{r.shipment_number}</Link>
                        <div className="font-mono text-xs text-slate-600">
                          {cs.length ? formatContainer(cs[0].container_number) : "No container yet"}
                          {cs.length > 1 && <span className="text-slate-400"> +{cs.length - 1}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900">{r.customer_name || <span className="text-slate-400">—</span>}</div>
                        {r.customer_reference && <div className="text-xs text-slate-500">Ref {r.customer_reference}</div>}
                      </td>
                      <td className="max-w-[16rem] px-4 py-3">
                        <div className="truncate text-slate-900">{r.pickup_location || "—"}</div>
                        <div className="truncate text-xs text-slate-500">to {r.delivery_location || "—"}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{appt ? fmtShortAppt(appt) : <span className="text-slate-400">—</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{r.driver_user_id ? driverName.get(r.driver_user_id) ?? "Driver" : <span className="text-slate-400">Unassigned</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                          {r.exception_open && <Badge tone="red">Problem</Badge>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {missingPod ? (
                          <span className="inline-flex items-center rounded-md bg-signal-50 px-2 py-0.5 text-xs font-medium text-signal-700 ring-1 ring-inset ring-signal-400/60">POD missing</span>
                        ) : hasPod.has(r.id) ? (
                          <span className="text-xs font-medium text-emerald-700">POD on file</span>
                        ) : (
                          <span className="text-xs text-slate-500">{docCount.get(r.id) ?? 0} doc{docCount.get(r.id) === 1 ? "" : "s"}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-500">{fmtShort(r.last_activity_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 200 && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Showing the 200 most recent. Search or filter to narrow it down.</p>}
          </div>
        )}
      </div>
    </>
  );
}

function fmtShortAppt(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Tile({ href, label, value, attention = false }: { href: string; label: string; value: number; attention?: boolean }) {
  return (
    <Link href={href} className={cx("rounded-lg border bg-white px-4 py-3 hover:border-slate-300", attention ? "border-signal-400/70" : "border-slate-200")}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cx("mt-1 text-2xl font-semibold tabular-nums", attention ? "text-signal-700" : "text-slate-900")}>{value}</div>
    </Link>
  );
}
