import { Container } from "@/components/ui/container";
import { MediaFrame } from "@/components/home/media-frame";
import { SectionIntro } from "@/components/home/section-intro";
import { Section } from "@/components/ui/section";

export function PhotoGallery({ data }) {
  return (
    <Section aria-labelledby="photo-gallery-title" className="home-gallery">
      <Container>
        <SectionIntro
          id="photo-gallery-title"
          eyebrow="ภาพถ่าย"
          title="แกลเลอรี"
        />
        <ul className="home-gallery__grid">
          {data.map((item) => (
            <li key={item.id} className={`home-gallery__item ${item.layout}`}>
              <MediaFrame
                alt={item.alt}
                className="home-gallery__media"
                desktopImage={item.image}
                fit={item.image?.fit}
                matte={item.image?.matte}
                placeholderLabel={item.label}
                sizes={
                  item.layout === "home-gallery__item--feature"
                    ? "(max-width: 1023px) 100vw, 50vw"
                    : "(max-width: 1023px) 50vw, 25vw"
                }
              />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
