import Link from "next/link";
import { getUser } from "@/lib/session";
import { Logo } from "@/components/ui";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const links = [
    { href: "/#how-it-works", label: "How it works" },
    { href: "/#forwarders", label: "Forwarders" },
    { href: "/#carriers", label: "Carriers" },
    { href: "/pricing", label: "Pricing" },
  ];
  const actions = user ? (
    <Link href="/dashboard" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-50">Open workspace</Link>
  ) : (
    <>
      <Link href="/login" className="px-3 py-2 text-sm font-medium text-white/85 hover:text-white">Sign in</Link>
      <Link href="/signup" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-50">Create account</Link>
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-white text-slate-900">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-5 sm:px-8">
          <Link href="/" className="text-white" aria-label="ProjectLock home"><Logo className="text-lg" /></Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-medium text-white/85 hover:text-white">{l.label}</Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">{actions}</div>
          <details className="relative md:hidden">
            <summary className="list-none rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium text-white">Menu</summary>
            <div className="absolute right-0 mt-2 w-60 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              {links.map((l) => <Link key={l.href} href={l.href} className="block rounded px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">{l.label}</Link>)}
              <Link href="/contact" className="block rounded px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">Talk to a specialist</Link>
              <div className="my-2 border-t border-slate-100" />
              {user ? (
                <Link href="/dashboard" className="block rounded px-3 py-2 text-sm font-semibold text-brand-700">Open workspace</Link>
              ) : (
                <>
                  <Link href="/login" className="block rounded px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">Sign in</Link>
                  <Link href="/signup" className="block rounded px-3 py-2 text-sm font-semibold text-brand-700">Create account</Link>
                </>
              )}
            </div>
          </details>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-brand-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo className="text-lg text-white" />
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-400">
              The shared record for drayage moves between ocean freight forwarders and trucking carriers.
            </p>
          </div>
          <FooterCol title="Product" links={[["How it works", "/#how-it-works"], ["For forwarders", "/#forwarders"], ["For carriers", "/#carriers"], ["Security", "/#security"]]} />
          <FooterCol title="Company" links={[["Pricing", "/pricing"], ["Talk to a specialist", "/contact"]]} />
          <FooterCol title="Account" links={user ? [["Open workspace", "/dashboard"]] : [["Sign in", "/login"], ["Create account", "/signup"]]} />
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-5 py-5 text-xs text-slate-500 sm:px-8">
            <span>© {new Date().getFullYear()} ProjectLock</span>
            <span>Photography from Unsplash</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([label, href]) => (
          <li key={href}><Link href={href} className="text-slate-400 hover:text-white">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
