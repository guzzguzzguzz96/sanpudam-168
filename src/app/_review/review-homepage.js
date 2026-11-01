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
import { ReviewSectionUnavailable, ReviewUnavailable } from "@/components/review/review-unavailable";
import { siteConfig } from "@/config/site";
import { homepagePreviewData } from "@/data/homepage-preview";
import { getContactActions } from "@/lib/contact-actions";
import { getReviewHomepage } from "@/server/review";

// Client Review homepage (docs/client-review-mode.md). Rendered only when
// the review policy is enabled, always inside <Suspense>, and only at
// request time (getReviewHomepage awaits connection()). Same components and
// section order as the public homepage; a section without migrated content
// is omitted, and a section that failed to load says so. No sample copy
// stands in for missing content.

// The hero keeps its approved interface copy (eyebrow and in-page CTAs).
const heroInterface = {
  eyebrow: siteConfig.name,
  primaryCta: homepagePreviewData.banner.primaryCta,
  secondaryCta: homepagePreviewData.banner.secondaryCta,
};

function SectionOrNotice({ status, id, title, children }) {
  if (children) return children;
  return status === "unavailable" ? <ReviewSectionUnavailable id={id} title={title} /> : null;
}

export async function ReviewHomepage() {
  const review = await getReviewHomepage();

  if (review.status !== "ok") {
    return (
      <main id="main-content" className="home-page">
        <ReviewUnavailable />
      </main>
    );
  }

  const { sections } = review;
  const banner = {
    ...heroInterface,
    title: review.banner?.title ?? siteConfig.localName,
    description: review.banner?.description ?? null,
    desktopImage: review.banner?.desktopImage ?? null,
    mobileImage: review.banner?.mobileImage ?? null,
    desktopFocalPoint: review.banner?.desktopFocalPoint ?? "50% 50%",
    mobileFocalPoint: review.banner?.mobileFocalPoint ?? "50% 50%",
  };

  return (
    <main id="main-content" className="home-page">
      <HeroBanner data={banner} />
      {review.quickInformation ? <QuickInformation data={review.quickInformation} /> : null}
      <QuickActions data={review.quickActions} />
      <SectionOrNotice status={sections.about} id="review-about" title="เกี่ยวกับศาล">
        {review.about ? <AboutSanpudam data={review.about} /> : null}
      </SectionOrNotice>
      <SectionOrNotice status={sections.featuredItems} id="review-featured-items" title="วัตถุมงคล">
        {review.featuredItems ? <FeaturedSacredItems data={review.featuredItems} /> : null}
      </SectionOrNotice>
      <SectionOrNotice status={sections.worshipGuide} id="review-worship-guide" title="คำแนะนำการสักการะ">
        {review.worshipGuide ? <WorshipGuide data={review.worshipGuide.steps} reviewStatus={review.worshipGuide.reviewStatus} /> : null}
      </SectionOrNotice>
      <SectionOrNotice status={sections.news} id="review-news" title="ข่าวสาร">
        {review.news ? <LatestNews data={review.news} /> : null}
      </SectionOrNotice>
      <SectionOrNotice status={sections.gallery} id="review-gallery" title="แกลเลอรี">
        {review.gallery ? <PhotoGallery data={review.gallery} /> : null}
      </SectionOrNotice>
      <SectionOrNotice status={sections.siteSettings} id="review-visit" title="การเยี่ยมชมและการเดินทาง">
        {review.visit ? (
          <VisitUs
            data={review.visit.details}
            actions={review.visit.directions?.href ? getContactActions(["maps"], { directionsUrl: review.visit.directions.href }) : []}
            directionsNote={review.visit.directions?.note}
          />
        ) : null}
      </SectionOrNotice>
      <SectionOrNotice status={sections.faq} id="review-faq" title="คำถามที่พบบ่อย">
        {review.faq ? <Faq data={review.faq} /> : null}
      </SectionOrNotice>
    </main>
  );
}

// Static shell fallback while the review data streams in. Contains no
// content data.
export function ReviewHomepageFallback() {
  return <main id="main-content" className="home-page" aria-busy="true" />;
}
