import { Badge } from "@/components/ui";

export function RelationshipBadge({ status }: { status: "pending" | "approved" | "suspended" | null }) {
  if (status === "approved") return <Badge tone="green">Approved</Badge>;
  if (status === "pending") return <Badge tone="amber">Awaiting review</Badge>;
  if (status === "suspended") return <Badge tone="red">Suspended</Badge>;
  return null;
}
