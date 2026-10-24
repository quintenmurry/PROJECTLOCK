import type { Metadata } from "next";
import { PageHero } from "../page-hero";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Talk to a specialist" };

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { plan } = await searchParams;
  return (
    <>
      <PageHero
        title="Talk to a specialist"
        lead="Tell us about your fleet and the paperwork headaches you want gone. A Haulbook specialist will reply by email to help you get set up."
      />
      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.6fr] lg:py-20">
          <div className="space-y-8">
            <div>
              <h2 className="font-semibold text-slate-900">What happens next</h2>
              <ol className="mt-4 space-y-4 text-[15px] leading-6 text-slate-600">
                <li className="flex gap-3"><Num n={1} />We read your request and reply by email.</li>
                <li className="flex gap-3"><Num n={2} />We walk through your trucks, drivers, ports and the customers you share paperwork with.</li>
                <li className="flex gap-3"><Num n={3} />We help you load your first moves and set up a plan that fits.</li>
              </ol>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Just want to look around?</h2>
              <p className="mt-2 text-[15px] leading-6 text-slate-600">Carriers and owner-operators can start on the free plan right away. No call needed.</p>
              <a href="/signup" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline">Start free</a>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <ContactForm plan={plan ?? ""} />
          </div>
        </div>
      </section>
    </>
  );
}

function Num({ n }: { n: number }) {
  return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white">{n}</span>;
}
