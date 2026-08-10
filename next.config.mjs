/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
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
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
