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
    case "carrier_profile.updated": return `updated the carrier profile`;
    case "carrier_coverage.updated": return `updated ports, areas and equipment`;
    case "carrier.approved": return `approved ${m.carrier ?? "a carrier"}`;
    case "carrier.pending": return `suggested ${m.carrier ?? "a carrier"} for approval`;
    case "carrier.suspended": return `suspended ${m.carrier ?? "a carrier"}`;
    case "carrier.removed": return `removed a carrier from the approved list`;
    case "carrier.qualification_verified": return `was verified by the platform`;
    case "carrier.qualification_in_review": return `was moved to review`;
    case "carrier.qualification_unverified": return `was marked unverified`;
    case "platform_admin.granted": return `platform administrator access granted`;
    default: return action;
  }
}
