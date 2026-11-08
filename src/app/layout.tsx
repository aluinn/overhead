import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "OVERHEAD: everything in orbit, right now";
const DESCRIPTION =
  "A real-time 3D view of every satellite, Starlink train and piece of debris above you, plus the closest predicted approaches between objects. No sign-up.";

/** Absolute origin for OG/Twitter URLs. Vercel provides the production host automatically. */
function siteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "OVERHEAD",
  authors: [{ name: "Aluinn McDonald", url: "https://github.com/aluinn" }],
  creator: "Aluinn McDonald",
  keywords: ["satellites", "Starlink", "space debris", "ISS", "orbit", "SGP4", "real-time", "3D"],
  openGraph: { type: "website", siteName: "OVERHEAD", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#03050a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
