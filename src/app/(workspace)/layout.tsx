import { getMyCompanies, isPlatformAdmin, requireCompany, requireUser } from "@/lib/session";
import { CompanySwitcher } from "@/components/company-switcher";
import { NavLink } from "@/components/nav-link";
import { Logo } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/types";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [company, companies, admin] = await Promise.all([requireCompany(), getMyCompanies(), isPlatformAdmin()]);
  const name = (user.user_metadata?.full_name as string | undefined) || user.email;

  const nav = (
    <nav className="space-y-0.5" aria-label="Main">
      <NavLink href="/dashboard">Overview</NavLink>
      <NavLink href="/team">Team</NavLink>
      <NavLink href="/settings/company">Company</NavLink>
      <NavLink href="/account">My account</NavLink>
      {admin && (
        <>
          <div className="px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Platform</div>
          <NavLink href="/admin">Administration</NavLink>
        </>
      )}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 pt-3">
      <div className="truncate text-sm text-white">{name}</div>
      <div className="text-xs text-slate-400">{ROLE_LABEL[company.role]}</div>
      <form action="/auth/signout" method="post" className="mt-2">
        <button type="submit" className="text-xs font-medium text-slate-300 hover:text-white hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col gap-5 bg-brand-900 px-3 py-4 lg:flex lg:sticky lg:top-0 lg:h-dvh">
        <div className="px-2 text-white"><Logo /></div>
        <div className="px-2"><CompanySwitcher companies={companies} activeId={company.company_id} /></div>
        <div className="flex-1">{nav}</div>
        <div className="px-2">{footer}</div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-10 bg-brand-900 px-4 py-3 lg:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between text-white">
            <Logo />
            <span className="rounded-md border border-white/20 px-2.5 py-1.5 text-sm">Menu</span>
          </summary>
          <div className="mt-3 space-y-4 pb-2">
            <CompanySwitcher companies={companies} activeId={company.company_id} />
            {nav}
            {footer}
          </div>
        </details>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
