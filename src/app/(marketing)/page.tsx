import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PHOTOS } from "@/lib/photos";
import { JobRecordPreview } from "@/components/job-record-preview";

export const metadata: Metadata = {
  title: { absolute: "ProjectLock · Drayage coordination for forwarders and carriers" },
};

const primary = "inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-brand-900 hover:bg-brand-50";
const secondaryDark = "inline-flex min-h-11 items-center justify-center rounded-md border border-white/40 px-5 text-sm font-semibold text-white hover:bg-white/10";
const primaryLight = "inline-flex min-h-11 items-center justify-center rounded-md bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-brand-950 text-white">
        <Image src={PHOTOS.hero.src} alt="" fill priority sizes="100vw" className="-z-20 object-cover opacity-60" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-950 via-brand-950/85 to-brand-950/30" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:pb-28 lg:pt-40">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-brand-100">Now onboarding forwarders and drayage carriers</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Every container move, one shared record.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200">
              ProjectLock gives freight forwarders and drayage carriers one place for the job, the delivery order, every
              status update and the proof of delivery. No more chasing them across email threads, phone calls and
              spreadsheets.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/signup" className={primary}>Create a free account</Link>
              <Link href="/contact" className={secondaryDark}>Talk to a specialist</Link>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <JobRecordPreview />
          </div>
        </div>
      </section>

      {/* Problem / answer */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.3fr] lg:py-24">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">The box moves. The paperwork shouldn&apos;t get lost.</h2>
            <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
              One import move touches a forwarder, a dispatcher, a driver, a terminal and a warehouse. Today the
              details live in whoever&apos;s inbox they landed in.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
            <div className="bg-slate-50 p-6 sm:p-8">
              <h3 className="font-semibold text-slate-900">How it usually goes</h3>
              <ul className="mt-4 space-y-3 text-[15px] leading-6 text-slate-600">
                <li>The delivery order is an attachment three replies deep.</li>
                <li>&ldquo;Did you get the job?&rdquo; becomes a phone call.</li>
                <li>Status lives in a spreadsheet someone updates on Fridays.</li>
                <li>The POD arrives as a blurry text message, or not at all.</li>
              </ul>
            </div>
            <div className="bg-white p-6 sm:p-8">
              <h3 className="font-semibold text-brand-900">How it goes on ProjectLock</h3>
              <ul className="mt-4 space-y-3 text-[15px] leading-6 text-slate-700">
                <li>The DO is attached to the job, where everyone can find it.</li>
                <li>You can see the moment a carrier opens and accepts a job.</li>
                <li>Milestones are timestamped and show who reported them.</li>
                <li>Missing PODs are flagged until they&apos;re uploaded.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-8 bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">How a move runs</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">The same five steps you already follow, in one place both companies can see.</p>
          </div>
          <ol className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-5">
            {[
              ["Create the job", "The forwarder enters references, pickup and delivery details, and attaches the delivery order. Multi-container bookings are supported."],
              ["Send it to a carrier", "Pick from your approved carriers, or email any carrier a secure link. They don't need an account to respond."],
              ["Carrier accepts and dispatches", "The dispatcher accepts, declines or asks a question, then assigns a driver."],
              ["Driver updates from the road", "Arrival, pickup, delivery and empty return are logged from a phone, with gate receipts and photos."],
              ["POD closes the job", "The signed POD is uploaded to the job. The forwarder has it immediately, and the record stays searchable."],
            ].map(([title, body], i) => (
              <li key={title} className="relative">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-900 text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-[15px] leading-6 text-slate-600">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Forwarders */}
      <Audience
        id="forwarders"
        photo={PHOTOS.forwarders}
        title="For freight forwarders"
        lead="Know where every move stands without asking."
        points={[
          ["Find carriers that fit the move", "Search by port, terminal, delivery area, container type and equipment."],
          ["Keep your own approved list", "Your approvals are private to your company. Another forwarder's list never affects yours."],
          ["See acknowledgment, not just delivery", "Email sent, link opened, job accepted and milestone confirmed are tracked as separate events."],
          ["Get the POD without chasing", "Jobs waiting on paperwork are flagged on your dashboard until the document arrives."],
        ]}
        cta={{ href: "/signup", label: "Set up your forwarder account" }}
      />

      {/* Carriers */}
      <Audience
        id="carriers"
        reverse
        photo={PHOTOS.carriers}
        title="For drayage carriers"
        lead="Fewer calls, cleaner paperwork, faster turns."
        points={[
          ["Every job in one queue", "New, accepted, scheduled today, in progress and waiting on POD, sorted for dispatch."],
          ["Instructions that don't get lost", "The DO, appointment windows and special instructions live on the job, not in an inbox."],
          ["Drivers on their phones", "A simple mobile view with only their assigned jobs. Big buttons, minimal typing."],
          ["Be found by new forwarders", "Publish your ports, terminals and equipment. Contact details stay private until a forwarder approves you."],
        ]}
        cta={{ href: "/signup", label: "Set up your carrier account" }}
      />

      {/* No-account carriers */}
      <section className="bg-brand-900 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:py-24">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your carriers can start without signing up.</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              Send a job to any carrier by email. They get a secure link to that one job and can review it, accept or
              decline, ask a question and upload documents. If they like working this way, they can create an account
              in a minute.
            </p>
            <ul className="mt-8 space-y-3 text-[15px] text-slate-200">
              <li>Links open only the job they were sent for.</li>
              <li>They expire automatically and can be revoked at any time.</li>
              <li>No EDI, no integration project, no software to install.</li>
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-xl">
            <Image src={PHOTOS.driver.src} alt={PHOTOS.driver.alt} width={1200} height={800} sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[3/2] w-full bg-brand-700 object-cover" />
            <div className="absolute inset-x-4 bottom-4 rounded-lg bg-white/95 p-4 text-slate-900 shadow-lg backdrop-blur sm:inset-x-6 sm:bottom-6 sm:max-w-sm">
              <p className="text-sm font-semibold">New job from Harborline Forwarding</p>
              <p className="mt-1 text-sm text-slate-600">1 × 40&apos; HC · Long Beach to Ontario, CA · Pickup Tue 6:00</p>
              <div className="mt-3 flex gap-2 text-sm">
                <span className="rounded-md bg-brand-600 px-3 py-1.5 font-semibold text-white">Review job</span>
                <span className="px-1 py-1.5 text-slate-500">Expires in 14 days</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-8 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">Your shipments stay yours.</h2>
              <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
                Forwarders and carriers trust us with rates, customers and documents. We built the platform so that
                trust is enforced, not promised.
              </p>
            </div>
            <dl className="grid gap-8 sm:grid-cols-2">
              {[
                ["Company-level isolation", "Every record belongs to a company, and the database itself refuses access to anyone outside it. Changing a URL or ID gets you nothing."],
                ["Private documents", "Files are never public. Downloads use short-lived links issued only after an access check."],
                ["Internal notes stay internal", "Carrier notes are hidden from forwarders and forwarder notes from carriers, and the interface marks which is which."],
                ["A full audit trail", "Status changes, approvals, invitations and document replacements are recorded with who did it and when."],
              ].map(([t, d]) => (
                <div key={t} className="border-t-2 border-brand-900 pt-4">
                  <dt className="font-semibold text-slate-900">{t}</dt>
                  <dd className="mt-2 text-[15px] leading-6 text-slate-600">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative isolate overflow-hidden bg-brand-950 text-white">
        <Image src={PHOTOS.yard.src} alt="" fill sizes="100vw" className="-z-20 object-cover opacity-35" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-brand-950/70" />
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Bring your next move onto ProjectLock.</h2>
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-300">
            Carriers can start free. Forwarders, talk with a specialist about volume and how to onboard the carriers you already use.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={primary}>Create a free account</Link>
            <Link href="/pricing" className={secondaryDark}>See pricing</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Audience({
  id, photo, title, lead, points, cta, reverse = false,
}: {
  id: string; photo: { src: string; alt: string }; title: string; lead: string;
  points: [string, string][]; cta: { href: string; label: string }; reverse?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-8 bg-white">
      <div className={`mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-24`}>
        <div className={reverse ? "lg:order-2" : undefined}>
          <Image src={photo.src} alt={photo.alt} width={1200} height={1000} sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[6/5] w-full rounded-xl bg-slate-200 object-cover" />
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-600">{title}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">{lead}</h2>
          <dl className="mt-8 space-y-6">
            {points.map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold text-slate-900">{t}</dt>
                <dd className="mt-1 text-[15px] leading-6 text-slate-600">{d}</dd>
              </div>
            ))}
          </dl>
          <Link href={cta.href} className={`${primaryLight} mt-8`}>{cta.label}</Link>
        </div>
      </div>
    </section>
  );
}
