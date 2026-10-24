import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MyCompany } from "@/lib/types";

export const ACTIVE_COMPANY_COOKIE = "pl_company";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export const requireUser = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
});

export const getMyCompanies = cache(async (): Promise<MyCompany[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_companies");
  if (error) throw new Error(error.message);
  return (data ?? []) as MyCompany[];
});

export const isPlatformAdmin = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
});

/**
 * The company the user is currently working in. Falls back to their first usable membership.
 * The cookie is only a preference: every query is still checked by RLS on the server.
 */
export const getActiveCompany = cache(async (): Promise<MyCompany | null> => {
  const companies = await getMyCompanies();
  const usable = companies.filter(
    (c) => c.company_status === "active" && c.membership_status === "active",
  );
  const wanted = (await cookies()).get(ACTIVE_COMPANY_COOKIE)?.value;
  return usable.find((c) => c.company_id === wanted) ?? usable[0] ?? null;
});

/** For workspace pages: signed in and with a usable company, or redirect to fix that. */
export async function requireCompany(): Promise<MyCompany> {
  await requireUser();
  const company = await getActiveCompany();
  if (!company) redirect("/onboarding");
  return company;
}

export function canManage(company: MyCompany) {
  return company.role === "owner" || company.role === "admin";
}
