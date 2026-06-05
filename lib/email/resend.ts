// NEVER import in a client component — reads server-only RESEND_API_KEY.
// ─────────────────────────────────────────────────────────────────────────────
// Resend email integration. No-ops cleanly when RESEND_API_KEY is unset, so the
// app keeps working without email configured.
//
// Required env:
//   RESEND_API_KEY   your Resend API key
//   EMAIL_FROM       verified sender, e.g. "DAI <notifications@yourdomain.com>"
//                    (falls back to Resend's onboarding sender for testing)
//   NEXT_PUBLIC_APP_URL  base URL used to build absolute links in emails
// ─────────────────────────────────────────────────────────────────────────────
import { Resend } from "resend";

let client: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

const FROM =
  process.env.EMAIL_FROM ||
  "Digital Asset Investigations <onboarding@resend.dev>";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://digitalassetinvestigations.com";

export interface NotificationEmailInput {
  to: string;
  title: string;
  body: string;
  /** Relative (/dashboard/...) or absolute link. */
  link?: string | null;
}

/** Best-effort: never throws. Returns true when an email was dispatched. */
export async function sendNotificationEmail(
  input: NotificationEmailInput
): Promise<boolean> {
  const resend = getResend();
  if (!resend || !input.to) return false;

  const href = toAbsoluteUrl(input.link);

  try {
    await resend.emails.send({
      from: FROM,
      to: input.to,
      subject: input.title,
      html: renderEmail(input.title, input.body, href),
      text: `${input.title}\n\n${input.body}\n\n${href}`,
    });
    return true;
  } catch {
    return false;
  }
}

function toAbsoluteUrl(link?: string | null): string {
  if (!link) return APP_URL;
  if (link.startsWith("http")) return link;
  return `${APP_URL}${link.startsWith("/") ? "" : "/"}${link}`;
}

function renderEmail(title: string, body: string, href: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#0a0f1a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f1626;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
          <tr><td style="padding:28px 28px 8px;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#3b82f6;font-weight:700;">Digital Asset Investigations</div>
            <h1 style="margin:12px 0 0;font-size:20px;line-height:1.3;color:#f2f6fc;">${escapeHtml(title)}</h1>
          </td></tr>
          <tr><td style="padding:12px 28px 4px;color:#aebdd4;font-size:15px;line-height:1.6;">${escapeHtml(body)}</td></tr>
          <tr><td style="padding:24px 28px 28px;">
            <a href="${href}" style="display:inline-block;background:#1b5fd0;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">View in dashboard</a>
          </td></tr>
          <tr><td style="padding:16px 28px 28px;color:#5b6b85;font-size:12px;line-height:1.6;border-top:1px solid rgba(255,255,255,0.06);">
            You're receiving this because of activity on your Digital Asset Investigations account. You can turn off email notifications in your profile settings.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
