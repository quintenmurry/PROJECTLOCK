import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin, requireUser } from "@/lib/session";
import { Alert, Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { KIND_LABEL, type CompanyKind } from "@/lib/types";
import { describeAudit } from "@/lib/audit";
import { adminSetCompanyStatus } from "../actions";

export const metadata: Metadata = { title: "Administration" };

type Row = { id: string; name: string; kind: CompanyKind; status: "active" | "suspended"; created_at: string; active_members: number; pending_invitations: number };

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser();
  if (!(await isPlatformAdmin())) notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: companies, error }, { data: events }] = await Promise.all([
    supabase.rpc("admin_list_companies"),
    supabase.from("audit_events").select("id, action, metadata, created_at, company_id").order("created_at", { ascending: false }).limit(25),
  ]);
  const rows = (companies ?? []) as Row[];
  const nameOf = (id: string | null) => rows.find((r) => r.id === id)?.name ?? "—";

  return (
    <>
      <PageHeader title="Platform administration" description="Company accounts and platform activity. Job contents, documents and messages are not shown here." />
      <div className="space-y-6">
        {sp.error && <Alert>{sp.error}</Alert>}
        {sp.notice && <Alert tone="success">{sp.notice}</Alert>}
        {error && <Alert>Couldn&apos;t load companies.</Alert>}

        <div className="grid gap-4 sm:grid-cols-4">
          <Tile label="Companies" value={rows.length} />
          <Tile label="Forwarders" value={rows.filter((r) => r.kind === "forwarder").length} />
          <Tile label="Carriers" value={rows.filter((r) => r.kind === "carrier").length} />
          <Tile label="Suspended" value={rows.filter((r) => r.status === "suspended").length} />
        </div>

        <Card>
          <CardHeader title="Companies" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5">Company</th>
                  <th scope="col" className="px-5 py-2.5">Type</th>
                  <th scope="col" className="px-5 py-2.5 text-right">Members</th>
                  <th scope="col" className="px-5 py-2.5 text-right">Pending invites</th>
                  <th scope="col" className="px-5 py-2.5">Created</th>
                  <th scope="col" className="px-5 py-2.5">Status</th>
                  <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-5 py-3 text-slate-600">{KIND_LABEL[c.kind]}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.active_members}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.pending_invitations}</td>
                    <td className="px-5 py-3 text-slate-500">{new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-5 py-3">{c.status === "active" ? <Badge tone="green">Active</Badge> : <Badge tone="red">Suspended</Badge>}</td>
                    <td className="px-5 py-3 text-right">
                      <form action={adminSetCompanyStatus}>
                        <input type="hidden" name="companyId" value={c.id} />
                        <input type="hidden" name="status" value={c.status === "active" ? "suspended" : "active"} />
                        <Button type="submit" variant={c.status === "active" ? "danger" : "secondary"} className="min-h-8 px-2.5">
                          {c.status === "active" ? "Suspend" : "Reactivate"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">No companies yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent platform activity" />
          {events && events.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {events.map((e) => (
                <li key={e.id} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
                  <span><span className="font-medium text-slate-900">{nameOf(e.company_id)}</span> <span className="text-slate-600">— {describeAudit(e.action, e.metadata as Record<string, unknown>)}</span></span>
                  <time className="shrink-0 text-xs text-slate-500">{new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-500">No activity yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
