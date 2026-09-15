import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { authSchema } from "@/server/db/auth-schema";
import { getAuthDatabaseConnection, type AuthDatabase } from "@/server/db/client";
import { resolveCommercialCapabilities } from "@/server/capabilities";
import { createResendMagicLinkTransport, type MagicLinkData } from "./email";
import { isAuthCapabilityEnabled } from "./capability";

type RuntimeEnv = Record<string, string | undefined>;
export type MagicLinkTransport = { sendMagicLink(data: MagicLinkData): Promise<void> };
export type AuthInstance = ReturnType<typeof betterAuth>;

function required(env: RuntimeEnv, name: string): string {
  const candidate = env[name]?.trim();
  if (!candidate) throw new Error("AUTH_CONFIGURATION_UNAVAILABLE");
  if (name === "BETTER_AUTH_SECRET" && candidate.length < 32) {
    throw new Error("AUTH_CONFIGURATION_UNAVAILABLE");
  }
  return candidate;
}

function originOf(baseURL: string, production: boolean): string {
  try {
    const url = new URL(baseURL);
    if (
      (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) ||
      (production && url.protocol !== "https:")
    ) {
      throw new Error();
    }
    return url.origin;
  } catch {
    throw new Error("AUTH_CONFIGURATION_UNAVAILABLE");
  }
}

export function buildAuthOptions(
  db: AuthDatabase,
  env: RuntimeEnv = process.env,
  emailTransport?: MagicLinkTransport,
): BetterAuthOptions {
  const baseURL = required(env, "BETTER_AUTH_URL");
  const secret = required(env, "BETTER_AUTH_SECRET");
  const googleClientId = required(env, "GOOGLE_CLIENT_ID");
  const googleClientSecret = required(env, "GOOGLE_CLIENT_SECRET");
  const resendApiKey = required(env, "RESEND_API_KEY");
  const emailFrom = required(env, "EMAIL_FROM");
  const production = env.NODE_ENV === "production";
  const transport = emailTransport ?? createResendMagicLinkTransport(resendApiKey, emailFrom);
  const origin = originOf(baseURL, production);
  const configuredTrustedOrigins = env.BETTER_AUTH_TRUSTED_ORIGINS
    ?.split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean) ?? [];
  if (production && configuredTrustedOrigins.some((candidate) => candidate !== origin)) {
    throw new Error("AUTH_CONFIGURATION_UNAVAILABLE");
  }

  return {
    appName: "Quick I Ching",
    baseURL,
    basePath: "/api/auth",
    secret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authSchema,
      transaction: true,
    }),
    trustedOrigins: [origin],
    socialProviders: {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        requireEmailVerification: true,
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        requireLocalEmailVerified: true,
        trustedProviders: [],
      },
      encryptOAuthTokens: true,
      storeStateStrategy: "database",
    },
    verification: { storeInDatabase: true },
    user: {
      validateUserInfo: async ({ user, source }) => {
        if (source.method === "oauth" && user.emailVerified !== true) {
          return {
            error: "provider_email_unverified",
            errorDescription: "The identity provider did not verify this email address.",
          };
        }
        return undefined;
      },
    },
    advanced: {
      useSecureCookies: production,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: production,
        sameSite: "lax",
        path: "/",
      },
      disableOriginCheck: false,
    },
    plugins: [
      magicLink({
        expiresIn: 600,
        storeToken: "hashed",
        sendMagicLink: transport.sendMagicLink,
      }),
      // Better Auth's Next.js integration must be the final plugin so its
      // response-cookie hook observes the complete plugin response.
      nextCookies(),
    ],
  };
}

let cachedAuth: AuthInstance | undefined;

export function getAuth(env: RuntimeEnv = process.env): AuthInstance {
  if (!isAuthCapabilityEnabled(env)) throw new Error("AUTH_DISABLED");
  if (cachedAuth) return cachedAuth;
  const capabilities = resolveCommercialCapabilities(env);
  if (!capabilities.capabilities.auth.enabled) throw new Error("AUTH_DISABLED");
  const { db } = getAuthDatabaseConnection(required(env, "DATABASE_URL"));
  cachedAuth = betterAuth(buildAuthOptions(db, env));
  return cachedAuth;
}

export function getAuthHandler() {
  return toNextJsHandler(getAuth().handler);
}

export function resetAuthForTests(): void {
  cachedAuth = undefined;
}
