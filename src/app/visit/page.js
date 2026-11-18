import { Suspense } from "react";
import { PageHeader } from "@/components/pages/page-header";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { VisitView } from "@/components/pages/visit-view";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getPageMetadata, getVisitPage } from "@/server/site";

// Review mode: generic title only (no CMS content). Public site: title,
// description, canonical URL, and social image from the published records.
const fallback = { title: "เยี่ยมชม" };

export async function generateMetadata() {
  return getPageMetadata("visit", { title: "การเยี่ยมชมและการเดินทาง", fallback });
}

const header = <PageHeader current="เยี่ยมชม" eyebrow="วางแผนการเดินทาง" title={"การเยี่ยมชม\u200Bและการเดินทาง"} />;

async function VisitContent() {
  const page = await getVisitPage();
  if (page.status === "ok") return <VisitView view={page.view} />;

  return (
    <>
      {header}
      {page.status === "unavailable" ? (
        <PageUnavailable />
      ) : (
        <Section className="content-page__section content-page__section--first">
          <Container>
            <p className="sacred-item-grid__empty">ข้อมูลการเยี่ยมชมยังไม่เผยแพร่</p>
          </Container>
        </Section>
      )}
    </>
  );
}

export default function VisitPage() {
  return (
    <main id="main-content" className="content-page">
      <Suspense fallback={header}>
        <VisitContent />
      </Suspense>
    </main>
  );
}
