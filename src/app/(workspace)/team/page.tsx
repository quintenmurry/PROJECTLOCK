import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { canManage, requireCompany, requireUser } from "@/lib/session";
import { Alert, Badge, Button, Card, CardHeader, PageHeader, Select } from "@/components/ui";
import { ROLE_LABEL, ROLES_FOR_KIND, type MemberRole } from "@/lib/types";
import { changeMemberRole, revokeInvitation, setMemberStatus } from "../actions";
import { InviteForm } from "./invite-form";
import { ResendButton } from "./resend-button";

export const metadata: Metadata = { title: "Team" };

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const company = await requireCompany();
  const manage = canManage(company);
  const isOwner = company.role === "owner";
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("company_memberships")
    .select("id, user_id, role, status, created_at")
    .eq("company_id", company.company_id)
    .order("created_at");
  const ids = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids)
    : { data: [] };

  const { data: invites } = manage
    ? await supabase
        .from("company_invitations")
        .select("id, email, role, expires_at, created_at")
        .eq("company_id", company.company_id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  const roles = ROLES_FOR_KIND[company.kind];
  const assignable = roles.filter((r) => isOwner || r !== "owner");

  return (
    <>
      <PageHeader
        title="Team"
        description={manage ? "Invite people and control what they can do." : "People in your company."}
      />
      <div className="space-y-6">
        {sp.error && <Alert>{sp.error}</Alert>}
        {sp.notice && <Alert tone="success">{sp.notice}</Alert>}

        {manage && (
          <Card>
            <CardHeader title="Invite someone" description="They'll get a link that expires in 7 days." />
            <div className="px-5 py-4">
              <InviteForm roles={assignable} />
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title="Members" description={`${memberships?.filter((m) => m.status === "active").length ?? 0} active`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5">Name</th>
                  <th scope="col" className="px-5 py-2.5">Role</th>
                  <th scope="col" className="px-5 py-2.5">Status</th>
                  <th scope="col" className="px-5 py-2.5">Joined</th>
                  {manage && <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(memberships ?? []).map((m) => {
                  const p = profiles?.find((x) => x.id === m.user_id);
                  const self = m.user_id === user.id;
                  const canEdit = manage && !self && (isOwner || m.role !== "owner");
                  return (
                    <tr key={m.id} className={m.status === "disabled" ? "text-slate-400" : undefined}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{p?.full_name || "—"}{self && <span className="ml-1.5 text-xs font-normal text-slate-500">(you)</span>}</div>
                        <div className="text-slate-500">{p?.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        {canEdit && m.status === "active" ? (
                          <form action={changeMemberRole} className="flex items-center gap-2">
                            <input type="hidden" name="membershipId" value={m.id} />
                            <label className="sr-only" htmlFor={`role-${m.id}`}>Role for {p?.email}</label>
                            <Select id={`role-${m.id}`} name="role" defaultValue={m.role} className="w-40 py-1.5">
                              {assignable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                            </Select>
                            <Button variant="secondary" type="submit" className="min-h-8 px-2.5">Save</Button>
                          </form>
                        ) : (
                          ROLE_LABEL[m.role as MemberRole]
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {m.status === "active" ? <Badge tone="green">Active</Badge> : <Badge>Access removed</Badge>}
                      </td>
                      <td className="px-5 py-3 text-slate-500">{fmt(m.created_at)}</td>
                      {manage && (
                        <td className="px-5 py-3 text-right">
                          {canEdit && (
                            <form action={setMemberStatus}>
                              <input type="hidden" name="membershipId" value={m.id} />
                              <input type="hidden" name="status" value={m.status === "active" ? "disabled" : "active"} />
                              <Button variant={m.status === "active" ? "danger" : "secondary"} type="submit" className="min-h-8 px-2.5">
                                {m.status === "active" ? "Remove access" : "Restore access"}
                              </Button>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {manage && (
          <Card>
            <CardHeader title="Pending invitations" />
            {invites && invites.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {invites.map((i) => {
                  const expired = new Date(i.expires_at) < new Date();
                  return (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div>
                        <div className="font-medium text-slate-900">{i.email}</div>
                        <div className="text-slate-500">
                          {ROLE_LABEL[i.role as MemberRole]} · {expired ? <span className="text-amber-700">Expired {fmt(i.expires_at)}</span> : `Expires ${fmt(i.expires_at)}`}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <ResendButton invitationId={i.id} />
                        <form action={revokeInvitation}>
                          <input type="hidden" name="invitationId" value={i.id} />
                          <Button variant="ghost" type="submit" className="min-h-8 px-2.5">Revoke</Button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">No pending invitations.</p>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
