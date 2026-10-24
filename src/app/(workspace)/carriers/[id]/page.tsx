import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManage, requireCompany } from "@/lib/session";
import { Alert, Badge, Button, Card, CardHeader } from "@/components/ui";
import { RelationshipBadge } from "@/components/relationship-badge";
import { QUALIFICATION_LABEL } from "@/lib/capabilities";
import { setCarrierRelationship } from "../../carrier-actions";
import { NoteForm } from "./note-form";

export const metadata: Metadata = { title: "Carrier" };

type Detail = {
  company_id: string; name: string; legal_name: string | null; description: string; website: string | null;
  operating_hours: string; scac: string | null; usdot_number: string | null; mc_number: string | null;
  qualification_status: keyof typeof QUALIFICATION_LABEL; updated_at: string;
  relationship_id: string | null; relationship_status: "pending" | "approved" | "suspended" | null;
  internal_note: string | null; approved_at: string | null; dispatch_email: string | null; dispatch_phone: string | null;
  insurance_provider: string | null; insurance_expires_on: string | null;
};

const fmt = (d: string) => new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function CarrierDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const company = await requireCompany();
  if (company.kind !== "forwarder") redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_carrier_for_forwarder", { p_forwarder: company.company_id, p_carrier: id });
  const c = (data as Detail[] | null)?.[0];
  if (!c) notFound();

  const [{ data: ports }, { data: terminals }, { data: areas }, { data: caps }] = await Promise.all([
    supabase.from("carrier_ports").select("ports(name, state)").eq("company_id", id),
    supabase.from("carrier_terminals").select("name, ports(name)").eq("company_id", id).order("name"),
    supabase.from("carrier_service_areas").select("city, state").eq("company_id", id).order("state"),
    supabase.from("carrier_capabilities").select("category, value").eq("company_id", id),
  ]);
  const manage = canManage(company);
  const here = `/carriers/${id}`;
  const insuranceDays = c.insurance_expires_on ? Math.ceil((new Date(c.insurance_expires_on + "T00:00:00").getTime() - Date.now()) / 86_400_000) : null;

  const RelButton = ({ status, label, variant = "secondary" }: { status: string; label: string; variant?: "primary" | "secondary" | "danger" | "ghost" }) => (
    <form action={setCarrierRelationship}>
      <input type="hidden" name="carrierId" value={c.company_id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="returnTo" value={here} />
      <Button type="submit" variant={variant}>{label}</Button>
    </form>
  );

  type PortJoin = { ports: { name: string; state: string } | null };
  type TermJoin = { name: string; ports: { name: string } | null };

  return (
    <>
      <Link href="/carriers" className="text-sm text-slate-600 hover:underline">Back to carriers</Link>
      <div className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{c.name}</h1>
            <RelationshipBadge status={c.relationship_status} />
            <Badge tone={c.qualification_status === "verified" ? "brand" : "neutral"}>{QUALIFICATION_LABEL[c.qualification_status]}</Badge>
          </div>
          {c.legal_name && <p className="mt-0.5 text-sm text-slate-500">{c.legal_name}</p>}
          <p className="mt-0.5 text-xs text-slate-500">Profile updated {fmt(c.updated_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!c.relationship_status && <RelButton status={manage ? "approved" : "pending"} label={manage ? "Approve carrier" : "Suggest for approval"} variant="primary" />}
          {c.relationship_status === "pending" && manage && <RelButton status="approved" label="Approve carrier" variant="primary" />}
          {c.relationship_status === "approved" && manage && <RelButton status="suspended" label="Suspend" variant="danger" />}
          {c.relationship_status === "suspended" && manage && <RelButton status="approved" label="Reinstate" variant="primary" />}
          {c.relationship_status && manage && <RelButton status="remove" label="Remove from list" variant="ghost" />}
        </div>
      </div>

      <div className="space-y-6">
        {sp.error && <Alert>{sp.error}</Alert>}
        {sp.notice && <Alert tone="success">{sp.notice}</Alert>}
        {c.relationship_status === "pending" && !manage && <Alert tone="info">Suggested for approval. An owner or administrator at your company can approve this carrier.</Alert>}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="About" />
            <div className="space-y-5 px-5 py-5 text-sm">
              <p className="whitespace-pre-line text-slate-700">{c.description || "This carrier hasn't added a description yet."}</p>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Item label="Operating hours" value={c.operating_hours} />
                <Item label="Website" value={c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{c.website.replace(/^https?:\/\//, "")}</a>} />
                <Item label="SCAC" value={c.scac} />
                <Item label="USDOT / MC" value={[c.usdot_number && `USDOT ${c.usdot_number}`, c.mc_number && `MC ${c.mc_number}`].filter(Boolean).join(" · ")} />
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader title="Dispatch and insurance" description={c.relationship_status === "approved" ? "Shared because you approved this carrier." : undefined} />
            <div className="px-5 py-5 text-sm">
              {c.relationship_status === "approved" ? (
                <dl className="space-y-4">
                  <Item label="Dispatch email" value={c.dispatch_email && <a className="text-brand-600 hover:underline" href={`mailto:${c.dispatch_email}`}>{c.dispatch_email}</a>} />
                  <Item label="Dispatch phone" value={c.dispatch_phone && <a className="text-brand-600 hover:underline" href={`tel:${c.dispatch_phone}`}>{c.dispatch_phone}</a>} />
                  <Item label="Insurance provider" value={c.insurance_provider} />
                  <Item label="Insurance expires" value={c.insurance_expires_on && (
                    <span className={insuranceDays !== null && insuranceDays <= 30 ? "font-medium text-amber-700" : undefined}>
                      {fmt(c.insurance_expires_on)}{insuranceDays !== null && insuranceDays < 0 ? " (expired)" : insuranceDays !== null && insuranceDays <= 30 ? ` (in ${insuranceDays} days)` : ""}
                    </span>
                  )} />
                </dl>
              ) : (
                <p className="text-slate-500">Contact details and insurance are visible once your company approves this carrier.</p>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Coverage" />
          <dl className="grid gap-6 px-5 py-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <List label="Ports" items={((ports ?? []) as unknown as PortJoin[]).map((p) => p.ports ? `${p.ports.name}` : "").filter(Boolean)} />
            <List label="Terminals" items={((terminals ?? []) as unknown as TermJoin[]).map((t) => `${t.name}${t.ports ? ` (${t.ports.name})` : ""}`)} />
            <List label="Delivery areas" items={(areas ?? []).map((a) => `${a.city}, ${a.state}`)} />
            <List label="Handles" items={(caps ?? []).map((x) => x.value)} />
          </dl>
        </Card>

        {c.relationship_status && (
          <Card>
            <CardHeader title="Internal note" description="Private to your company. The carrier never sees this." />
            <div className="px-5 py-5">
              <NoteForm carrierId={c.company_id} note={c.internal_note ?? ""} readOnly={!manage} />
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value || <span className="text-slate-400">Not provided</span>}</dd>
    </div>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1">
        {items.length ? <ul className="space-y-0.5 text-slate-800">{items.map((i) => <li key={i}>{i}</li>)}</ul> : <span className="text-slate-400">None listed</span>}
      </dd>
    </div>
  );
}
