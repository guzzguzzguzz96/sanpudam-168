import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { MediaFrame } from "@/components/home/media-frame";
import { Section } from "@/components/ui/section";
import { ThaiPhrases } from "@/components/ui/thai-phrases";

export function HeroBanner({ data }) {
  return (
    <Section aria-labelledby="home-hero-title" className="home-hero">
      <Container className="home-hero__inner">
        <div className="home-hero__copy">
          <p className="home-hero__eyebrow">{data.eyebrow}</p>
          <h1 id="home-hero-title" className="home-hero__title">
            <ThaiPhrases text={data.title} />
          </h1>
          <p className="home-hero__description">{data.description}</p>
          <div className="home-hero__actions">
            <Button
              href={data.primaryCta.href}
              className="home-hero__primary"
              variant="primary"
            >
              {data.primaryCta.label}
            </Button>
            <Button href={data.secondaryCta.href} variant="secondary">
              {data.secondaryCta.label}
            </Button>
          </div>
        </div>
        <MediaFrame
          alt={data.desktopImage?.alt}
          className="home-hero__media"
          desktopFocalPoint={data.desktopFocalPoint}
          desktopImage={data.desktopImage}
          mobileFocalPoint={data.mobileFocalPoint}
          mobileImage={data.mobileImage}
          placeholderLabel="พื้นที่ภาพแบนเนอร์ตัวอย่าง · ยังไม่มีภาพที่ได้รับอนุมัติ"
          priority
          sizes="(max-width: 767px) 100vw, 50vw"
        />
      </Container>
    </Section>
  );
}
