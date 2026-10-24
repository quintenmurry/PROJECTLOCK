"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError, type ActionState } from "@/lib/errors";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid work email.").max(254),
  companyName: z.string().trim().min(2, "Enter your company name.").max(160),
  companyType: z.enum(["forwarder", "carrier", "other"], { message: "Tell us what kind of company you are." }),
  phone: z.string().trim().max(40),
  monthlyMoves: z.string().trim().max(40),
  planInterest: z.string().trim().max(60),
  message: z.string().trim().max(4000, "Keep your message under 4,000 characters."),
});

export async function submitInquiry(_: ActionState, form: FormData): Promise<ActionState> {
  // Honeypot: real people never see or fill this field.
  if (String(form.get("website") ?? "") !== "") return { ok: true };
  const values = Object.fromEntries(
    ["fullName", "email", "companyName", "companyType", "phone", "monthlyMoves", "planInterest", "message"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, data: values };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_sales_inquiry", {
    p_full_name: d.fullName,
    p_email: d.email,
    p_company_name: d.companyName,
    p_company_type: d.companyType,
    p_phone: d.phone,
    p_monthly_moves: d.monthlyMoves,
    p_plan_interest: d.planInterest,
    p_message: d.message,
  });
  if (error) return { error: friendlyError(error), data: values };
  return { ok: true, data: { name: d.fullName.split(" ")[0] } };
}
