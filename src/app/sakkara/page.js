import { Suspense } from "react";
import { PageHeader } from "@/components/pages/page-header";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { SacredItemGrid } from "@/components/sacred-items/sacred-item-grid";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getSacredItemsPage } from "@/server/site";

// Generic metadata only: no CMS content (draft or published) is used here.
export const metadata = {
  title: "วัตถุมงคล",
};

const header = <PageHeader current="วัตถุมงคล" eyebrow="วัตถุมงคล" title="วัตถุมงคลและสิ่งศักดิ์สิทธิ์" />;

async function SacredItemsContent() {
  const page = await getSacredItemsPage();
  if (page.status === "unavailable") return <PageUnavailable />;

  return (
    <Section aria-label="รายการวัตถุมงคล" className="content-page__section content-page__section--first">
      <Container>
        <SacredItemGrid
          emptyMessage="ยังไม่มีรายการวัตถุมงคลที่เผยแพร่"
          headingLevel="h2"
          items={page.view}
        />
      </Container>
    </Section>
  );
}

export default function SacredItemsPage() {
  return (
    <main id="main-content" className="content-page">
      {header}
      <Suspense fallback={null}>
        <SacredItemsContent />
      </Suspense>
    </main>
  );
}
