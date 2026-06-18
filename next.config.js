/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence the Turbopack/webpack warning — no custom webpack config needed
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

// PWA via next-pwa requires webpack mode; disable in Next.js 16 Turbopack context.
// PWA manifest and service worker are handled manually via public/manifest.json.
// Re-enable with: npx next build --webpack once Turbopack matures.

module.exports = nextConfig;
