import type { Metadata } from "next";
import { DM_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "FineLens — Transparente Rechtsinformation",
  description:
    "KI-gestützter juristischer Assistent mit Graphiti Knowledge Graph, Quellennachweisen und intelligenten Formularen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${dmSans.variable} ${sourceSerif.variable} h-full antialiased`}>
      <body className="flex h-full flex-col overflow-hidden">{children}</body>
    </html>
  );
}
