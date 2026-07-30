import * as z from "zod";
import { runtimeConfig } from "@/server/config";
import { getProductionAuth } from "@/server/auth/better-auth";
import { TurnstileVerifier } from "@/server/abuse/turnstile";

const schema = z.object({
  method: z.enum(["magic-link", "google"]),
  email: z.string().email().optional(),
  callbackURL: z.string().startsWith("/").max(500).default("/account"),
  turnstileToken: z.string().max(2048),
}).refine((value) => value.method !== "magic-link" || Boolean(value.email), {
  path: ["email"],
  message: "Email is required for a magic link.",
});

export async function POST(request: Request): Promise<Response> {
  const config = runtimeConfig();
  if (config.auth !== "better-auth") {
    return Response.json({ error: "Production authentication is not enabled." }, { status: 404 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid sign-in request." }, { status: 400 });
  const hostname = new URL(config.credentials.publicAppUrl).hostname;
  const remoteIp = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    await new TurnstileVerifier({ secret: config.credentials.turnstileSecretKey }).verify({
      token: parsed.data.turnstileToken,
      action: "login",
      hostname,
      remoteIp,
      idempotencyKey: crypto.randomUUID(),
    });
  } catch {
    return Response.json({ error: "Human verification failed." }, { status: 400 });
  }

  const auth = getProductionAuth(config);
  if (parsed.data.method === "magic-link") {
    await auth.api.signInMagicLink({
      body: {
        email: parsed.data.email!,
        callbackURL: parsed.data.callbackURL,
        errorCallbackURL: "/signin?error=magic-link",
      },
      headers: request.headers,
    });
    return Response.json({ sent: true });
  }

  const result = await auth.api.signInSocial({
    body: {
      provider: "google",
      callbackURL: parsed.data.callbackURL,
      errorCallbackURL: "/signin?error=google",
      disableRedirect: true,
    },
    headers: request.headers,
  });
  return Response.json({ url: result.url });
}
