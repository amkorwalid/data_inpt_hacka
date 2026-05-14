import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "DentalMentor AI",
  description:
    "Interactive dental radiology teaching with synchronized AI narration, zoom, and highlights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 font-sans text-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}
