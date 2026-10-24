import { ROLE_LABEL, type MemberRole } from "@/lib/types";

const role = (r: unknown) => ROLE_LABEL[r as MemberRole] ?? String(r ?? "");

export function describeAudit(action: string, m: Record<string, unknown> = {}): string {
  switch (action) {
    case "company.created": return `created the company`;
    case "company.updated": return `updated company details`;
    case "company.suspended": return `suspended the company`;
    case "company.reactivated": return `reactivated the company`;
    case "invitation.created": return `invited ${m.email} as ${role(m.role)}`;
    case "invitation.revoked": return `revoked an invitation`;
    case "invitation.accepted": return `joined as ${role(m.role)}`;
    case "member.role_changed": return `changed a member's role from ${role(m.from)} to ${role(m.to)}`;
    case "member.disabled": return `removed a member's access`;
    case "member.reactivated": return `restored a member's access`;
    default: return action;
  }
}
