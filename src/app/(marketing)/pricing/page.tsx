import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "../page-hero";

export const metadata: Metadata = { title: "Pricing" };

const btn = "inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold";

type Plan = { name: string; price: string; priceNote: string; body: string; features: string[]; cta: { href: string; label: string }; featured?: boolean };

const carrierPlans: Plan[] = [
  {
    name: "Starter",
    price: "Free",
    priceNote: "for carriers getting started",
    body: "Receive and manage jobs from the forwarders you work with.",
    features: ["Accept, decline and update jobs", "Carrier profile and directory listing", "Job documents and messaging", "Mobile view for drivers"],
    cta: { href: "/signup", label: "Create a free account" },
  },
  {
    name: "Professional",
    price: "Custom",
    priceNote: "monthly, based on team size",
    body: "For carriers running most of their port work through the platform.",
    features: ["Everything in Starter", "Searchable history of every completed job", "Longer document storage", "More dispatchers and drivers", "CSV exports and reporting"],
    cta: { href: "/contact?plan=Carrier%20Professional", label: "Talk to a specialist" },
    featured: true,
  },
  {
    name: "Fleet",
    price: "Custom",
    priceNote: "for larger operations",
    body: "For multi-terminal fleets that want automation and deeper reporting.",
    features: ["Everything in Professional", "Advanced service metrics", "Automated reminders and exception rules", "Priority onboarding and support"],
    cta: { href: "/contact?plan=Carrier%20Fleet", label: "Talk to a specialist" },
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        title="Pricing that follows the freight"
        lead="Carriers can start free. Forwarders pay per shipment, and only once a carrier has accepted it. A specialist will set up a plan around your volume."
      />

      <section className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-brand-900">For drayage carriers</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {carrierPlans.map((p) => <PlanCard key={p.name} plan={p} />)}
          </div>

          <h2 className="mt-20 text-2xl font-semibold tracking-tight text-brand-900">For freight forwarders</h2>
          <div className="mt-8 grid gap-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:p-10">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Per shipment</h3>
              <p className="mt-3 max-w-xl text-[15px] leading-7 text-slate-600">
                You&apos;re charged once for each job a carrier accepts through ProjectLock. Editing a job, resending it,
                messaging, or re-uploading a document never counts twice. Volume pricing is set with a specialist.
              </p>
              <ul className="mt-6 grid gap-x-8 gap-y-3 text-[15px] text-slate-700 sm:grid-cols-2">
                {["Your whole team on one account", "Carrier directory and private approvals", "Send jobs to carriers without accounts", "Dashboards, exception queue and PODs", "Searchable history and CSV exports", "Help onboarding your current carriers"].map((f) => (
                  <li key={f} className="flex gap-2.5"><Check />{f}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-between gap-6 rounded-lg bg-brand-900 p-6 text-white sm:p-8">
              <div>
                <p className="text-sm text-brand-100">Billed per accepted shipment</p>
                <p className="mt-2 text-3xl font-semibold">Volume-based</p>
                <p className="mt-3 text-[15px] leading-6 text-slate-300">
                  Tell us roughly how many moves you run each month and which ports. We&apos;ll come back with a quote.
                </p>
              </div>
              <Link href="/contact?plan=Forwarder%20per%20shipment" className={`${btn} bg-white text-brand-900 hover:bg-brand-50`}>Talk to a specialist</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_2fr] lg:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-brand-900">Common questions</h2>
          <dl className="divide-y divide-slate-200 border-y border-slate-200">
            {[
              ["What counts as a shipment?", "A job that a carrier accepts. One job can include several containers from the same booking or bill of lading. Drafts, declined jobs and canceled jobs before acceptance are not charged."],
              ["Do carriers pay to receive jobs?", "No. Carriers can receive, accept and complete jobs on the free Starter plan. Paid carrier plans add history, storage, more users and reporting."],
              ["Do we need EDI or an integration?", "No. Everything works in the browser, and carriers can respond from a secure email link without an account. Integrations come later for teams that ask for them."],
              ["Can we try it with a few carriers first?", "Yes. Most teams start with one lane or one port and a handful of carriers. A specialist can help you plan that rollout."],
              ["Is our data shared with other companies?", "No. Each company's jobs, documents, rates and approvals are isolated from every other company at the database level."],
            ].map(([q, a]) => (
              <div key={q} className="py-6">
                <dt className="font-semibold text-slate-900">{q}</dt>
                <dd className="mt-2 max-w-3xl text-[15px] leading-7 text-slate-600">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className={`flex flex-col rounded-xl bg-white p-6 sm:p-8 ${plan.featured ? "ring-2 ring-brand-600" : "border border-slate-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
        {plan.featured && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Recommended</span>}
      </div>
      <p className="mt-4 text-3xl font-semibold text-brand-900">{plan.price}</p>
      <p className="text-sm text-slate-500">{plan.priceNote}</p>
      <p className="mt-4 text-[15px] leading-6 text-slate-600">{plan.body}</p>
      <ul className="mt-6 flex-1 space-y-3 text-[15px] text-slate-700">
        {plan.features.map((f) => <li key={f} className="flex gap-2.5"><Check />{f}</li>)}
      </ul>
      <Link href={plan.cta.href} className={`${btn} mt-8 ${plan.featured ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-300 text-slate-900 hover:bg-slate-50"}`}>
        {plan.cta.label}
      </Link>
    </div>
  );
}

function Check() {
  return (
    <svg className="mt-1 h-4 w-4 shrink-0 text-brand-600" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
