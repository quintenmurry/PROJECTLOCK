import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ShipmentForm } from "../shipment-form";
import { createShipment } from "../actions";

export const metadata: Metadata = { title: "New shipment" };

export default async function NewShipment() {
  const company = await requireCompany();
  if (company.kind !== "carrier" || company.role === "driver") redirect("/dashboard");
  const supabase = await createClient();
  const { data: drivers } = await supabase.rpc("company_drivers", { p_company: company.company_id });
  return (
    <>
      <PageHeader title="New shipment" description="Only what you know now. You can fill in the rest from the shipment page." />
      <div className="max-w-4xl">
        <ShipmentForm action={createShipment} drivers={drivers ?? []} cancelHref="/shipments" />
      </div>
    </>
  );
}
