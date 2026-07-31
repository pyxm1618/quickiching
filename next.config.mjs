import { withWorkflow } from "workflow/next";

const developmentMode = process.env.NODE_ENV === "development";
const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(developmentMode ? ["'unsafe-eval'"] : []),
  "https://challenges.cloudflare.com",
];
const connectSources = [
  "'self'",
  ...(developmentMode ? ["ws:", "wss:"] : []),
  "https://challenges.cloudflare.com",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // CI runs `bun run lint` as an explicit, blocking quality gate. Next 15's
  // duplicate build-time lint invocation passes legacy ESLint options that
  // the installed toolchain rejects, so keep linting single-sourced in CI.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // The Workflow Vercel world loads @vercel/queue, which in turn loads
  // @vercel/oidc and Vercel CLI credential discovery. Those packages must
  // retain normal Node process metadata; bundling them into Next's page-data
  // worker causes env-paths to evaluate without process.argv[0].
  serverExternalPackages: ["@vercel/queue", "@vercel/oidc"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src ${scriptSources.join(" ")}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self' data:",
              `connect-src ${connectSources.join(" ")}`,
              "frame-src https://challenges.cloudflare.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withWorkflow(nextConfig);
