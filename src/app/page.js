import { Suspense } from "react";
import { ReviewHomepage, ReviewHomepageFallback } from "@/app/_review/review-homepage";
import { HomepageView } from "@/components/home/homepage-view";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { JsonLd } from "@/components/seo/json-ld";
import { getHomepage, getHomepageJsonLd, getPageMetadata, isClientReviewEnabled } from "@/server/site";

// Review mode: the layout's generic defaults. Public site: title,
// description, canonical URL, and social image from the site settings.
export async function generateMetadata() {
  return getPageMetadata("home");
}

// Public homepage: published content from the cached public loaders, no
// review labels, no sample copy. Sections without content are omitted.
async function PublicHomepage() {
  const [view, faqJsonLd] = await Promise.all([getHomepage(), getHomepageJsonLd()]);
  if (view.status !== "ok") {
    return (
      <main id="main-content" className="home-page">
        <PageUnavailable />
      </main>
    );
  }
  return (
    <>
      <HomepageView scope="public" view={view} />
      <JsonLd data={faqJsonLd} />
    </>
  );
}

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

  return <PublicHomepage />;
}
