import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CARify — verdict on a Copart lot before you bid",
  description:
    "CARify reads Copart lot photos the way a seasoned reseller does and tells you whether to buy the car for import and resale in Georgia, what to replace, and what margin to expect.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700&family=Golos+Text:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
