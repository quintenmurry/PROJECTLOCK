import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { canManage, requireCompany } from "@/lib/session";
import { Card, CardHeader, PageHeader, Badge } from "@/components/ui";
import { KIND_LABEL, ROLE_LABEL } from "@/lib/types";
import { describeAudit } from "@/lib/audit";

export const metadata: Metadata = { title: "Overview" };

export default async function Dashboard() {
  const company = await requireCompany();
  const supabase = await createClient();
  const manage = canManage(company);

  const [members, invites, activity] = await Promise.all([
    supabase.from("company_memberships").select("id", { count: "exact", head: true })
      .eq("company_id", company.company_id).eq("status", "active"),
    manage
      ? supabase.from("company_invitations").select("id", { count: "exact", head: true })
          .eq("company_id", company.company_id).is("accepted_at", null).is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
      : Promise.resolve({ count: null }),
    manage
      ? supabase.from("audit_events").select("id, action, metadata, created_at, actor_id")
          .eq("company_id", company.company_id).order("created_at", { ascending: false }).limit(8)
      : Promise.resolve({ data: null }),
  ]);

  const actorIds = [...new Set((activity.data ?? []).map((a) => a.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [] };
  const actorName = (id: string | null) => {
    const p = actors?.find((x) => x.id === id);
    return p?.full_name || p?.email || "System";
  };

  const next =
    company.kind === "forwarder"
      ? ["Create jobs and send them to carriers, including carriers without an account", "Attach delivery orders and collect PODs on each job", "Track acknowledgments, milestones and exceptions on one dashboard"]
      : ["Receive, accept and dispatch jobs from forwarders", "Keep every job's documents and messages in one place", "Collect gate receipts and PODs from drivers on their phones"];
  const start =
    company.kind === "forwarder"
      ? { href: "/carriers", title: "Build your approved carrier list", body: "Search carriers by port, terminal, delivery area and equipment, then approve the ones you work with." }
      : { href: "/profile", title: "Complete your carrier profile", body: "Add your ports, terminals, delivery areas and equipment, then list your company so forwarders can find you." };

  return (
    <>
      <PageHeader
        title={company.name}
        description={<span className="inline-flex items-center gap-2">{KIND_LABEL[company.kind]} <Badge tone="brand">{ROLE_LABEL[company.role]}</Badge></span>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active team members" value={members.count ?? 0} href="/team" />
        {manage && <Stat label="Pending invitations" value={invites.count ?? 0} href="/team" />}
        <Stat label="Your role" value={ROLE_LABEL[company.role]} />
      </div>

      <Link href={start.href} className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-brand-100 bg-brand-50 px-5 py-4 hover:border-brand-500">
        <div>
          <div className="font-semibold text-brand-900">{start.title}</div>
          <p className="mt-0.5 text-sm text-brand-900/80">{start.body}</p>
        </div>
        <span className="text-sm font-medium text-brand-700">Open</span>
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Recent activity" description={manage ? "Changes to your company and team." : undefined} />
          {manage ? (
            activity.data && activity.data.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {activity.data.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                    <span>
                      <span className="font-medium text-slate-900">{actorName(a.actor_id)}</span>{" "}
                      <span className="text-slate-600">{describeAudit(a.action, a.metadata as Record<string, unknown>)}</span>
                    </span>
                    <time className="shrink-0 text-xs text-slate-500" dateTime={a.created_at}>
                      {new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-sm text-slate-500">No activity yet.</p>
            )
          ) : (
            <p className="px-5 py-8 text-sm text-slate-500">Company activity is visible to owners and administrators.</p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Coming to this workspace" description="Being built in the next milestones." />
          <ul className="space-y-2.5 px-5 py-4 text-sm text-slate-600">
            {next.map((n) => (
              <li key={n} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />{n}</li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white px-5 py-4 hover:border-slate-300">{body}</Link>
  ) : (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">{body}</div>
  );
}
