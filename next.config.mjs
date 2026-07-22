/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cs.copart.com" },
      { protocol: "https", hostname: "**.copart.com" },
    ],
  },
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
