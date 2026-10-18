import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const typographySamples = [
  {
    label: "Display",
    className: "type-ramp__value--display",
    sample: "ตัวอย่างหัวข้อ",
  },
  {
    label: "H1",
    className: "type-ramp__value--h1",
    sample: "ตัวอย่างหัวข้อ",
  },
  {
    label: "H2",
    className: "type-ramp__value--h2",
    sample: "ตัวอย่างหัวข้อ",
  },
  {
    label: "H3",
    className: "type-ramp__value--h3",
    sample: "ตัวอย่างหัวข้อ",
  },
  {
    label: "Lead",
    className: "type-ramp__value--lead",
    sample: "ตัวอย่างข้อความแนะนำที่อ่านสบาย",
  },
  {
    label: "Body",
    className: "type-ramp__value--body",
    sample: "ตัวอย่างเนื้อหาภาษาไทยสำหรับแสดงขนาดข้อความพื้นฐาน",
  },
  {
    label: "Small",
    className: "type-ramp__value--small",
    sample: "ตัวอย่างข้อความประกอบ",
  },
];

export default function HomePage() {
  return (
    <main id="main-content" className="flex-1">
      <Section aria-labelledby="preview-title">
        <Container>
          <p className="preview-status">
            ตัวอย่างชั่วคราว · Phase 02.2 UI Foundation
          </p>
          <SectionHeading
            id="preview-title"
            as="h1"
            size="display"
            eyebrow={siteConfig.name}
            title="ตัวอย่างระบบส่วนติดต่อผู้ใช้"
            description="หน้านี้ใช้แสดงตัวอักษร ปุ่ม ระยะห่าง คอนเทนเนอร์ และการ์ดระหว่างพัฒนาเท่านั้น ไม่ใช่หน้าเว็บไซต์ฉบับสมบูรณ์"
          />
          <div
            className="preview-actions"
            role="group"
            aria-label="ตัวอย่างรูปแบบปุ่ม"
          >
            <Button href="#preview-cards" variant="primary">
              ปุ่มหลัก
            </Button>
            <Button href="#preview-spacing" variant="secondary">
              ปุ่มรอง
            </Button>
            <Button href="#preview-typography" variant="outline">
              ปุ่มเส้นขอบ
            </Button>
            <Button disabled>ปุ่มปิดใช้งาน</Button>
          </div>
        </Container>
      </Section>

      <Section
        id="preview-typography"
        aria-labelledby="typography-title"
        className="border-y border-soft-border bg-white"
      >
        <Container>
          <SectionHeading
            id="typography-title"
            eyebrow="Typography"
            title="ลำดับตัวอักษรภาษาไทย"
            description="ตัวอย่างระดับตัวอักษรที่ปรับขนาดตามความกว้างหน้าจอ"
          />
          <dl className="type-ramp">
            {typographySamples.map((sample) => (
              <div key={sample.label} className="type-ramp__sample">
                <dt className="type-ramp__label">{sample.label}</dt>
                <dd className={`type-ramp__value ${sample.className}`}>
                  {sample.sample}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      <Section
        id="preview-spacing"
        aria-labelledby="spacing-title"
      >
        <Container>
          <SectionHeading
            id="spacing-title"
            eyebrow="Layout"
            title="คอนเทนเนอร์และระยะห่าง"
            description="คอนเทนเนอร์จำกัดความกว้างเนื้อหาและปรับ gutter ตามช่วงหน้าจอ"
          />
          <div className="preview-spacing" aria-label="ตัวอย่าง spacing tokens">
            <div className="spacing-token">
              <span>space-4 · 16px</span>
              <span
                aria-hidden="true"
                className="spacing-token__bar spacing-token__bar--4"
              />
            </div>
            <div className="spacing-token">
              <span>space-6 · 24px</span>
              <span
                aria-hidden="true"
                className="spacing-token__bar spacing-token__bar--6"
              />
            </div>
            <div className="spacing-token">
              <span>space-8 · 32px</span>
              <span
                aria-hidden="true"
                className="spacing-token__bar spacing-token__bar--8"
              />
            </div>
          </div>
        </Container>
      </Section>

      <Section
        id="preview-cards"
        aria-labelledby="cards-title"
        className="border-y border-soft-border bg-white"
      >
        <Container>
          <SectionHeading
            id="cards-title"
            eyebrow="Components"
            title="การ์ดพื้นฐาน"
            description="ตัวอย่างการประกอบการ์ดทั่วไป โดยไม่ผูกกับข้อมูลธุรกิจ"
          />
          <div className="preview-card-grid">
            <Card as="article">
              <h3 className="preview-card__title">พื้นผิวเนื้อหา</h3>
              <p className="preview-card__copy">
                ตัวอย่างข้อความสำหรับตรวจสอบการจัดวางและความอ่านง่ายของการ์ด
              </p>
            </Card>
            <Card as="article">
              <h3 className="preview-card__title">ส่วนประกอบที่ใช้ซ้ำ</h3>
              <p className="preview-card__copy">
                ระยะขอบ เส้นขอบ และมุมโค้งอ้างอิงจาก design tokens ส่วนกลาง
              </p>
            </Card>
            <Card as="article">
              <h3 className="preview-card__title">ยังไม่มีเนื้อหาจริง</h3>
              <p className="preview-card__copy">
                ข้อมูลสถานที่ ประวัติ สินค้า และช่องทางติดต่อจะเพิ่มหลังได้รับการยืนยัน
              </p>
            </Card>
          </div>
        </Container>
      </Section>
    </main>
  );
}
