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
      try {
        const safeURL = escapeHtml(data.url);
        await send({
          to: [data.email],
          from,
          subject: "Your Quick I Ching sign-in link",
          text: `Use this one-time sign-in link: ${data.url}`,
          html: `<p>Use this one-time sign-in link:</p><p><a href="${safeURL}">Sign in to Quick I Ching</a></p>`,
        });
      } catch {
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
