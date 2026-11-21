import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "SnapCue — AI Interview Copilot", short_name: "SnapCue", start_url: "/", display: "standalone", background_color: "#f2f4fb", theme_color: "#f2f4fb", icons: [192, 512].map(size => ({ src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png" })) };
}
