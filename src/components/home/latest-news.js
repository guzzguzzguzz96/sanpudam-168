import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { MediaFrame } from "@/components/home/media-frame";
import { SectionIntro } from "@/components/home/section-intro";
import { ReviewStatus } from "@/components/review/review-status";
import { Section } from "@/components/ui/section";

// Thumbnail in a consistent 16:9 frame. Posters and newsletters are shown
// whole (fit "contain" on a neutral matte); the full image stays on the
// article page.
export function NewsCard({ article, headingLevel: Heading = "h3" }) {
  const title = article.href ? (
    <Link href={article.href} prefetch={false}>
      {article.title}
    </Link>
  ) : (
    article.title
  );

  return (
    <Card as="article" className="home-news-card">
      <MediaFrame
        alt={article.image?.alt}
        className="home-news-card__media"
        desktopImage={article.image}
        fit={article.image?.fit}
        matte={article.image?.matte}
        placeholderLabel="พื้นที่ภาพข่าวตัวอย่าง · ไม่มีภาพข่าวจริง"
        sizes="(max-width: 767px) 100vw, (max-width: 1023px) 40vw, 30vw"
      />
      <p className="home-news-card__date">
        {article.publicationDate ?? "วันที่เผยแพร่รอการยืนยัน"}
      </p>
      <Heading className="home-news-card__title">{title}</Heading>
      <p className="home-news-card__description">{article.description}</p>
      <ReviewStatus status={article.reviewStatus} />
      {article.href ? (
        <Link
          className="home-news-card__link"
          href={article.href}
          prefetch={false}
        >
          อ่านข่าวสาร
        </Link>
      ) : null}
    </Card>
  );
}

// Equal cards in reading order; each keeps its natural height.
export function LatestNews({ data }) {
  return (
    <Section aria-labelledby="latest-news-title" className="home-latest-news">
      <Container>
        <SectionIntro
          id="latest-news-title"
          eyebrow="ข่าวสาร"
          title="ข่าวสารล่าสุด"
        />
        <ul className="home-news-grid">
          {data.map((article) => (
            <li key={article.id}>
              <NewsCard article={article} />
            </li>
          ))}
        </ul>
        <div className="home-section-action">
          <Link className="home-text-link" href="/news" prefetch={false}>
            ดูข่าวสารทั้งหมด
          </Link>
        </div>
      </Container>
    </Section>
  );
}
