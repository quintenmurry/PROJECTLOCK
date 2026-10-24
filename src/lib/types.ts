export type CompanyKind = "carrier" | "forwarder";
export type CompanyStatus = "active" | "suspended";
export type MemberRole = "owner" | "admin" | "dispatcher" | "member" | "driver";
export type MembershipStatus = "active" | "disabled";

export interface MyCompany {
  company_id: string;
  name: string;
  kind: CompanyKind;
  company_status: CompanyStatus;
  role: MemberRole;
  membership_status: MembershipStatus;
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  dispatcher: "Dispatcher",
  member: "Forwarder user",
  driver: "Driver",
};

export const ROLE_HELP: Record<MemberRole, string> = {
  owner: "Full control of the company, team and billing.",
  admin: "Manages the company profile, team and all work.",
  dispatcher: "Accepts jobs, assigns drivers, updates milestones and documents.",
  member: "Creates and sends jobs, attaches documents, retrieves PODs.",
  driver: "Sees only jobs assigned to them, on a mobile-friendly view.",
};

export const ROLES_FOR_KIND: Record<CompanyKind, MemberRole[]> = {
  carrier: ["owner", "admin", "dispatcher", "driver"],
  forwarder: ["owner", "admin", "member"],
};

export const KIND_LABEL: Record<CompanyKind, string> = {
  carrier: "Carrier",
  forwarder: "Forwarder / broker",
};
