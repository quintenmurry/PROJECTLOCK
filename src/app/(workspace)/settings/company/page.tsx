import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { canManage, requireCompany } from "@/lib/session";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { KIND_LABEL } from "@/lib/types";
import { CompanyForm } from "./company-form";

export const metadata: Metadata = { title: "Company" };

export default async function CompanySettings() {
  const company = await requireCompany();
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("name, legal_name, kind, created_at")
    .eq("id", company.company_id)
    .single();
  const manage = canManage(company);

  return (
    <>
      <PageHeader title="Company" description={manage ? "Details your partners see." : "Only owners and administrators can edit these details."} />
      <Card className="max-w-2xl">
        <CardHeader title="Company details" description={`${KIND_LABEL[company.kind]} · on the platform since ${new Date(data?.created_at ?? Date.now()).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`} />
        <div className="px-5 py-5">
          <CompanyForm name={data?.name ?? ""} legalName={data?.legal_name ?? ""} readOnly={!manage} />
        </div>
      </Card>
      <p className="mt-4 max-w-2xl text-sm text-slate-500">
        {company.kind === "carrier"
          ? "Service areas, ports, terminals, equipment and insurance will be added to your carrier profile in the next milestone."
          : "Approved carriers and job defaults will be managed here in the next milestones."}
      </p>
    </>
  );
}
