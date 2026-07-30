import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import type { RuntimeConfig } from "@/server/config";
import { createDrizzleDatabase } from "@/server/db/drizzle";
import { betterAuthSchema } from "./better-auth-schema";

type ProductionConfig = Extract<RuntimeConfig, { mode: "production" }>;
type ProductionAuth = ReturnType<typeof createProductionAuth>;

const globalAuth = globalThis as unknown as {
  __ICHING_PRODUCTION_AUTH__?: ProductionAuth;
};

async function sendMagicLinkEmail(config: ProductionConfig, input: { email: string; url: string }): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.credentials.resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.credentials.emailFrom,
      to: [input.email],
      subject: "Your secure I Ching Coin sign-in link",
      text: `Open this secure, single-use link to continue: ${input.url}`,
      html: `<p>Open this secure, single-use link to continue:</p><p><a href="${input.url}">Continue to I Ching Coin</a></p><p>This link expires shortly and can be used once.</p>`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`RESEND_MAGIC_LINK_FAILED:${response.status}`);
}

export function createProductionAuth(config: ProductionConfig) {
  const { db } = createDrizzleDatabase(config.credentials.databaseUrl);
  return betterAuth({
    appName: "I Ching Coin",
    baseURL: config.credentials.betterAuthUrl,
    secret: config.credentials.betterAuthSecret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: betterAuthSchema,
    }),
    trustedOrigins: [config.baseUrl, config.credentials.publicAppUrl],
    socialProviders: {
      google: {
        clientId: config.credentials.googleClientId,
        clientSecret: config.credentials.googleClientSecret,
      },
    },
    plugins: [
      magicLink({
        expiresIn: 10 * 60,
        sendMagicLink: (input) => sendMagicLinkEmail(config, input),
      }),
    ],
    session: {
      expiresIn: 30 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      },
    },
  });
}

export function getProductionAuth(config: ProductionConfig): ProductionAuth {
  return globalAuth.__ICHING_PRODUCTION_AUTH__ ??=
    createProductionAuth(config);
}
