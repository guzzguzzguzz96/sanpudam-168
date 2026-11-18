import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HistoryView } from "@/components/pages/history-view";
import { PageHeader } from "@/components/pages/page-header";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { getHistoryPage, getPageMetadata } from "@/server/site";

// Review mode: generic title only (no CMS content). Public site: title,
// description, canonical URL, and social image from the published records.
const fallback = { title: "ประวัติ" };

export async function generateMetadata() {
  return getPageMetadata("history", { fallback });
}

async function HistoryContent() {
  const page = await getHistoryPage();
  if (page.status === "not_found") notFound();
  if (page.status !== "ok") {
    return (
      <>
        <PageHeader current="ประวัติ" eyebrow="ประวัติ" title="ประวัติศาล" />
        <PageUnavailable />
      </>
    );
  }
  return <HistoryView view={page.view} />;
}

export default function HistoryPage() {
  return (
    <main id="main-content" className="content-page">
      <Suspense fallback={<PageHeader current="ประวัติ" eyebrow="ประวัติ" title="ประวัติศาล" />}>
        <HistoryContent />
      </Suspense>
    </main>
  );
}
