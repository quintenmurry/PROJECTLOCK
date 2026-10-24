"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium",
        active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}
