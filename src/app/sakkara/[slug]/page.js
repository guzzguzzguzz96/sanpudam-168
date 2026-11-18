import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/pages/page-header";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { SacredItemView } from "@/components/pages/sacred-item-view";
import { getPageMetadata, getSacredItemPage, getStaticSlugs, isClientReviewEnabled } from "@/server/site";

// Public site: every published slug is prerendered (generateStaticParams),
// and the page reads its slug and cached data before any Suspense boundary,
// so an unknown slug calls notFound() before the response starts streaming
// and returns a real HTTP 404.
// Client Review: unchanged. The slug is runtime data read inside
// <Suspense> at request time; unknown items render the not-found UI
// (HTTP 200 + noindex, docs/client-review-mode.md §13), and metadata stays
// generic.

const fallback = { title: "วัตถุมงคล" };
const trail = [{ href: "/sakkara", label: "วัตถุมงคล" }];

export async function generateStaticParams() {
  return getStaticSlugs("sacredItems");
}

export async function generateMetadata({ params }) {
  if (isClientReviewEnabled()) return fallback;
  const { slug } = await params;
  return getPageMetadata("sakkaraItem", { slug, fallback });
}

function Unavailable() {
  return (
    <>
      <PageHeader current="รายละเอียด" title="วัตถุมงคล" trail={trail} />
      <PageUnavailable />
    </>
  );
}

async function ReviewSacredItemContent({ params }) {
  const { slug } = await params;
  const page = await getSacredItemPage(slug);
  if (page.status === "not_found") notFound();
  if (page.status !== "ok") return <Unavailable />;
  return <SacredItemView view={page.view} />;
}

export default async function SacredItemPage({ params }) {
  if (isClientReviewEnabled()) {
    return (
      <main id="main-content" className="content-page">
        <Suspense fallback={<PageHeader current="รายละเอียด" title="วัตถุมงคล" trail={trail} />}>
          <ReviewSacredItemContent params={params} />
        </Suspense>
      </main>
    );
  }

  const { slug } = await params;
  const page = await getSacredItemPage(slug);
  if (page.status === "not_found") notFound();
  return <main id="main-content" className="content-page">{page.status === "ok" ? <SacredItemView view={page.view} /> : <Unavailable />}</main>;
}
