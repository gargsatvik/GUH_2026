import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], weight: ["400", "600"], style: ["normal", "italic"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Decoy",
  description: "Every scam call becomes protection for the next customer.",
  appleWebApp: { capable: true, title: "NatWest", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#3C1053",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${serif.variable} ${mono.variable} h-full`}>
      <body className="min-h-full bg-paper text-ink">{children}</body>
    </html>
  );
}
