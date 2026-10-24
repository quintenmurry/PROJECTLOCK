import "server-only";
import { env } from "@/lib/env";

export interface EmailResult {
  delivered: boolean; // true only when the provider accepted the message
  mode: "resend" | "dev-console";
  error?: string;
}

/**
 * Sends a transactional email through Resend when RESEND_API_KEY and EMAIL_FROM are set.
 * Otherwise logs it to the server console (development fallback) and reports delivered=false,
 * so the UI never claims an email was sent when it wasn't.
 */
export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.info(`\n[email:dev] To: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.text}\n`);
    return { delivered: false, mode: "dev-console" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, text: opts.text, html: opts.html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Resend error", res.status, body);
      return { delivered: false, mode: "resend", error: `Email provider returned ${res.status}` };
    }
    return { delivered: true, mode: "resend" };
  } catch (e) {
    console.error("[email] send failed", e);
    return { delivered: false, mode: "resend", error: "Email provider unreachable" };
  }
}

export function inviteEmail(p: { companyName: string; inviterName: string; roleLabel: string; link: string }) {
  const subject = `${p.inviterName} invited you to ${p.companyName} on ${env.appName}`;
  const text = [
    `${p.inviterName} invited you to join ${p.companyName} on ${env.appName} as ${p.roleLabel}.`,
    "",
    `Accept the invitation: ${p.link}`,
    "",
    "This link expires in 7 days. If you weren't expecting it, you can ignore this email.",
  ].join("\n");
  const html = `<p>${escapeHtml(p.inviterName)} invited you to join <strong>${escapeHtml(p.companyName)}</strong> on ${escapeHtml(env.appName)} as ${escapeHtml(p.roleLabel)}.</p><p><a href="${p.link}">Accept the invitation</a></p><p style="color:#64748b">This link expires in 7 days. If you weren't expecting it, you can ignore this email.</p>`;
  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
