import { Container } from "@/components/ui/container";
import { SectionIntro } from "@/components/home/section-intro";
import { Section } from "@/components/ui/section";

// Honest unavailable state for Client Review Mode: no sample content is
// shown in place of data that could not be read.
export function ReviewUnavailable() {
  return (
    <Section aria-labelledby="review-unavailable-title" className="review-unavailable">
      <Container>
        <SectionIntro
          id="review-unavailable-title"
          eyebrow="โหมดตรวจทานเนื้อหา"
          title="ยังโหลดเนื้อหาสำหรับตรวจทานไม่ได้"
          description="ระบบไม่สามารถอ่านเนื้อหาที่นำเข้าได้ในขณะนี้ จึงไม่แสดงข้อมูลแทน โปรดแจ้งผู้พัฒนาเพื่อตรวจสอบการตั้งค่า"
        />
      </Container>
    </Section>
  );
}

// A single section whose data could not be read while others loaded.
export function ReviewSectionUnavailable({ id, title }) {
  return (
    <Section aria-labelledby={`${id}-title`} className="review-unavailable review-unavailable--section">
      <Container>
        <SectionIntro
          id={`${id}-title`}
          eyebrow="โหมดตรวจทานเนื้อหา"
          title={title}
          description="ส่วนนี้โหลดข้อมูลไม่สำเร็จ จึงไม่แสดงข้อมูลแทน"
        />
      </Container>
    </Section>
  );
}
