import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { PHOTOS } from "@/lib/photos";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col bg-white">
        <header className="px-6 py-6 text-brand-900 sm:px-10">
          <Link href="/" aria-label="Haulbook home"><Logo className="text-lg" /></Link>
        </header>
        <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-6 sm:px-10 sm:pt-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <footer className="flex gap-4 px-6 py-5 text-xs text-slate-500 sm:px-10">
          <Link href="/" className="hover:text-slate-800">Home</Link>
          <Link href="/pricing" className="hover:text-slate-800">Pricing</Link>
          <Link href="/contact" className="hover:text-slate-800">Talk to a specialist</Link>
        </footer>
      </div>
      <aside className="relative hidden overflow-hidden bg-brand-950 lg:block">
        <Image src={PHOTOS.auth.src} alt="" fill sizes="55vw" className="object-cover opacity-70" priority />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="max-w-md text-2xl font-semibold leading-snug tracking-tight">
            Every load and every piece of paperwork, in one book. Share the POD with a link.
          </p>
          <p className="mt-3 text-sm text-slate-300">For drayage carriers, owner-operators and the customers they haul for.</p>
        </div>
      </aside>
    </div>
  );
}
