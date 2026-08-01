import { randomUUID } from "node:crypto";
import { betterAuthSchema } from "./auth-schema";
import { runtimeConfig } from "@/server/config";
import { PostgresAuthBridge } from "@/server/repositories/postgres/auth-bridge";

type ProductionAuthCredentials = {
  betterAuthSecret: string;
  betterAuthUrl: string;
  googleClientId: string;
  googleClientSecret: string;
  resendApiKey: string;
  emailFrom: string;
};

type FetchLike = typeof fetch;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendMagicLinkWithResend(input: {
  email: string;
  url: string;
  apiKey: string;
  from: string;
  fetchImpl?: FetchLike;
}): Promise<void> {
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    throw new Error("MAGIC_LINK_URL_INVALID");
  }
  if (url.protocol !== "https:") throw new Error("MAGIC_LINK_URL_INVALID");

  const response = await (input.fetchImpl ?? fetch)("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
      "user-agent": "quickiching/0.1.0",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.email.trim().toLowerCase()],
      subject: "Your Quick I Ching sign-in link",
      html: [
        "<p>Use the link below to sign in to Quick I Ching.</p>",
        `<p><a href="${escapeHtml(url.toString())}">Sign in securely</a></p>`,
        "<p>This link expires in 10 minutes and can be used once.</p>",
      ].join(""),
    }),
  });
  if (!response.ok) {
    throw new Error(`MAGIC_LINK_EMAIL_FAILED:${response.status}`);
  }
}

export function buildProductionAuthOptions(
  credentials: ProductionAuthCredentials,
  dependencies: { database: unknown; sendMagicLink: (input: { email: string; url: string }) => Promise<void> | void },
) {
  const baseUrl = new URL(credentials.betterAuthUrl);
  if (baseUrl.protocol !== "https:") throw new Error("BETTER_AUTH_URL_INVALID");
  if (credentials.betterAuthSecret.length < 32) throw new Error("BETTER_AUTH_SECRET_INVALID");

  return {
    baseURL: baseUrl.origin,
    secret: credentials.betterAuthSecret,
    database: dependencies.database,
    trustedOrigins: [baseUrl.origin],
    socialProviders: {
      google: {
        clientId: credentials.googleClientId,
        clientSecret: credentials.googleClientSecret,
      },
    },
    magicLinkPolicy: {
      expiresIn: 600,
      storeToken: "hashed" as const,
      atomicSingleUse: true,
    },
    sendMagicLink: dependencies.sendMagicLink,
  };
}

type ProductionAuth = Awaited<ReturnType<typeof createProductionAuth>>;
let cachedAuth: Promise<ProductionAuth> | undefined;

async function createProductionAuth() {
  const config = runtimeConfig();
  if (config.mode !== "production") throw new Error("PRODUCTION_AUTH_NOT_ENABLED");
  const credentials: ProductionAuthCredentials = {
    betterAuthSecret: config.credentials.betterAuthSecret,
    betterAuthUrl: config.credentials.betterAuthUrl,
    googleClientId: config.credentials.googleClientId,
    googleClientSecret: config.credentials.googleClientSecret,
    resendApiKey: config.credentials.resendApiKey,
    emailFrom: config.credentials.emailFrom,
  };

  const [
    { betterAuth },
    { drizzleAdapter },
    { magicLink },
    { nextCookies },
    { drizzle },
    { default: postgres },
  ] = await Promise.all([
    import("better-auth"),
    import("better-auth/adapters/drizzle"),
    import("better-auth/plugins"),
    import("better-auth/next-js"),
    import("drizzle-orm/postgres-js"),
    import("postgres"),
  ]);

  const client = postgres(config.credentials.databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
  });
  const db = drizzle(client, { schema: betterAuthSchema });
  const bridge = new PostgresAuthBridge(client);
  const descriptor = buildProductionAuthOptions(credentials, {
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: betterAuthSchema,
    }),
    sendMagicLink: ({ email, url }) => sendMagicLinkWithResend({
      email,
      url,
      apiKey: credentials.resendApiKey,
      from: credentials.emailFrom,
    }),
  });

  return betterAuth({
    baseURL: descriptor.baseURL,
    secret: descriptor.secret,
    database: descriptor.database as never,
    trustedOrigins: descriptor.trustedOrigins,
    socialProviders: descriptor.socialProviders,
    advanced: {
      database: {
        generateId: () => randomUUID(),
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await bridge.ensureApplicationUser({ id: user.id, email: user.email });
          },
        },
        update: {
          after: async (user) => {
            await bridge.ensureApplicationUser({ id: user.id, email: user.email });
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: descriptor.magicLinkPolicy.expiresIn,
        storeToken: descriptor.magicLinkPolicy.storeToken,
        sendMagicLink: descriptor.sendMagicLink,
      }),
      nextCookies(),
    ],
  });
}

export function getProductionAuth(): Promise<ProductionAuth> {
  cachedAuth ??= createProductionAuth();
  return cachedAuth;
}
