import { HomepageView } from "@/components/home/homepage-view";
import { ReviewUnavailable } from "@/components/review/review-unavailable";
import { getReviewHomepage } from "@/server/review";

// Client Review homepage (docs/client-review-mode.md). Rendered only when
// the review policy is enabled, always inside <Suspense>, and only at
// request time (getReviewHomepage awaits connection()). Same view component
// as the public homepage; a section that failed to load says so. No sample
// copy stands in for missing content.
export async function ReviewHomepage() {
  const review = await getReviewHomepage();

  if (review.status !== "ok") {
    return (
      <main id="main-content" className="home-page">
        <ReviewUnavailable />
      </main>
    );
  }

  return <HomepageView scope="review" view={review} />;
}

// Static shell fallback while the review data streams in. Contains no
// content data.
export function ReviewHomepageFallback() {
  return <main id="main-content" className="home-page" aria-busy="true" />;
}
