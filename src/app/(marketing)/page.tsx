import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PHOTOS } from "@/lib/photos";
import { JobRecordPreview } from "@/components/job-record-preview";

export const metadata: Metadata = {
  title: { absolute: "Haulbook · Loads and paperwork for drayage carriers" },
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
            <p className="text-sm font-medium text-brand-100">Built for drayage carriers and owner-operators</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Every load and every piece of paperwork, in one book.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200">
              Haulbook keeps track of your container moves and the documents that go with them: delivery orders, gate
              receipts, EIRs and signed PODs. When a customer needs the POD or wants to know where a box is, send
              them a link and they can see it themselves.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/signup" className={primary}>Start free</Link>
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
            <h2 className="text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">Stop digging for the POD.</h2>
            <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
              You moved the box. Now the paperwork is in a driver&apos;s camera roll, the DO is buried in an email,
              and the customer is calling for the third time.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
            <div className="bg-slate-50 p-6 sm:p-8">
              <h3 className="font-semibold text-slate-900">Without Haulbook</h3>
              <ul className="mt-4 space-y-3 text-[15px] leading-6 text-slate-600">
                <li>PODs come in as texts, photos and paper left in the cab.</li>
                <li>Customers call dispatch to ask if the box was delivered.</li>
                <li>Finding a gate receipt from last month means searching three phones.</li>
                <li>Invoices wait because the paperwork isn&apos;t together.</li>
              </ul>
            </div>
            <div className="bg-white p-6 sm:p-8">
              <h3 className="font-semibold text-brand-900">With Haulbook</h3>
              <ul className="mt-4 space-y-3 text-[15px] leading-6 text-slate-700">
                <li>Drivers snap documents straight onto the load from their phone.</li>
                <li>Customers check status and download the POD from a link.</li>
                <li>Search any container, booking or B/L number and it&apos;s all there.</li>
                <li>Loads missing a POD are flagged until it&apos;s uploaded.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-8 bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">How it works</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">The way you already run a move, written down once and shared with whoever needs it.</p>
          </div>
          <ol className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-5">
            {[
              ["Add the load", "Enter the container, booking or B/L, pickup and delivery, and attach the DO. Or accept a load a customer sent you on Haulbook."],
              ["Assign a driver", "Pick the driver and truck. They see only their own loads, on their phone."],
              ["Driver logs the move", "Pickup, delivery and empty return in a tap, with gate receipts, EIRs and photos from the camera."],
              ["Share it", "Send a link to the forwarder, broker, shipper or warehouse. They see that one load and nothing else."],
              ["POD closes it out", "The signed POD lands on the load, your customer has it right away, and you have it for the invoice."],
            ].map(([title, body], i) => (
              <li key={title}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-900 text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-[15px] leading-6 text-slate-600">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Dispatch / owners */}
      <Feature
        id="carriers"
        photo={PHOTOS.carriers}
        eyebrow="For owners and dispatchers"
        title="Know where every box stands without making a call."
        points={[
          ["Every load in one list", "New, scheduled today, in progress, waiting on POD and done, with filters for driver, customer and date."],
          ["Paperwork attached to the load", "DOs, gate receipts, EIRs, damage photos and PODs stay with the move they belong to."],
          ["Nothing slips", "Loads missing a POD or running late show up at the top until someone deals with them."],
          ["A history you can search", "Find any container number from last week or last year, with every document still attached."],
        ]}
        cta={{ href: "/signup", label: "Start free" }}
      />

      {/* Drivers */}
      <Feature
        id="drivers"
        reverse
        photo={PHOTOS.driver}
        eyebrow="For drivers"
        title="Built for a phone in a truck cab."
        points={[
          ["Only their loads", "Drivers see the moves assigned to them: addresses, appointment times and instructions."],
          ["Big buttons, little typing", "Arrived, picked up, delivered, empty returned. One tap each, timestamped."],
          ["Camera straight to the load", "Snap the gate receipt or signed POD and it's filed in the right place."],
          ["Nothing to install", "It runs in the phone's browser. Send them a sign-in link and they're set."],
        ]}
      />

      {/* Share */}
      <section id="sharing" className="scroll-mt-8 bg-brand-900 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:py-24">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Let your customers help themselves.</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              Whoever needs the POD or a status update (forwarder, broker, shipper or warehouse) gets a secure link
              to that load. They see the milestones and download the documents you choose to share, without an
              account and without calling dispatch.
            </p>
            <ul className="mt-8 space-y-3 text-[15px] text-slate-200">
              <li>Each link opens one load, never the rest of your book.</li>
              <li>Rates and internal notes are never shared.</li>
              <li>Links expire on their own, and you can turn one off any time.</li>
              <li>You can see when a link was opened and the POD downloaded.</li>
            </ul>
          </div>
          <div className="rounded-xl bg-white p-6 text-slate-900 shadow-2xl shadow-brand-950/40 sm:p-8">
            <p className="text-sm text-slate-500">Shared by Red River Drayage</p>
            <p className="mt-1 font-mono text-lg font-medium">MSDU 482019-3</p>
            <p className="text-sm text-slate-600">Long Beach, Pier T to Ontario, CA</p>
            <div className="mt-5 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm">
              <span className="font-semibold text-emerald-800">Delivered</span>
              <span className="text-emerald-700">Tue 10:51 am</span>
            </div>
            <ul className="mt-5 divide-y divide-slate-100 border-y border-slate-100 text-sm">
              {[["Signed POD", "PDF · 1 page"], ["Gate receipt", "Image"], ["Delivery order", "PDF · 2 pages"]].map(([n, m]) => (
                <li key={n} className="flex items-center justify-between py-3">
                  <span><span className="font-medium">{n}</span> <span className="text-slate-500">{m}</span></span>
                  <span className="font-medium text-brand-600">Download</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">This link expires in 30 days.</p>
          </div>
        </div>
      </section>

      {/* Forwarders, secondary */}
      <section id="forwarders" className="scroll-mt-8 bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:py-24">
          <Image src={PHOTOS.forwarders.src} alt={PHOTOS.forwarders.alt} width={1200} height={900} sizes="(min-width: 1024px) 45vw, 100vw" className="aspect-[4/3] w-full rounded-xl bg-slate-200 object-cover" />
          <div>
            <p className="text-sm font-semibold text-brand-600">For forwarders and brokers</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">Working with carriers on Haulbook?</h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Open a shared link and you have the status and the POD. If you send a lot of moves, create a forwarder
              account to send loads to your carriers, keep a private approved-carrier list, and see all your
              shipments in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={primaryLight}>Create a forwarder account</Link>
              <Link href="/contact" className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-5 text-sm font-semibold text-slate-900 hover:bg-slate-50">Talk to a specialist</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-8 border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">Your book stays yours.</h2>
              <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
                Your customers, rates and paperwork are your business. Haulbook only shows people what you share with them.
              </p>
            </div>
            <dl className="grid gap-8 sm:grid-cols-2">
              {[
                ["Walled off by company", "Every record belongs to your company, and the database refuses anyone outside it. Changing a link or ID gets nobody in."],
                ["Private documents", "Files are never public. Downloads use short-lived links issued only after an access check."],
                ["You decide what's shared", "Shared links show the load and the documents you pick. Rates and internal notes are never included."],
                ["A record of who did what", "Status updates, document uploads and shared-link views are logged with who and when."],
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
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Put your next load in the book.</h2>
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-300">
            Free to start for carriers and owner-operators. Add your drivers and share your first POD today.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={primary}>Start free</Link>
            <Link href="/pricing" className={secondaryDark}>See pricing</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Feature({
  id, photo, eyebrow, title, points, cta, reverse = false,
}: {
  id: string; photo: { src: string; alt: string }; eyebrow: string; title: string;
  points: [string, string][]; cta?: { href: string; label: string }; reverse?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-8 bg-white">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className={reverse ? "lg:order-2" : undefined}>
          <Image src={photo.src} alt={photo.alt} width={1200} height={1000} sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[6/5] w-full rounded-xl bg-slate-200 object-cover" />
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-600">{eyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">{title}</h2>
          <dl className="mt-8 space-y-6">
            {points.map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold text-slate-900">{t}</dt>
                <dd className="mt-1 text-[15px] leading-6 text-slate-600">{d}</dd>
              </div>
            ))}
          </dl>
          {cta && <Link href={cta.href} className={`${primaryLight} mt-8`}>{cta.label}</Link>}
        </div>
      </div>
    </section>
  );
}
