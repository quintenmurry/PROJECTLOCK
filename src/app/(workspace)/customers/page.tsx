import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/session";
import { Card, CardHeader, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const company = await requireCompany();
  if (company.kind !== "carrier") redirect("/dashboard");
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_customers", { p_carrier: company.company_id });
  const rows = (data ?? []) as { forwarder_company_id: string; name: string; approved_at: string | null }[];

  return (
    <>
      <PageHeader title="Customers" description="Forwarders that have approved your company. They can see your dispatch contacts and insurance details." />
      <Card>
        <CardHeader title={`${rows.length} approving forwarder${rows.length === 1 ? "" : "s"}`} />
        {rows.length ? (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.forwarder_company_id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium text-slate-900">{r.name}</span>
                <span className="text-slate-500">
                  {r.approved_at ? `Approved ${new Date(r.approved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Approved"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-sm text-slate-500">
            <p>No forwarders have approved you yet.</p>
            <p className="mt-1">Complete your carrier profile and list it in the directory so forwarders can find you.</p>
          </div>
        )}
      </Card>
    </>
  );
}
