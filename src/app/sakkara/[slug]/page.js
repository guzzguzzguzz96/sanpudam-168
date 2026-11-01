import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/pages/page-header";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { SacredItemView } from "@/components/pages/sacred-item-view";
import { getSacredItemPage } from "@/server/site";

// Item pages are never prerendered (no static params list), and the slug
// is runtime data read inside <Suspense>. Generic metadata only, so no
// item title or image reaches <head>.
export const metadata = {
  title: "วัตถุมงคล",
};

const trail = [{ href: "/sakkara", label: "วัตถุมงคล" }];

async function SacredItemContent({ params }) {
  const { slug } = await params;
  const page = await getSacredItemPage(slug);
  if (page.status === "not_found") notFound();
  if (page.status !== "ok") {
    return (
      <>
        <PageHeader current="รายละเอียด" title="วัตถุมงคล" trail={trail} />
        <PageUnavailable />
      </>
    );
  }
  return <SacredItemView view={page.view} />;
}

export default function SacredItemPage({ params }) {
  return (
    <main id="main-content" className="content-page">
      <Suspense fallback={<PageHeader current="รายละเอียด" title="วัตถุมงคล" trail={trail} />}>
        <SacredItemContent params={params} />
      </Suspense>
    </main>
  );
}
