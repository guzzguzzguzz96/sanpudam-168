import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionIntro } from "@/components/home/section-intro";
import { Section } from "@/components/ui/section";

export function VisitUs({ data }) {
  return (
    <Section aria-labelledby="visit-us-title" className="home-visit">
      <Container className="home-visit__layout">
        <div className="home-visit__content">
          <SectionIntro
            id="visit-us-title"
            eyebrow="วางแผนการเดินทาง"
            title="เยี่ยมชม"
          />
          <dl className="home-visit__details">
            {data.map((detail) => (
              <div key={detail.id} className="home-visit__detail">
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
          <Button href="/visit" variant="outline">
            ข้อมูลการเยี่ยมชม
          </Button>
        </div>

        <div
          className="home-visit__map-placeholder"
          role="img"
          aria-label="พื้นที่สำหรับแผนที่หรือข้อมูลเส้นทางที่ยืนยันแล้ว; ยังไม่มีตำแหน่งที่อนุมัติ"
        >
          <span aria-hidden="true" className="home-visit__map-mark" />
          <p>แผนที่และเส้นทางจะแสดงเมื่อได้รับตำแหน่งที่ยืนยัน</p>
        </div>
      </Container>
    </Section>
  );
}
