import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth"],
  async headers() {
    return [{ source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }, {
      source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" }
      ]
    }];
  }
};
export default config;
