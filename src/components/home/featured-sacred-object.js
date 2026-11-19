import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContactActions } from "@/components/ui/contact-actions";
import { Container } from "@/components/ui/container";
import { MediaFrame } from "@/components/home/media-frame";
import { ReviewStatus } from "@/components/review/review-status";
import { Section } from "@/components/ui/section";
import { ThaiPhrases } from "@/components/ui/thai-phrases";

// Featured sacred object (the legacy homepage's dark-blue coin section).
// data: featuredObject from the homepage builder (stored name, excerpt,
// primary image, slug). lineActions: the verified LINE action built with
// getContactActions on the public site; empty in Client Review, which shows
// the review status label instead. The image is shown whole (poster hint:
// contain) at its own aspect ratio, so nothing is cropped or shifts.
export function FeaturedSacredObject({ data, lineActions = [] }) {
  const ratio = data.image?.width && data.image?.height ? `${data.image.width} / ${data.image.height}` : null;

  return (
    <Section aria-labelledby="featured-object-title" className="home-feature">
      <Container className="home-feature__layout">
        <div className="home-feature__copy">
          <h2 id="featured-object-title" className="home-feature__title">
            <span className="home-feature__title-lead">
              <ThaiPhrases text={data.titleLead} />
            </span>
            {data.titleRest ? (
              <span className="home-feature__title-rest">
                <ThaiPhrases text={data.titleRest} />
              </span>
            ) : null}
          </h2>
          <span aria-hidden="true" className="home-feature__rule" />
          {data.summary ? <p className="home-feature__summary">{data.summary}</p> : null}
          <ReviewStatus status={data.reviewStatus} />
          <div className="home-feature__actions">
            {lineActions.length ? <ContactActions actions={lineActions} layout="row" tone="dark" /> : null}
            <Button href={data.href} variant="outline-light">
              ดูรุ่นทั้งหมด
              <span aria-hidden="true"> →</span>
            </Button>
          </div>
        </div>
        {data.image ? (
          <Link
            aria-label={`ดูรายละเอียด ${data.name}`}
            className="home-feature__media-link"
            href={data.href}
            prefetch={false}
            style={ratio ? { "--home-feature-ratio": ratio } : undefined}
          >
            <MediaFrame
              alt={data.image.alt}
              className="home-feature__media"
              desktopImage={data.image}
              fit={data.image.fit}
              matte={data.image.matte}
              sizes="(max-width: 767px) 100vw, 50vw"
            />
          </Link>
        ) : null}
      </Container>
    </Section>
  );
}
