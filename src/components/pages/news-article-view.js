import { MediaFrame } from "@/components/home/media-frame";
import { LegacyText } from "@/components/pages/legacy-text";
import { PageHeader } from "@/components/pages/page-header";
import { ReviewStatus } from "@/components/review/review-status";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

// Full, uncropped image: the frame takes the image's own aspect ratio
// (news images include portrait newsletters and an infographic).
function ArticleImage({ image, priority = false, sizes }) {
  const portrait = image.width && image.height && image.height > image.width;
  return (
    <div
      className={`content-page__figure${portrait ? " content-page__figure--portrait" : ""}`}
      style={image.width && image.height ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
    >
      <MediaFrame
        alt={image.alt}
        className="content-page__media content-page__media--fill"
        desktopImage={image}
        priority={priority}
        sizes={sizes}
      />
    </div>
  );
}

// /news/[slug] from the article view data (src/server/site/pages.js). Only
// stored fields: no author, captions, or invented dates.
export function NewsArticleView({ view }) {
  const { status } = view;

  return (
    <>
      <PageHeader
        current={view.title}
        eyebrow="ข่าวสาร"
        title={view.title}
        trail={[{ href: "/news", label: "ข่าวสาร" }]}
      >
        <div className="content-page__meta">
          <ReviewStatus status={status.title} />
          {view.publicationDate ? <p className="content-page__date">{view.publicationDate}</p> : null}
          <ReviewStatus status={status.date} />
        </div>
      </PageHeader>

      <Section aria-label="เนื้อหาข่าว" className="content-page__section content-page__section--first">
        <Container className="content-page__article">
          {view.image ? <ArticleImage image={view.image} priority sizes="(max-width: 767px) 100vw, 768px" /> : null}
          <div className="content-page__prose">
            {view.summary ? <p className="content-page__lead">{view.summary}</p> : null}
            <ReviewStatus className="review-section-status" status={status.summary} />
            <ReviewStatus className="review-section-status" status={status.body} />
            <LegacyText paragraphs={view.body} />
          </div>

          {view.images.length ? (
            <ul className="content-page__gallery" aria-label="ภาพประกอบข่าว">
              {view.images.map((image, index) => (
                <li key={`${image.src}-${index}`}>
                  <ArticleImage image={image} sizes="(max-width: 767px) 100vw, 384px" />
                </li>
              ))}
            </ul>
          ) : null}

          <div className="content-page__actions">
            <Button href="/news" variant="outline">
              กลับไปหน้าข่าวสารทั้งหมด
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
