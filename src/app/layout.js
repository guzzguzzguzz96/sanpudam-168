import { Noto_Sans_Thai, Noto_Serif_Thai } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site";
import "./globals.css";

const bodyFont = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["latin", "thai"],
  weight: "variable",
  display: "swap",
  fallback: ["Tahoma", "sans-serif"],
});

const displayFont = Noto_Serif_Thai({
  variable: "--font-noto-serif-thai",
  subsets: ["latin", "thai"],
  weight: "variable",
  display: "swap",
  fallback: ["Leelawadee UI", "serif"],
});

export const metadata = {
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="th"
      className={`${bodyFont.variable} ${displayFont.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="skip-link"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
