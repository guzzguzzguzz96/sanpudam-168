import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { MediaFrame } from "@/components/home/media-frame";
import { SectionIntro } from "@/components/home/section-intro";
import { Section } from "@/components/ui/section";

function NewsCard({ article, featured = false }) {
  const title = article.href ? (
    <Link href={article.href} prefetch={false}>
      {article.title}
    </Link>
  ) : (
    article.title
  );

  return (
    <Card
      as="article"
      className={`home-news-card${featured ? " home-news-card--featured" : ""}`}
    >
      <MediaFrame
        alt={article.image?.alt}
        className="home-news-card__media"
        desktopImage={article.image}
        placeholderLabel="พื้นที่ภาพข่าวตัวอย่าง · ไม่มีภาพข่าวจริง"
        sizes={
          featured
            ? "(max-width: 767px) 100vw, 60vw"
            : "(max-width: 767px) 100vw, 30vw"
        }
      />
      <p className="home-news-card__date">
        {article.publicationDate ?? "วันที่เผยแพร่รอการยืนยัน"}
      </p>
      <h3 className="home-news-card__title">{title}</h3>
      <p className="home-news-card__description">{article.description}</p>
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

export function LatestNews({ data }) {
  const [featuredArticle, ...supportingArticles] = data;

  return (
    <Section aria-labelledby="latest-news-title" className="home-latest-news">
      <Container>
        <SectionIntro
          id="latest-news-title"
          eyebrow="ข่าวสาร"
          title="ข่าวสารล่าสุด"
        />
        <div className="home-news-grid">
          {featuredArticle ? (
            <NewsCard article={featuredArticle} featured />
          ) : null}
          <div className="home-news-grid__supporting">
            {supportingArticles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        </div>
        <div className="home-section-action">
          <Link className="home-text-link" href="/news" prefetch={false}>
            ดูข่าวสารทั้งหมด
          </Link>
        </div>
      </Container>
    </Section>
  );
}
