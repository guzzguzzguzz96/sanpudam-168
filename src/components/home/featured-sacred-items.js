import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { MediaFrame } from "@/components/home/media-frame";
import { SectionIntro } from "@/components/home/section-intro";
import { Section } from "@/components/ui/section";

function SacredItemCard({ item }) {
  return (
    <Card as="article" className="home-item-card">
      <MediaFrame
        alt={item.image?.alt}
        className="home-item-card__media"
        desktopImage={item.image}
        placeholderLabel="พื้นที่ภาพรายการตัวอย่าง · ไม่มีภาพสินค้า"
        sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
      />
      <p className="home-item-card__category">{item.category}</p>
      <h3 className="home-item-card__title">{item.name}</h3>
      <p className="home-item-card__description">{item.description}</p>
      {item.href ? (
        <Button href={item.href} variant="outline">
          ดูรายละเอียด
        </Button>
      ) : null}
    </Card>
  );
}

export function FeaturedSacredItems({ data }) {
  return (
    <Section
      aria-labelledby="featured-items-title"
      className="home-featured-items"
    >
      <Container>
        <SectionIntro
          id="featured-items-title"
          eyebrow="วัตถุมงคล"
          title="รายการแนะนำ"
        />
        <div className="home-item-grid">
          {data.map((item) => (
            <SacredItemCard key={item.id} item={item} />
          ))}
        </div>
        <div className="home-section-action">
          <Button href="/sakkara" variant="secondary">
            ดูรายการทั้งหมด
          </Button>
        </div>
      </Container>
    </Section>
  );
}
