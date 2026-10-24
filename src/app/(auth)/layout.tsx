import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="px-6 py-5 text-brand-900">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:pt-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <footer className="px-6 py-4 text-xs text-slate-500">
        Coordination workspace for freight forwarders and drayage carriers.
      </footer>
    </div>
  );
}
