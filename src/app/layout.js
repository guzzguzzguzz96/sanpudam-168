import { Noto_Sans_Thai, Noto_Sans_Thai_Looped } from "next/font/google";
import { PreviewNotice } from "@/components/preview-notice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site";
import "./globals.css";
import "@/components/home/home.css";

const bodyFont = Noto_Sans_Thai_Looped({
  variable: "--font-noto-sans-thai-looped",
  subsets: ["latin", "thai"],
  weight: "variable",
  display: "swap",
  fallback: ["Tahoma", "sans-serif"],
});

const displayFont = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["latin", "thai"],
  weight: "variable",
  display: "swap",
  fallback: ["Leelawadee UI", "Tahoma", "sans-serif"],
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
  robots: {
    index: false,
    follow: false,
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
        {siteConfig.isPreview ? <PreviewNotice /> : null}
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
