import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManage, requireCompany } from "@/lib/session";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { QUALIFICATION_LABEL } from "@/lib/capabilities";
import { ProfileForm } from "./profile-form";
import { CoverageForm, type Coverage } from "./coverage-form";

export const metadata: Metadata = { title: "Carrier profile" };

export default async function CarrierProfilePage() {
  const company = await requireCompany();
  if (company.kind !== "carrier") redirect("/dashboard");
  const supabase = await createClient();
  const id = company.company_id;

  const [{ data: profile }, { data: ports }, { data: myPorts }, { data: terminals }, { data: areas }, { data: caps }] =
    await Promise.all([
      supabase.from("carrier_profiles").select("*").eq("company_id", id).maybeSingle(),
      supabase.from("ports").select("id, code, name, city, state").order("name"),
      supabase.from("carrier_ports").select("port_id").eq("company_id", id),
      supabase.from("carrier_terminals").select("port_id, name").eq("company_id", id).order("name"),
      supabase.from("carrier_service_areas").select("city, state").eq("company_id", id).order("state"),
      supabase.from("carrier_capabilities").select("category, value").eq("company_id", id),
    ]);

  const manage = canManage(company);
  const coverage: Coverage = {
    ports: (myPorts ?? []).map((p) => p.port_id),
    terminals: terminals ?? [],
    areas: areas ?? [],
    capabilities: (caps ?? []) as Coverage["capabilities"],
  };
  const status = (profile?.qualification_status ?? "unverified") as keyof typeof QUALIFICATION_LABEL;
  const expires = profile?.insurance_expires_on ? new Date(profile.insurance_expires_on + "T00:00:00") : null;
  const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / 86_400_000) : null;

  return (
    <>
      <PageHeader
        title="Carrier profile"
        description="What forwarders see when they search for carriers. Contact details and insurance are shared only with forwarders that approve you."
        actions={
          <div className="flex items-center gap-2">
            {profile?.listed ? <Badge tone="green">Listed in directory</Badge> : <Badge>Not listed</Badge>}
            <Badge tone={status === "verified" ? "brand" : status === "in_review" ? "amber" : "neutral"}>{QUALIFICATION_LABEL[status]}</Badge>
          </div>
        }
      />
      <div className="space-y-6">
        {!manage && <Alert tone="info">Only owners and administrators can edit the carrier profile.</Alert>}
        {daysLeft !== null && daysLeft <= 30 && (
          <Alert tone={daysLeft < 0 ? "error" : "warning"}>
            {daysLeft < 0 ? "Your insurance expiration date has passed." : `Your insurance expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`} Update the date once you renew.
          </Alert>
        )}
        <Card>
          <CardHeader title="Company profile" description={profile ? `Last updated ${new Date(profile.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Not set up yet"} />
          <div className="px-5 py-5">
            <ProfileForm profile={profile} readOnly={!manage} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Coverage" description="Ports, terminals, service areas and what you can haul. Forwarders filter on these." />
          <div className="px-5 py-5">
            <CoverageForm ports={ports ?? []} initial={coverage} readOnly={!manage} />
          </div>
        </Card>
      </div>
    </>
  );
}
