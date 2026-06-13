import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Nunito } from "next/font/google";
import { I18nProvider } from "@/i18n";
import { LOCALE_COOKIE, parseLocale, type Locale } from "@/i18n/locale";
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
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#e97797",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLocale: Locale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html
      lang={initialLocale}
      className={`${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="flex h-full flex-col overflow-hidden"
        suppressHydrationWarning
      >
        <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
