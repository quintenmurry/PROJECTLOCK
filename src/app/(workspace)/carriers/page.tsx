import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManage, requireCompany } from "@/lib/session";
import { Alert, Badge, Button, Input, PageHeader, Select, buttonClass } from "@/components/ui";
import { CAPABILITIES, CATEGORY_LABEL, QUALIFICATION_LABEL, US_STATES, type CapabilityCategory } from "@/lib/capabilities";
import { setCarrierRelationship } from "../carrier-actions";
import { RelationshipBadge } from "@/components/relationship-badge";

export const metadata: Metadata = { title: "Carriers" };

type Row = {
  company_id: string; name: string; description: string; operating_hours: string;
  qualification_status: keyof typeof QUALIFICATION_LABEL; updated_at: string;
  ports: string[]; terminals: string[]; areas: string[]; capabilities: string[];
  relationship_status: "pending" | "approved" | "suspended" | null;
  dispatch_email: string | null; dispatch_phone: string | null; total_count: number;
};

const PAGE = 25;

export default async function CarriersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const company = await requireCompany();
  if (company.kind !== "forwarder") redirect("/dashboard");
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? "";
  const caps = ([] as string[]).concat(sp.cap ?? []);
  const page = Math.max(1, Number(one("page")) || 1);
  const approvedOnly = one("approved") === "1";

  const supabase = await createClient();
  const [{ data: ports }, { data, error }] = await Promise.all([
    supabase.from("ports").select("id, name, state").order("name"),
    supabase.rpc("search_carriers", {
      p_forwarder: company.company_id,
      p_query: one("q") || null,
      p_port_id: one("port") ? Number(one("port")) : null,
      p_terminal: one("terminal") || null,
      p_state: one("state") || null,
      p_city: one("city") || null,
      p_capabilities: caps.length ? caps : null,
      p_approved_only: approvedOnly,
      p_limit: PAGE,
      p_offset: (page - 1) * PAGE,
    }),
  ]);
  const rows = (data ?? []) as Row[];
  const total = rows[0]?.total_count ?? 0;
  const manage = canManage(company);
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of ([] as string[]).concat(v ?? [])) if (k !== "notice" && k !== "error") p.append(k, x);
    for (const [k, v] of Object.entries(patch)) { p.delete(k); if (v) p.set(k, v); }
    return `/carriers?${p.toString()}`;
  };
  const returnTo = qs({});
  const filtered = Boolean(one("q") || one("port") || one("terminal") || one("state") || caps.length || approvedOnly);

  return (
    <>
      <PageHeader title="Carriers" description="Find drayage carriers by port, terminal, area and equipment. Your approved list is private to your company." />
      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <form method="get" className="space-y-4 self-start rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-6">
          <div>
            <label htmlFor="q" className="text-sm font-medium text-slate-800">Search</label>
            <Input id="q" name="q" defaultValue={one("q")} placeholder="Carrier name or keyword" className="mt-1.5" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="approved" value="1" defaultChecked={approvedOnly} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            Approved carriers only
          </label>
          <div>
            <label htmlFor="port" className="text-sm font-medium text-slate-800">Port or rail ramp</label>
            <Select id="port" name="port" defaultValue={one("port")} className="mt-1.5">
              <option value="">Any</option>
              {(ports ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor="terminal" className="text-sm font-medium text-slate-800">Terminal</label>
            <Input id="terminal" name="terminal" defaultValue={one("terminal")} placeholder="Terminal name" className="mt-1.5" />
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <div>
              <label htmlFor="city" className="text-sm font-medium text-slate-800">Delivery city</label>
              <Input id="city" name="city" defaultValue={one("city")} className="mt-1.5" />
            </div>
            <div>
              <label htmlFor="state" className="text-sm font-medium text-slate-800">State</label>
              <Select id="state" name="state" defaultValue={one("state")} className="mt-1.5 px-2">
                <option value="">Any</option>
                {US_STATES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
          </div>
          {(Object.keys(CAPABILITIES) as CapabilityCategory[]).map((cat) => (
            <details key={cat} open={CAPABILITIES[cat].some((v) => caps.includes(v))}>
              <summary className="cursor-pointer text-sm font-medium text-slate-800">{CATEGORY_LABEL[cat]}</summary>
              <div className="mt-2 space-y-1.5">
                {CAPABILITIES[cat].map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="cap" value={v} defaultChecked={caps.includes(v)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                    {v}
                  </label>
                ))}
              </div>
            </details>
          ))}
          <div className="flex gap-2 pt-1">
            <Button type="submit">Apply filters</Button>
            {filtered && <Link href="/carriers" className={buttonClass("ghost")}>Clear</Link>}
          </div>
        </form>

        <div className="min-w-0 space-y-4">
          {typeof sp.error === "string" && <Alert>{sp.error}</Alert>}
          {typeof sp.notice === "string" && <Alert tone="success">{sp.notice}</Alert>}
          {error && <Alert>Couldn&apos;t load carriers. Try again.</Alert>}
          <p className="text-sm text-slate-500">{total} carrier{total === 1 ? "" : "s"}{filtered ? " match your filters" : ""}</p>

          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <p className="font-medium text-slate-900">{filtered ? "No carriers match these filters" : "No carriers listed yet"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {filtered ? "Try removing a filter or searching a nearby city." : "Carriers appear here once they publish a profile. Invite the carriers you already use to join."}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.company_id} className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/carriers/${r.company_id}`} className="font-semibold text-slate-900 hover:text-brand-600 hover:underline">{r.name}</Link>
                        <RelationshipBadge status={r.relationship_status} />
                        {r.qualification_status === "verified" && <Badge tone="brand">Verified</Badge>}
                      </div>
                      {r.description && <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-slate-600">{r.description}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {!r.relationship_status && (
                        <form action={setCarrierRelationship}>
                          <input type="hidden" name="carrierId" value={r.company_id} />
                          <input type="hidden" name="status" value={manage ? "approved" : "pending"} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <Button type="submit" variant="secondary" className="min-h-8 px-2.5">{manage ? "Approve" : "Suggest for approval"}</Button>
                        </form>
                      )}
                      {r.relationship_status === "pending" && manage && (
                        <form action={setCarrierRelationship}>
                          <input type="hidden" name="carrierId" value={r.company_id} />
                          <input type="hidden" name="status" value="approved" />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <Button type="submit" className="min-h-8 px-2.5">Approve</Button>
                        </form>
                      )}
                      <Link href={`/carriers/${r.company_id}`} className={buttonClass("ghost", "min-h-8 px-2.5")}>View</Link>
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <Fact label="Ports" items={r.ports.map((p) => p.split(" · ")[1] ?? p)} />
                    <Fact label="Delivery areas" items={r.areas} />
                    <Fact label="Terminals" items={r.terminals} />
                    <Fact label="Handles" items={r.capabilities} />
                  </dl>
                  {r.relationship_status === "approved" && (r.dispatch_email || r.dispatch_phone) && (
                    <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                      Dispatch: {r.dispatch_email && <a className="text-brand-600 hover:underline" href={`mailto:${r.dispatch_email}`}>{r.dispatch_email}</a>}
                      {r.dispatch_email && r.dispatch_phone && ", "}
                      {r.dispatch_phone && <a className="text-brand-600 hover:underline" href={`tel:${r.dispatch_phone}`}>{r.dispatch_phone}</a>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {total > PAGE && (
            <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
              {page > 1 ? <Link className={buttonClass("secondary")} href={qs({ page: String(page - 1) })}>Previous</Link> : <span />}
              <span className="text-slate-500">Page {page} of {Math.ceil(total / PAGE)}</span>
              {page * PAGE < total ? <Link className={buttonClass("secondary")} href={qs({ page: String(page + 1) })}>Next</Link> : <span />}
            </nav>
          )}
        </div>
      </div>
    </>
  );
}

function Fact({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  const shown = items.slice(0, 4);
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="truncate text-slate-800">{shown.join(", ")}{items.length > shown.length && <span className="text-slate-500"> +{items.length - shown.length} more</span>}</dd>
    </div>
  );
}
