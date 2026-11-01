import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HistoryView } from "@/components/pages/history-view";
import { PageHeader } from "@/components/pages/page-header";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { getHistoryPage } from "@/server/site";

// Generic metadata only: no CMS content (draft or published) is used here.
export const metadata = {
  title: "ประวัติ",
};

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
