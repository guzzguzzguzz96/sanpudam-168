import { Suspense } from "react";
import { PageHeader } from "@/components/pages/page-header";
import { PageUnavailable } from "@/components/pages/page-unavailable";
import { SacredItemFilter } from "@/components/sacred-items/sacred-item-filter";
import { SacredItemGrid } from "@/components/sacred-items/sacred-item-grid";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getPageMetadata, getSacredItemsPage } from "@/server/site";

// Review mode: generic title only (no CMS content). Public site: title,
// description, canonical URL, and social image from the published records.
const fallback = { title: "วัตถุมงคล" };

export async function generateMetadata() {
  return getPageMetadata("sakkara", { title: "วัตถุมงคลและสิ่งศักดิ์สิทธิ์", fallback });
}

const header = <PageHeader current="วัตถุมงคล" eyebrow="วัตถุมงคล" title="วัตถุมงคลและสิ่งศักดิ์สิทธิ์" />;

async function SacredItemsContent() {
  const page = await getSacredItemsPage();
  if (page.status === "unavailable") return <PageUnavailable />;

  return (
    <Section aria-label="รายการวัตถุมงคล" className="content-page__section content-page__section--first">
      <Container>
        {/* ?cat=<slug> is read in the browser only (legacy-compatible links);
            the server output is the full, cacheable list. */}
        <Suspense fallback={<SacredItemGrid emptyMessage="ยังไม่มีรายการวัตถุมงคลที่เผยแพร่" headingLevel="h2" hidePending={page.scope === "public"} items={page.view} />}>
          <SacredItemFilter emptyMessage="ยังไม่มีรายการวัตถุมงคลที่เผยแพร่" headingLevel="h2" hidePending={page.scope === "public"} items={page.view} />
        </Suspense>
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
