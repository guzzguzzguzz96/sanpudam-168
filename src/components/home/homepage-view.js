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
import { ReviewSectionUnavailable } from "@/components/review/review-unavailable";
import { siteConfig } from "@/config/site";
import { getContactActions } from "@/lib/contact-actions";

// The homepage from view data (src/server/review/homepage.js buildHomepage).
// Same components and section order in both scopes. A section without
// content is omitted; nothing stands in for missing content.
//   scope "review": a section that failed to load shows a review notice.
//   scope "public": it is simply left out; contact actions come only from
//                   the verified values in view.contactConfig.

// Interface copy of the hero (not CMS content): eyebrow and in-page CTAs.
export const HERO_INTERFACE = Object.freeze({
  eyebrow: siteConfig.name,
  primaryCta: { href: "#featured-items", label: "ชมวัตถุมงคลแนะนำ" },
  secondaryCta: { href: "#about", label: "ทำความรู้จักศาล" },
});

function SectionOrNotice({ scope, status, id, title, children }) {
  if (children) return children;
  return scope === "review" && status === "unavailable" ? <ReviewSectionUnavailable id={id} title={title} /> : null;
}

function visitActions(view, scope) {
  if (scope === "public") return view.contactConfig ? getContactActions(["maps", "line", "phone"], view.contactConfig) : [];
  return view.visit.directions?.href ? getContactActions(["maps"], { directionsUrl: view.visit.directions.href }) : [];
}

export function HomepageView({ view, scope }) {
  const { sections } = view;
  const banner = {
    ...HERO_INTERFACE,
    title: view.banner?.title ?? siteConfig.localName,
    description: view.banner?.description ?? null,
    desktopImage: view.banner?.desktopImage ?? null,
    mobileImage: view.banner?.mobileImage ?? null,
    desktopFocalPoint: view.banner?.desktopFocalPoint ?? "50% 50%",
    mobileFocalPoint: view.banner?.mobileFocalPoint ?? "50% 50%",
  };

  return (
    <main id="main-content" className="home-page">
      <HeroBanner data={banner} />
      {view.quickInformation ? <QuickInformation data={view.quickInformation} /> : null}
      <QuickActions data={view.quickActions} />
      <SectionOrNotice scope={scope} status={sections.about} id="review-about" title="เกี่ยวกับศาล">
        {view.about ? <AboutSanpudam data={view.about} /> : null}
      </SectionOrNotice>
      <SectionOrNotice scope={scope} status={sections.featuredItems} id="review-featured-items" title="วัตถุมงคล">
        {view.featuredItems ? <FeaturedSacredItems data={view.featuredItems} /> : null}
      </SectionOrNotice>
      <SectionOrNotice scope={scope} status={sections.worshipGuide} id="review-worship-guide" title="คำแนะนำการสักการะ">
        {view.worshipGuide ? <WorshipGuide data={view.worshipGuide.steps} reviewStatus={view.worshipGuide.reviewStatus} /> : null}
      </SectionOrNotice>
      <SectionOrNotice scope={scope} status={sections.news} id="review-news" title="ข่าวสาร">
        {view.news ? <LatestNews data={view.news} hideMissingImages={scope === "public"} /> : null}
      </SectionOrNotice>
      <SectionOrNotice scope={scope} status={sections.gallery} id="review-gallery" title="แกลเลอรี">
        {view.gallery ? <PhotoGallery data={view.gallery} /> : null}
      </SectionOrNotice>
      <SectionOrNotice scope={scope} status={sections.siteSettings} id="review-visit" title="การเยี่ยมชมและการเดินทาง">
        {view.visit ? <VisitUs data={view.visit.details} actions={visitActions(view, scope)} directionsNote={view.visit.directions?.note} /> : null}
      </SectionOrNotice>
      <SectionOrNotice scope={scope} status={sections.faq} id="review-faq" title="คำถามที่พบบ่อย">
        {view.faq ? <Faq data={view.faq} /> : null}
      </SectionOrNotice>
    </main>
  );
}
