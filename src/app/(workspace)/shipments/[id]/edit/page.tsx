import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ShipmentForm } from "../../shipment-form";
import { updateShipment } from "../../actions";

export const metadata: Metadata = { title: "Edit shipment" };

export default async function EditShipment({ params }: { params: Promise<{ id: string }> }) {
  const company = await requireCompany();
  if (company.kind !== "carrier" || company.role === "driver") redirect("/dashboard");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: s }, { data: containers }, { data: drivers }] = await Promise.all([
    supabase.from("shipments").select("*").eq("id", id).maybeSingle(),
    supabase.from("shipment_containers").select("container_number, size_type, seal_number").eq("shipment_id", id).order("position"),
    supabase.rpc("company_drivers", { p_company: company.company_id }),
  ]);
  if (!s) notFound();
  return (
    <>
      <PageHeader title={`Edit shipment #${s.shipment_number}`} />
      <div className="max-w-4xl">
        <ShipmentForm
          action={updateShipment}
          drivers={drivers ?? []}
          shipmentId={id}
          cancelHref={`/shipments/${id}`}
          containers={(containers ?? []).map((c) => ({ container_number: c.container_number, size_type: c.size_type ?? "", seal_number: c.seal_number ?? "" }))}
          initial={{
            move_type: s.move_type, customer_name: s.customer_name, customer_reference: s.customer_reference ?? "",
            booking_number: s.booking_number ?? "", bol_number: s.bol_number ?? "", pickup_location: s.pickup_location,
            delivery_location: s.delivery_location, empty_return_location: s.empty_return_location ?? "",
            pickup_at: s.pickup_at ?? "", delivery_at: s.delivery_at ?? "", empty_return_at: s.empty_return_at ?? "",
            last_free_day: s.last_free_day ?? "", special_instructions: s.special_instructions, internal_notes: s.internal_notes,
            driver_user_id: s.driver_user_id ?? "", truck_ref: s.truck_ref ?? "", chassis_ref: s.chassis_ref ?? "",
          }}
        />
      </div>
    </>
  );
}
