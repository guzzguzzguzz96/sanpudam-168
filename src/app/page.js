import { Suspense } from "react";
import { ReviewHomepage, ReviewHomepageFallback } from "@/app/_review/review-homepage";
import { AboutSanpudam } from "@/components/home/about-sanpudam";
import { Faq } from "@/components/home/faq";
import { FeaturedSacredItems } from "@/components/home/featured-sacred-items";
import { HeroBanner } from "@/components/home/hero-banner";
import { LatestNews } from "@/components/home/latest-news";
import { PhotoGallery } from "@/components/home/photo-gallery";
import { QuickActions } from "@/components/home/quick-actions";
import { QuickInformation } from "@/components/home/quick-information";
import { VisitUs } from "@/components/home/visit-us";
import { WorshipGuide } from "@/components/home/worship-guide";
import { homepagePreviewData } from "@/data/homepage-preview";
import { isClientReviewEnabled } from "@/server/review";

export default function HomePage() {
  // Client Review Mode (environment-only policy, off by default and always
  // off in production): migrated draft content, rendered per request.
  if (isClientReviewEnabled()) {
    return (
      <Suspense fallback={<ReviewHomepageFallback />}>
        <ReviewHomepage />
      </Suspense>
    );
  }

  const preview = homepagePreviewData;

  return (
    <main id="main-content" className="home-page">
      <HeroBanner data={preview.banner} />
      <QuickInformation data={preview.quickInformation} />
      <QuickActions data={preview.quickActions} />
      <AboutSanpudam data={preview.about} />
      <FeaturedSacredItems data={preview.featuredItems} />
      <WorshipGuide data={preview.worshipGuide} />
      <LatestNews data={preview.news} />
      <PhotoGallery data={preview.gallery} />
      <VisitUs data={preview.visit} />
      <Faq data={preview.faq} />
    </main>
  );
}
