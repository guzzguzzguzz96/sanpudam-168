import { Suspense } from "react";
import { ReviewHomepage, ReviewHomepageFallback } from "@/app/_review/review-homepage";
import { HomepageView } from "@/components/home/homepage-view";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { getHomepage, isClientReviewEnabled } from "@/server/site";

// Public homepage: published content from the cached public loaders, no
// review labels, no sample copy. Sections without content are omitted.
async function PublicHomepage() {
  const view = await getHomepage();
  if (view.status !== "ok") {
    return (
      <main id="main-content" className="home-page">
        <PageUnavailable />
      </main>
    );
  }
  return <HomepageView scope="public" view={view} />;
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
