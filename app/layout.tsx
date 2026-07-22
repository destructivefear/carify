import type { Metadata } from "next";
import { Golos_Text, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";

const displayFont = Unbounded({
  subsets: ["cyrillic", "latin"],
  weight: ["500", "700"],
  variable: "--font-unbounded",
});

const bodyFont = Golos_Text({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-golos",
});

const monoFont = JetBrains_Mono({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
});

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
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
