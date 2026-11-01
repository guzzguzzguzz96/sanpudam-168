import { Suspense } from "react";
import { PageHeader } from "@/components/pages/page-header";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { VisitView } from "@/components/pages/visit-view";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getVisitPage } from "@/server/site";

// Generic metadata only: no CMS content (draft or published) is used here.
export const metadata = {
  title: "เยี่ยมชม",
};

const header = <PageHeader current="เยี่ยมชม" eyebrow="วางแผนการเดินทาง" title="การเยี่ยมชมและการเดินทาง" />;

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
