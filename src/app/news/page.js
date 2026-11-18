import { Suspense } from "react";
import { NewsCard } from "@/components/home/latest-news";
import { PageHeader } from "@/components/pages/page-header";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getNewsPage, getPageMetadata } from "@/server/site";

// Review mode: generic title only (no CMS content). Public site: title,
// description, canonical URL, and social image from the published records.
const fallback = { title: "ข่าวสาร" };

export async function generateMetadata() {
  return getPageMetadata("news", { title: "ข่าวสารและกิจกรรม", fallback });
}

async function NewsContent() {
  const page = await getNewsPage();
  if (page.status === "unavailable") return <PageUnavailable />;

  return (
    <Section aria-label="รายการข่าวสาร" className="content-page__section content-page__section--first">
      <Container>
        {page.view.length ? (
          <ul className="content-page__news-list">
            {page.view.map((article) => (
              <li key={article.id}>
                <NewsCard article={article} headingLevel="h2" hideMissingImage={page.scope === "public"} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="sacred-item-grid__empty">ยังไม่มีข่าวสารที่เผยแพร่</p>
        )}
      </Container>
    </Section>
  );
}

export default function NewsPage() {
  return (
    <main id="main-content" className="content-page">
      <PageHeader current="ข่าวสาร" eyebrow="ข่าวสาร" title="ข่าวสารและกิจกรรม" />
      <Suspense fallback={null}>
        <NewsContent />
      </Suspense>
    </main>
  );
}
