import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NewsArticleView } from "@/components/pages/news-article-view";
import { PageHeader } from "@/components/pages/page-header";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { JsonLd } from "@/components/seo/json-ld";
import { getNewsArticleJsonLd, getNewsArticlePage, getPageMetadata, getStaticSlugs, isClientReviewEnabled } from "@/server/site";

// Same pattern as /sakkara/[slug]. Public site: published slugs are
// prerendered and the slug is checked before any Suspense boundary, so an
// unknown article is a real HTTP 404; the article carries NewsArticle
// JSON-LD. Client Review: unchanged (slug read inside <Suspense> at request
// time, not-found UI with HTTP 200 + noindex, generic metadata).

const fallback = { title: "ข่าวสาร" };
const trail = [{ href: "/news", label: "ข่าวสาร" }];

export async function generateStaticParams() {
  return getStaticSlugs("news");
}

export async function generateMetadata({ params }) {
  if (isClientReviewEnabled()) return fallback;
  const { slug } = await params;
  return getPageMetadata("newsArticle", { slug, fallback });
}

function Unavailable() {
  return (
    <>
      <PageHeader current="รายละเอียด" title="ข่าวสาร" trail={trail} />
      <PageUnavailable />
    </>
  );
}

async function ReviewNewsArticleContent({ params }) {
  const { slug } = await params;
  const page = await getNewsArticlePage(slug);
  if (page.status === "not_found") notFound();
  if (page.status !== "ok") return <Unavailable />;
  return <NewsArticleView view={page.view} />;
}

export default async function NewsArticlePage({ params }) {
  if (isClientReviewEnabled()) {
    return (
      <main id="main-content" className="content-page">
        <Suspense fallback={<PageHeader current="รายละเอียด" title="ข่าวสาร" trail={trail} />}>
          <ReviewNewsArticleContent params={params} />
        </Suspense>
      </main>
    );
  }

  const { slug } = await params;
  const [page, jsonLd] = await Promise.all([getNewsArticlePage(slug), getNewsArticleJsonLd(slug)]);
  if (page.status === "not_found") notFound();
  return (
    <main id="main-content" className="content-page">
      {page.status === "ok" ? <NewsArticleView view={page.view} /> : <Unavailable />}
      {page.status === "ok" ? <JsonLd data={jsonLd} /> : null}
    </main>
  );
}
