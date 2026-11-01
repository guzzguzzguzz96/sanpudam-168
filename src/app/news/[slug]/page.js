import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NewsArticleView } from "@/components/pages/news-article-view";
import { PageHeader } from "@/components/pages/page-header";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { getNewsArticlePage } from "@/server/site";

// Same pattern as /sakkara/[slug]: the slug is runtime data read inside
// <Suspense>, article pages are never prerendered (no static params list),
// and metadata is generic. Unknown articles render the not-found UI; with
// Cache Components the route's App Shell is served first, so that response
// is HTTP 200 + noindex (docs/client-review-mode.md §13).
export const metadata = {
  title: "ข่าวสาร",
};

const trail = [{ href: "/news", label: "ข่าวสาร" }];

async function NewsArticleContent({ params }) {
  const { slug } = await params;
  const page = await getNewsArticlePage(slug);
  if (page.status === "not_found") notFound();
  if (page.status !== "ok") {
    return (
      <>
        <PageHeader current="รายละเอียด" title="ข่าวสาร" trail={trail} />
        <PageUnavailable />
      </>
    );
  }
  return <NewsArticleView view={page.view} />;
}

export default function NewsArticlePage({ params }) {
  return (
    <main id="main-content" className="content-page">
      <Suspense fallback={<PageHeader current="รายละเอียด" title="ข่าวสาร" trail={trail} />}>
        <NewsArticleContent params={params} />
      </Suspense>
    </main>
  );
}
