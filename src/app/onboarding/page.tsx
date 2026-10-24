import type { Metadata } from "next";
import { getActiveCompany, getMyCompanies, requireUser } from "@/lib/session";
import { Alert, Logo } from "@/components/ui";
import { OnboardingForm } from "./onboarding-form";
import Link from "next/link";

export const metadata: Metadata = { title: "Set up your company" };

export default async function Onboarding() {
  const user = await requireUser();
  const [companies, active] = await Promise.all([getMyCompanies(), getActiveCompany()]);
  const blocked = companies.filter((c) => c.company_status !== "active" || c.membership_status !== "active");
  const firstName = ((user.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0];

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="flex items-center justify-between px-6 py-5 text-brand-900">
        <Logo />
        <form action="/auth/signout" method="post">
          <button className="text-sm text-slate-600 hover:underline" type="submit">Sign out</button>
        </form>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-16 pt-4 sm:pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">{firstName ? `Welcome, ${firstName}` : "Welcome"}</h1>
        <p className="mt-1 text-sm text-slate-500">Set up your company to start coordinating moves.</p>

        <div className="mt-6 space-y-4">
          {blocked.map((c) => (
            <Alert key={c.company_id} tone="warning">
              {c.company_status === "suspended"
                ? `${c.name} is suspended. Contact platform support to restore access.`
                : `Your access to ${c.name} was removed by a company administrator.`}
            </Alert>
          ))}
          {active && (
            <Alert tone="info">
              You already belong to {active.name}. <Link href="/dashboard" className="font-medium underline">Go to your workspace</Link>, or create another company below.
            </Alert>
          )}
          <Alert tone="info">
            Joining a company that already uses this platform? Ask one of its administrators to invite you, then open the link in that email.
          </Alert>
          <OnboardingForm />
        </div>
      </main>
    </div>
  );
}
