import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { I18nProvider } from "@/i18n";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FineLens — Graph-Enhanced Legal Intelligence",
  description:
    "KI-gestützter juristischer Assistent mit Graphiti Knowledge Graph, Quellennachweisen und intelligenten Formularen.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#e97797",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="flex h-full flex-col overflow-hidden"
        suppressHydrationWarning
      >
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
