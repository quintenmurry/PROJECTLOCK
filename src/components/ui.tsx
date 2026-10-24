import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const btn = {
  base: "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-9 px-3.5",
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  ghost: "text-slate-700 hover:bg-slate-100",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof Omit<typeof btn, "base"> }) {
  return <button className={cx(btn.base, btn[variant], className)} {...props} />;
}

export function buttonClass(variant: keyof Omit<typeof btn, "base"> = "primary", extra?: string) {
  return cx(btn.base, btn[variant], extra);
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cx(
        "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cx(
        "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100",
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "success" | "info" | "warning"; children: ReactNode }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-brand-100 bg-brand-50 text-brand-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-md border px-3 py-2 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-lg border border-slate-200 bg-white", className)}>{children}</section>;
}

export function CardHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "brand" | "green" | "amber" | "red"; children: ReactNode }) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
    brand: "bg-brand-50 text-brand-700 ring-brand-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
  };
  return (
    <span className={cx("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone])}>
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor" opacity="0.15" />
        <path d="M6 6v12M10 6v12M14 6v12M18 6v12" stroke="currentColor" strokeWidth="1.6" />
        <rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span>{process.env.NEXT_PUBLIC_APP_NAME ?? "ProjectLock"}</span>
    </span>
  );
}
