import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site";
import { getContactActions } from "@/lib/contact-actions";
import { getReviewHomepage } from "@/server/review";

// Header and footer with migrated site identity, logo, and imported contact
// details (labeled unverified) while Client Review Mode is on. They share
// the page's request-scoped review load. On any non-"ok" result they render
// exactly like the public header and footer.

function brandOf(review) {
  if (review.status !== "ok" || !review.brand) return null;
  return { name: review.brand.name ?? siteConfig.localName, descriptor: siteConfig.name, logo: review.brand.logo };
}

// Only the owner-confirmed directions link becomes an action here.
function confirmedActionsOf(review) {
  if (review.status !== "ok" || !review.confirmedDirectionsHref) return null;
  return getContactActions(["maps"], { directionsUrl: review.confirmedDirectionsHref });
}

export async function ReviewSiteHeader() {
  const review = await getReviewHomepage();
  return <SiteHeader brand={brandOf(review)} reviewActions={confirmedActionsOf(review)} />;
}

export async function ReviewSiteFooter() {
  const review = await getReviewHomepage();
  return (
    <SiteFooter
      brand={brandOf(review)}
      reviewActions={confirmedActionsOf(review)}
      reviewDetails={review.status === "ok" ? review.footer?.details : null}
    />
  );
}
