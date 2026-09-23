import { withWorkflow } from "workflow/next";

const ADSTERRA_CSP_ORIGIN = "https://*.effectivecpmnetwork.com";

function isAdsterraEnabled(environment = process.env) {
  const override = environment.NEXT_PUBLIC_ADSTERRA_ENABLED;
  if (override !== undefined && override.trim() !== "") {
    return override.trim().toLowerCase() === "true";
  }
  return environment.VERCEL_ENV === "production" || environment.VERCEL_ENV === "preview";
}

export function buildContentSecurityPolicy(environment = process.env) {
  const adsterra = isAdsterraEnabled(environment);
  const scriptSources = ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://*.clarity.ms", "https://challenges.cloudflare.com"];
  const imageSources = ["'self'", "data:", "https://*.google-analytics.com", "https://www.googletagmanager.com", "https://*.clarity.ms", "https://c.bing.com"];
  const connectSources = ["'self'", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com", "https://*.clarity.ms", "https://c.bing.com", "https://challenges.cloudflare.com"];
  const frameSources = ["https://challenges.cloudflare.com"];

  if (adsterra) {
    scriptSources.push(ADSTERRA_CSP_ORIGIN);
    imageSources.push(ADSTERRA_CSP_ORIGIN);
    connectSources.push(ADSTERRA_CSP_ORIGIN);
    frameSources.push(ADSTERRA_CSP_ORIGIN);
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    `frame-src ${frameSources.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    globalNotFound: true,
  },
  // Next 15's embedded ESLint runner is incompatible with this repository's ESLint 8 API options.
  // Public V1 runs `bun run lint` explicitly before every Vercel build, so the redundant embedded
  // lint pass is disabled while TypeScript checking remains part of `next build`.
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      { source: "/en", destination: "/", permanent: true },
      { source: "/en/:path*", destination: "/:path*", permanent: true },
      {
        source: "/:path*",
        has: [{ type: "host", value: "quickiching.com" }],
        destination: "https://www.quickiching.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "ichingcoin.vercel.app" }],
        destination: "https://www.quickiching.com/:path*",
        permanent: true,
      },
      { source: "/i-ching-coin", destination: "/methods/three-coin", permanent: true },
      { source: "/three-coin-method", destination: "/methods/three-coin", permanent: true },
      { source: "/yarrow-stalk-method", destination: "/methods/yarrow-stalks", permanent: true },
      { source: "/mei-hua-yi-shu", destination: "/methods/mei-hua-yi-shu", permanent: true },
      { source: "/casting-methods", destination: "/#other-casting-methods", permanent: true },
      { source: "/how-to-ask-the-i-ching", destination: "/guides/how-to-ask-the-i-ching", permanent: true },
      { source: "/changing-lines", destination: "/guides/changing-lines", permanent: true },
      { source: "/primary-and-relating-hexagrams", destination: "/guides/primary-relating-hexagrams", permanent: true },
      { source: "/cast/three_coin", destination: "/", permanent: true },
      { source: "/cast/yarrow_stalk", destination: "/methods/yarrow-stalks", permanent: true },
      { source: "/cast/mei_hua_current_time", destination: "/methods/mei-hua-yi-shu", permanent: true },
    ];
  },
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
            value: buildContentSecurityPolicy(),
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withWorkflow(nextConfig);
