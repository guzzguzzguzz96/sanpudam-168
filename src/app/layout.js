import { Noto_Sans_Thai, Noto_Sans_Thai_Looped } from "next/font/google";
import { Suspense } from "react";
import { PublicSiteFooter, PublicSiteHeader } from "@/app/_site/site-chrome";
import { ReviewSiteFooter, ReviewSiteHeader } from "@/app/_review/review-chrome";
import { PreviewNotice } from "@/components/preview-notice";
import { ReviewBanner } from "@/components/review/review-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site";
import { evaluateSiteLaunch, readSiteUrl, robotsFor } from "@/lib/site-launch";
import { isClientReviewEnabled } from "@/server/review";
import "./globals.css";
import "@/components/home/home.css";
import "@/components/pages/pages.css";
import "@/components/review/review.css";
import "@/components/sacred-items/sacred-items.css";
import "@/components/admin/admin.css";

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

// Indexing and the prototype notice follow the launch policy
// (src/lib/site-launch.js): only a Vercel Production deployment with
// SITE_LAUNCHED=true is indexable. Read when pages are built.
const launch = evaluateSiteLaunch(process.env);
const siteUrl = readSiteUrl(process.env);

export const metadata = {
  ...(siteUrl ? { metadataBase: siteUrl } : {}),
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
  robots: robotsFor(launch),
};

export default function RootLayout({ children }) {
  // Environment-only decision (src/lib/review-mode.js). In review mode the
  // header and footer stream per request; their fallbacks are the static
  // versions, so the static shell holds no migrated content. On the public
  // site they read the cached, published site settings.
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
        ) : !launch.launched ? (
          <PreviewNotice />
        ) : null}
        {reviewMode ? (
          <Suspense fallback={<SiteHeader />}>
            <ReviewSiteHeader />
          </Suspense>
        ) : (
          <Suspense fallback={<SiteHeader />}>
            <PublicSiteHeader />
          </Suspense>
        )}
        {children}
        {reviewMode ? (
          <Suspense fallback={<SiteFooter />}>
            <ReviewSiteFooter />
          </Suspense>
        ) : (
          <Suspense fallback={<SiteFooter />}>
            <PublicSiteFooter />
          </Suspense>
        )}
      </body>
    </html>
  );
}
