import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hornbill TapTap",
  description: "Smart Digital Identity & Customer Engagement Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900">{children}</body>
    </html>
  );
}
