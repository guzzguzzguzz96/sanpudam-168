import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { MediaFrame } from "@/components/home/media-frame";
import { SectionIntro } from "@/components/home/section-intro";
import { Section } from "@/components/ui/section";

export function AboutSanpudam({ data }) {
  return (
    <Section aria-labelledby="about-sanpudam-title" className="home-about">
      <Container className="home-about__layout">
        <MediaFrame
          alt={data.imageAlt}
          className="home-about__media"
          desktopImage={data.image}
          placeholderLabel="พื้นที่ภาพประกอบตัวอย่าง · รอภาพที่ได้รับอนุมัติ"
          sizes="(max-width: 767px) 100vw, 45vw"
        />
        <div className="home-about__copy">
          <SectionIntro
            id="about-sanpudam-title"
            statusLabel="เนื้อหาตัวอย่าง · ยังไม่ยืนยัน"
            eyebrow="เกี่ยวกับ"
            title={data.title}
            description={data.description}
          />
          <Button href={data.href} variant="outline">
            อ่านประวัติเพิ่มเติม
          </Button>
          <p className="home-route-note">หน้า /history ยังอยู่ระหว่างการพัฒนา</p>
        </div>
      </Container>
    </Section>
  );
}
