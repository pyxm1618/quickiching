import { Resend } from "resend";

export type MagicLinkData = {
  email: string;
  url: string;
  token: string;
  metadata?: Record<string, unknown>;
};

export type MagicLinkEmail = {
  to: string[];
  from: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailSender = (message: MagicLinkEmail) => Promise<void>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export function createMagicLinkEmailTransport(
  send: EmailSender,
  from = "Quick I Ching <noreply@example.com>",
) {
  return {
    async sendMagicLink(data: MagicLinkData): Promise<void> {
      const isStagingRuntime =
        process.env.APP_ENV === "staging" &&
        process.env.NODE_ENV !== "test" &&
        !process.env.VITEST;
      if (isStagingRuntime) {
        console.log("[STAGING_MAGIC_LINK]", data.url);
      }
      try {
        const safeURL = escapeHtml(data.url);
        const textContent = [
          "Sign in to Quick I Ching",
          "",
          "We received a request to sign in to your Quick I Ching account.",
          "",
          "Use the link below to securely sign in:",
          data.url,
          "",
          "Security Notice: This link is valid for 10 minutes and can only be used once. If you did not request this email, please safely disregard it.",
          "",
          "— Quick I Ching Security",
          "https://www.quickiching.com",
        ].join("\n");

        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to Quick I Ching</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d0b14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f5f2eb;">
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;">
    Your one-time sign-in link for Quick I Ching. Valid for 10 minutes.
  </div>
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d0b14; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #171324; border: 1px solid rgba(235, 178, 85, 0.25); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <tr>
            <td style="padding: 32px 32px 16px; text-align: center;">
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #ebb255; font-weight: 600;">Quick I Ching · Security</p>
              <h1 style="margin: 12px 0 0; font-size: 24px; font-weight: 400; color: #ffffff; letter-spacing: -0.02em;">Sign in to your account</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 24px; font-size: 14px; line-height: 1.6; color: #b8b2a7; text-align: center;">
              <p style="margin: 0 0 24px;">Click the button below to sign in to Quick I Ching. Your reading session will be preserved.</p>
              <table border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #ebb255, #c88a2c);">
                    <a href="${safeURL}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #0d0b14; text-decoration: none; border-radius: 8px;">
                      Sign in to Quick I Ching
                    </a>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 28px; padding: 16px; background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; text-align: left;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #8e887d;">
                  <strong style="color: #ebb255;">Security Notice:</strong> This one-time link is valid for <strong>10 minutes</strong> and can only be used once. If you did not request this email, please disregard it.
                </p>
              </div>
              <p style="margin: 24px 0 0; font-size: 11px; line-height: 1.5; color: #6e685f; word-break: break-all; text-align: left;">
                Having trouble with the button? Copy and paste this URL into your browser:<br>
                <a href="${safeURL}" style="color: #ebb255; text-decoration: underline;">${safeURL}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px; background-color: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05); text-align: center; font-size: 11px; color: #5c564c;">
              <p style="margin: 0;">Quick I Ching · Ancient Wisdom, Modern Clarification</p>
              <p style="margin: 4px 0 0;"><a href="https://www.quickiching.com" style="color: #5c564c; text-decoration: underline;">www.quickiching.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        await send({
          to: [data.email],
          from,
          subject: "Your Quick I Ching sign-in link",
          text: textContent,
          html: htmlContent,
        });
      } catch (error) {
        if (isStagingRuntime) {
          console.warn("[STAGING_MAGIC_LINK_TRANSPORT_FALLBACK]", error);
          return;
        }
        throw new Error("AUTH_EMAIL_DELIVERY_FAILED");
      }
    },
  };
}

export function createResendMagicLinkTransport(apiKey: string, from: string) {
  const resend = new Resend(apiKey);
  return createMagicLinkEmailTransport(async (message) => {
    const result = await resend.emails.send({ ...message, from });
    if (result.error) throw new Error("AUTH_EMAIL_DELIVERY_FAILED");
  }, from);
}
