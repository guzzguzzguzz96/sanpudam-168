import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { MediaFrame } from "@/components/home/media-frame";
import { Section } from "@/components/ui/section";
import { ThaiPhrases } from "@/components/ui/thai-phrases";

export function HeroBanner({ data }) {
  const hasImage = Boolean(data.desktopImage?.src || data.mobileImage?.src);

  return (
    <Section aria-labelledby="home-hero-title" className="home-hero">
      <div className="home-hero__backdrop">
        {hasImage ? (
          <MediaFrame
            alt={data.desktopImage?.alt ?? data.mobileImage?.alt}
            className="home-hero__media"
            desktopFocalPoint={data.desktopFocalPoint}
            desktopImage={data.desktopImage}
            mobileFocalPoint={data.mobileFocalPoint}
            mobileImage={data.mobileImage}
            priority
            sizes="100vw"
          />
        ) : (
          // Abstract temporary backdrop; replaced by approved photography.
          <div aria-hidden="true" className="home-hero__placeholder" />
        )}
      </div>

      <Container className="home-hero__inner">
        <div className="home-hero__copy">
          <p className="home-hero__eyebrow">{data.eyebrow}</p>
          <h1 id="home-hero-title" className="home-hero__title">
            <ThaiPhrases text={data.title} />
          </h1>
          <span aria-hidden="true" className="home-hero__rule" />
          {data.description ? (
            <p className="home-hero__description">{data.description}</p>
          ) : null}
          <div className="home-hero__actions">
            <Button href={data.primaryCta.href} variant="gold">
              {data.primaryCta.label}
            </Button>
            <Button href={data.secondaryCta.href} variant="outline-light">
              {data.secondaryCta.label}
            </Button>
          </div>
        </div>
        {hasImage ? null : (
          <p className="home-hero__media-note">
            <ThaiPhrases text="ภาพประกอบชั่วคราว · รอภาพถ่ายที่ได้รับอนุมัติ" />
          </p>
        )}
      </Container>
    </Section>
  );
}
