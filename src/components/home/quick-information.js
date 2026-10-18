import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionIntro } from "@/components/home/section-intro";
import { Button } from "@/components/ui/button";

export function QuickInformation({ data }) {
  return (
    <Section
      aria-labelledby="quick-information-title"
      className="home-quick-information"
    >
      <Container>
        <SectionIntro
          id="quick-information-title"
          statusLabel="ข้อมูลตัวอย่าง · ยังไม่ยืนยัน"
          eyebrow="ข้อมูลเบื้องต้น"
          title="ข้อมูลสำหรับผู้มาเยือน"
          description="ค่าจริงจะแสดงเมื่อเจ้าของตรวจสอบและยืนยันข้อมูลแล้ว"
        />
        <ul className="home-quick-information__list">
          {data.map((item) => (
            <li key={item.id} className="home-quick-information__item">
              <h3>{item.label}</h3>
              <p>{item.value}</p>
            </li>
          ))}
        </ul>
        <div className="home-section-action">
          <Button href="/visit" variant="secondary">
            ข้อมูลการเยี่ยมชม
          </Button>
          <p className="home-route-note">หน้า /visit ยังอยู่ระหว่างการพัฒนา</p>
        </div>
      </Container>
    </Section>
  );
}
