export type ShipmentStatus =
  | "new" | "awaiting_release" | "ready" | "dispatched" | "picked_up" | "delivered" | "empty_returned" | "completed" | "canceled";
export type MoveType = "import" | "export" | "empty" | "other";
export type DocumentType =
  | "delivery_order" | "bol" | "gate_receipt" | "eir" | "pod" | "damage_photo" | "rate_confirmation" | "invoice" | "other";

export const STATUS_FLOW: ShipmentStatus[] = ["new", "awaiting_release", "ready", "dispatched", "picked_up", "delivered", "empty_returned", "completed"];

export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  new: "New",
  awaiting_release: "Awaiting release",
  ready: "Ready for pickup",
  dispatched: "Dispatched",
  picked_up: "Picked up",
  delivered: "Delivered",
  empty_returned: "Empty returned",
  completed: "Completed",
  canceled: "Canceled",
};

export const STATUS_TONE: Record<ShipmentStatus, "neutral" | "brand" | "green" | "amber" | "red"> = {
  new: "neutral",
  awaiting_release: "amber",
  ready: "neutral",
  dispatched: "brand",
  picked_up: "brand",
  delivered: "green",
  empty_returned: "green",
  completed: "green",
  canceled: "red",
};

/** The button dispatch most likely wants next. */
export const NEXT_ACTION: Partial<Record<ShipmentStatus, { to: ShipmentStatus; label: string }>> = {
  new: { to: "ready", label: "Mark ready for pickup" },
  awaiting_release: { to: "ready", label: "Mark released" },
  ready: { to: "dispatched", label: "Mark dispatched" },
  dispatched: { to: "picked_up", label: "Mark picked up" },
  picked_up: { to: "delivered", label: "Mark delivered" },
  delivered: { to: "completed", label: "Complete shipment" },
  empty_returned: { to: "completed", label: "Complete shipment" },
};

export const DRIVER_ACTIONS: { to: ShipmentStatus; label: string; from: ShipmentStatus[] }[] = [
  { to: "picked_up", label: "Picked up", from: ["new", "awaiting_release", "ready", "dispatched"] },
  { to: "delivered", label: "Delivered", from: ["new", "awaiting_release", "ready", "dispatched", "picked_up"] },
  { to: "empty_returned", label: "Empty returned", from: ["delivered"] },
];

export const MOVE_LABEL: Record<MoveType, string> = { import: "Import", export: "Export", empty: "Empty move", other: "Other" };

export const DOC_LABEL: Record<DocumentType, string> = {
  delivery_order: "Delivery order",
  bol: "Bill of lading",
  gate_receipt: "Gate receipt",
  eir: "EIR",
  pod: "POD",
  damage_photo: "Damage photo",
  rate_confirmation: "Rate confirmation",
  invoice: "Invoice",
  other: "Other",
};

export const DRIVER_DOC_TYPES: DocumentType[] = ["pod", "gate_receipt", "eir", "damage_photo", "other"];
export const PRIVATE_DOC_TYPES: DocumentType[] = ["rate_confirmation", "invoice"];

export const ACCEPTED_FILES = "application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp";

export function needsPod(status: ShipmentStatus, hasPod: boolean) {
  return !hasPod && (status === "delivered" || status === "empty_returned" || status === "completed");
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fmtShort(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatContainer(n: string) {
  // MSDU4820193 -> MSDU 482019-3
  return /^[A-Z]{4}\d{7}$/.test(n) ? `${n.slice(0, 4)} ${n.slice(4, 10)}-${n.slice(10)}` : n;
}
