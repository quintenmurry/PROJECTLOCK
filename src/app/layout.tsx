import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: process.env.NEXT_PUBLIC_APP_NAME ?? "ProjectLock", template: `%s · ${process.env.NEXT_PUBLIC_APP_NAME ?? "ProjectLock"}` },
  description: "One shared record for every drayage move: jobs, delivery orders, status updates and proof of delivery, shared between freight forwarders and trucking carriers.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0d2740" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
