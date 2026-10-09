// ABOUTME: Root layout component for the Legal Lens application
// ABOUTME: Sets up global fonts, metadata, providers, and base styling

import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Legal Lens",
  description:
    "Evidence first. AI second. Upload a case, find contradictions and gaps, and verify every answer against its source.",
  icons: {
    icon: [
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
    ],
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "android-chrome-192x192",
        url: "/android-chrome-192x192.png",
      },
      {
        rel: "android-chrome-512x512",
        url: "/android-chrome-512x512.png",
      },
    ],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfairDisplay.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans bg-background text-foreground antialiased">
        <Providers>
          {/* SVG Filters for Liquid Glass Effect */}
          <svg
            className="absolute h-0 w-0"
            aria-hidden="true"
            style={{ position: "absolute", width: 0, height: 0 }}
          >
            <defs>
              {/* Liquid distortion filter for glass cards */}
              <filter
                id="liquid-glass-filter"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.01 0.01"
                  numOctaves="2"
                  seed="5"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="3"
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="displaced"
                />
                <feGaussianBlur
                  in="displaced"
                  stdDeviation="0.5"
                  result="blurred"
                />
                <feMerge>
                  <feMergeNode in="blurred" />
                </feMerge>
              </filter>
              {/* Subtle noise texture filter */}
              <filter
                id="liquid-noise"
                x="0%"
                y="0%"
                width="100%"
                height="100%"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.8"
                  numOctaves="4"
                  result="noise"
                />
                <feColorMatrix type="saturate" values="0" result="mono" />
                <feBlend
                  in="SourceGraphic"
                  in2="mono"
                  mode="overlay"
                  result="blend"
                />
                <feComposite in="blend" in2="SourceGraphic" operator="in" />
              </filter>
            </defs>
          </svg>
          {children}
        </Providers>
      </body>
    </html>
  );
}
