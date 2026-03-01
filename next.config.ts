import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "yahoo-finance2", "nodemailer", "twilio", "node-cron"],
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "logo.clearbit.com" },
    ],
  },
};

export default nextConfig;
