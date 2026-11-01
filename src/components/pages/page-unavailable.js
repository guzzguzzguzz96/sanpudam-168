import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

// Content could not be read (database or configuration failure). Distinct
// from "not found": the page exists, its data is temporarily unavailable,
// and no sample content is shown instead.
export function PageUnavailable() {
  return (
    <Section aria-labelledby="page-unavailable-title" className="content-page__notice">
      <Container>
        <h2 id="page-unavailable-title" className="content-page__notice-title">
          ยังโหลดเนื้อหาไม่ได้ในขณะนี้
        </h2>
        <p className="content-page__notice-text">
          ระบบอ่านข้อมูลไม่สำเร็จ จึงไม่แสดงข้อมูลแทน โปรดลองใหม่อีกครั้งภายหลัง
        </p>
      </Container>
    </Section>
  );
}
