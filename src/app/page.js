import { AboutSanpudam } from "@/components/home/about-sanpudam";
import { Faq } from "@/components/home/faq";
import { FeaturedSacredItems } from "@/components/home/featured-sacred-items";
import { HeroBanner } from "@/components/home/hero-banner";
import { LatestNews } from "@/components/home/latest-news";
import { PhotoGallery } from "@/components/home/photo-gallery";
import { QuickInformation } from "@/components/home/quick-information";
import { VisitUs } from "@/components/home/visit-us";
import { WorshipGuide } from "@/components/home/worship-guide";
import { homepagePreviewData } from "@/data/homepage-preview";

export default function HomePage() {
  const preview = homepagePreviewData;

  return (
    <main id="main-content" className="home-page">
      <HeroBanner
        data={preview.banner}
        developmentLabel={preview.developmentLabel}
        pendingRoutes={preview.pendingRoutes}
      />
      <QuickInformation data={preview.quickInformation} />
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
