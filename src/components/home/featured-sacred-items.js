import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SacredItemGrid } from "@/components/sacred-items/sacred-item-grid";
import { SectionIntro } from "@/components/home/section-intro";
import { Section } from "@/components/ui/section";
import { normalizeSacredItem } from "@/lib/sacred-items";

export function FeaturedSacredItems({ data }) {
  const items = data.items.map(normalizeSacredItem);

  return (
    <Section
      id="featured-items"
      aria-labelledby="featured-items-title"
      className="home-featured-items"
    >
      <Container>
        <SectionIntro
          id="featured-items-title"
          eyebrow="วัตถุมงคล"
          title="รายการแนะนำ"
        />
        <SacredItemGrid items={items} />
        {/* Shown only once the catalog route exists. */}
        {data.catalogHref ? (
          <div className="home-section-action">
            <Button href={data.catalogHref} variant="outline">
              ดูวัตถุมงคลทั้งหมด
            </Button>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
