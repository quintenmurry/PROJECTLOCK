import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: process.env.NEXT_PUBLIC_APP_NAME ?? "ProjectLock", template: `%s · ${process.env.NEXT_PUBLIC_APP_NAME ?? "ProjectLock"}` },
  description: "Shared workspace for freight forwarders and drayage carriers.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0d2740" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
