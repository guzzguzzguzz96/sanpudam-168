import { Noto_Sans_Thai, Noto_Sans_Thai_Looped } from "next/font/google";
import { Suspense } from "react";
import { ReviewSiteFooter, ReviewSiteHeader } from "@/app/_review/review-chrome";
import { PreviewNotice } from "@/components/preview-notice";
import { ReviewBanner } from "@/components/review/review-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site";
import { isClientReviewEnabled } from "@/server/review";
import "./globals.css";
import "@/components/home/home.css";
import "@/components/pages/pages.css";
import "@/components/review/review.css";
import "@/components/sacred-items/sacred-items.css";

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
  // Environment-only decision (src/lib/review-mode.js). In review mode the
  // header and footer stream per request; their fallbacks are the public
  // versions, so the static shell holds no migrated content.
  const reviewMode = isClientReviewEnabled();

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
        {reviewMode ? (
          <ReviewBanner />
        ) : siteConfig.isPreview ? (
          <PreviewNotice />
        ) : null}
        {reviewMode ? (
          <Suspense fallback={<SiteHeader />}>
            <ReviewSiteHeader />
          </Suspense>
        ) : (
          <SiteHeader />
        )}
        {children}
        {reviewMode ? (
          <Suspense fallback={<SiteFooter />}>
            <ReviewSiteFooter />
          </Suspense>
        ) : (
          <SiteFooter />
        )}
      </body>
    </html>
  );
}
