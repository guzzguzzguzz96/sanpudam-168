import { Container } from "@/components/ui/container";
import { ThaiPhrases } from "@/components/ui/thai-phrases";

export function PreviewNotice() {
  return (
    <aside className="preview-notice" aria-label="สถานะของเว็บไซต์">
      <Container className="preview-notice__inner">
        <span className="preview-notice__label">เว็บไซต์ต้นแบบ</span>
        <p className="preview-notice__text">
          <ThaiPhrases text="เนื้อหาเป็นตัวอย่างที่ยังไม่ได้รับการยืนยัน และบางหน้ายังไม่เปิดใช้งาน" />
        </p>
      </Container>
    </aside>
  );
}
